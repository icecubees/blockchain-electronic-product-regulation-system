const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../models");
const config = require("../config/auth.config");
const auditService = require("../services/audit.service");
const {
  syncSellerBlacklist,
  removeSellerFromBlacklist,
  DEFAULT_RESTORE_SCORE,
} = require("../services/seller-blacklist.service");
const {
  web3,
  contract,
  accounts,
  sendContractTransaction,
} = require("../services/chain.service");

const User = db.user;
const SELLER_QUALIFICATION_TYPES = new Set([
  "retailer",
  "brand_authorized",
  "repair_service",
  "used_device_specialist",
  "comprehensive",
]);

function normalizeOptionalString(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function buildSellerQualificationFields(input = {}) {
  const qualificationType = normalizeOptionalString(input.qualificationType);

  return {
    qualificationType:
      qualificationType && SELLER_QUALIFICATION_TYPES.has(qualificationType)
        ? qualificationType
        : null,
    brandAuthorizationHash: normalizeOptionalString(input.brandAuthorizationHash),
    repairQualificationHash: normalizeOptionalString(input.repairQualificationHash),
    usedDeviceQualificationHash: normalizeOptionalString(input.usedDeviceQualificationHash),
    qualificationNotes: normalizeOptionalString(input.qualificationNotes),
  };
}

async function fetchSellerChainProfile(user) {
  const syncResult = await syncSellerBlacklist(user);
  return {
    reputationScore: syncResult.reputationScore,
    isBlacklisted: syncResult.isBlacklisted,
  };
}

exports.register = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).send({ message: "Missing username or password" });
    }

    const existed = await User.findOne({ where: { username } });
    if (existed) {
      return res.status(400).send({ message: "Username already exists" });
    }

    if (role && !["buyer", "seller"].includes(role)) {
      return res.status(403).send({
        message: "Only buyer and seller accounts can be self-registered",
      });
    }

    const userRole = role === "seller" ? "seller" : "buyer";
    const virtualAddress = web3.eth.accounts.create().address;
    const initialStatus = userRole === "seller" ? 0 : 1;
    const qualificationFields =
      userRole === "seller" ? buildSellerQualificationFields(req.body) : {};

    await User.create({
      username,
      password: bcrypt.hashSync(password, 8),
      role: userRole,
      status: initialStatus,
      ethAddress: virtualAddress,
      ...qualificationFields,
    });

    if (userRole === "seller") {
      return res.send({ message: "Seller registration submitted, waiting for approval." });
    }

    return res.send({ message: "Registration successful" });
  } catch (error) {
    console.error("Register failed:", error);
    return res.status(500).send({ message: error.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const user = await User.findOne({ where: { username: req.body.username } });
    if (!user) {
      await auditService.record({
        action: "LOGIN_FAILED",
        targetType: "USER",
        targetId: req.body.username,
        result: "FAIL",
        details: { reason: "USER_NOT_FOUND" },
        req,
      });
      return res.status(404).send({ message: "User not found" });
    }

    if (user.status === 0) {
      return res.status(403).send({ message: "Account is pending approval" });
    }
    if (user.status === 2) {
      return res.status(403).send({ message: "Account is frozen" });
    }

    const passwordIsValid = bcrypt.compareSync(req.body.password, user.password);
    if (!passwordIsValid) {
      await auditService.record({
        operator: user,
        action: "LOGIN_FAILED",
        targetType: "USER",
        targetId: user.id,
        result: "FAIL",
        details: { reason: "INVALID_PASSWORD" },
        req,
      });
      return res.status(401).send({ accessToken: null, message: "Invalid password" });
    }

    const token = jwt.sign({ id: user.id }, config.secret, { expiresIn: 86400 });
    const sellerProfile = await fetchSellerChainProfile(user);

    await auditService.record({
      operator: user,
      action: "LOGIN_SUCCESS",
      targetType: "USER",
      targetId: user.id,
      result: "SUCCESS",
      req,
    });

    return res.status(200).send({
      id: user.id,
      username: user.username,
      role: user.role,
      ethAddress: user.ethAddress,
      accessToken: token,
      reputationScore: sellerProfile.reputationScore,
      isBlacklisted: sellerProfile.isBlacklisted,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.approveSeller = async (req, res) => {
  try {
    const { sellerId, action, reason } = req.body;
    const seller = await User.findByPk(sellerId);
    const reviewReason = String(reason || "").trim();

    if (!seller) {
      return res.status(404).send({ message: "User not found" });
    }
    if (seller.role !== "seller") {
      return res.status(400).send({ message: "Not a seller account" });
    }
    if (!["approve", "reject"].includes(action)) {
      return res.status(400).send({ message: "Invalid review action" });
    }
    if (!reviewReason) {
      return res.status(400).send({ message: "Review reason is required" });
    }

    if (action === "reject") {
      seller.status = 2;
      await seller.save();

      await auditService.record({
        operator: req.user,
        action: "SELLER_REJECTED",
        targetType: "USER",
        targetId: seller.id,
        result: "SUCCESS",
        details: { username: seller.username, reason: reviewReason },
        req,
      });

      return res.send({ message: "Seller request rejected" });
    }

    const receipt = await sendContractTransaction({
      account: accounts.regulator,
      method: contract.methods.registerSeller(seller.ethAddress),
      gas: 400000,
    });

    seller.status = 1;
    await seller.save();

    await auditService.record({
      operator: req.user,
      action: "SELLER_APPROVED",
      targetType: "USER",
      targetId: seller.id,
      result: "SUCCESS",
      details: { username: seller.username, reason: reviewReason },
      req,
      txHash: receipt.transactionHash,
    });

    return res.send({ message: "Seller approved and activated" });
  } catch (error) {
    console.error("Approve seller failed:", error);
    return res.status(500).send({ message: "Approval failed: " + error.message });
  }
};

exports.getPendingSellers = async (req, res) => {
  try {
    const sellers = await User.findAll({
      where: {
        role: "seller",
        status: 0,
      },
      attributes: [
        "id",
        "username",
        "createdAt",
        "qualificationType",
        "brandAuthorizationHash",
        "repairQualificationHash",
        "usedDeviceQualificationHash",
        "qualificationNotes",
      ],
    });

    return res.send(sellers);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getBlacklistedSellers = async (req, res) => {
  try {
    const sellers = await User.findAll({
      where: { role: "seller" },
      attributes: ["id", "username", "status", "ethAddress", "isBlacklisted", "createdAt", "updatedAt"],
      order: [["updatedAt", "DESC"]],
    });

    const synced = await Promise.all(
      sellers.map(async (seller) => {
        const riskProfile = await syncSellerBlacklist(seller);
        return {
          id: seller.id,
          username: seller.username,
          status: seller.status,
          ethAddress: seller.ethAddress,
          isBlacklisted: riskProfile.isBlacklisted,
          reputationScore: riskProfile.reputationScore,
          createdAt: seller.createdAt,
          updatedAt: seller.updatedAt,
        };
      })
    );

    return res.send(synced.filter((seller) => seller.isBlacklisted));
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.unblacklistSeller = async (req, res) => {
  try {
    const { sellerId, reason, restoredScore } = req.body;
    const seller = await User.findByPk(sellerId);

    if (!seller) {
      return res.status(404).send({ message: "Seller not found" });
    }
    if (seller.role !== "seller") {
      return res.status(400).send({ message: "Target user is not a seller" });
    }

    const restoreReason = String(reason || "").trim();
    if (!restoreReason) {
      return res.status(400).send({ message: "Restore reason is required" });
    }

    const restoreResult = await removeSellerFromBlacklist(seller, {
      reason: restoreReason,
      restoredScore,
    });

    await auditService.record({
      operator: req.user,
      action: "SELLER_RESTORED",
      targetType: "USER",
      targetId: seller.id,
      result: "SUCCESS",
      details: {
        username: seller.username,
        reason: restoreReason,
        restoredScore: restoreResult.restoredScore ?? DEFAULT_RESTORE_SCORE,
      },
      req,
      txHash: restoreResult.receipt?.transactionHash || null,
    });

    return res.send({
      message: "Seller restored successfully",
      restoredScore: restoreResult.restoredScore ?? DEFAULT_RESTORE_SCORE,
      txHash: restoreResult.receipt?.transactionHash || null,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};
