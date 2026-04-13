const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../models");
const config = require("../config/auth.config");
const auditService = require("../services/audit.service");
const {
  web3,
  contract,
  accounts,
  sendContractTransaction,
} = require("../services/chain.service");

const User = db.user;

async function fetchSellerChainProfile(user) {
  let reputationScore = 60;
  let isBlacklisted = false;

  if (user.role !== "seller" || !user.ethAddress) {
    return { reputationScore, isBlacklisted };
  }

  try {
    const sellerData = await contract.methods.sellers(user.ethAddress).call();
    if (sellerData && sellerData.walletAddress !== "0x0000000000000000000000000000000000000000") {
      reputationScore = parseInt(sellerData.reputationScore, 10);
      isBlacklisted = sellerData.isBlacklisted;
    }
  } catch (error) {
    console.error("Chain reputation lookup failed:", error.message);
  }

  return { reputationScore, isBlacklisted };
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

    const userRole = ["buyer", "seller", "regulator", "admin"].includes(role) ? role : "buyer";
    const virtualAddress = web3.eth.accounts.create().address;
    const initialStatus = userRole === "seller" ? 0 : 1;

    await User.create({
      username,
      password: bcrypt.hashSync(password, 8),
      role: userRole,
      status: initialStatus,
      ethAddress: virtualAddress,
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
    const { sellerId, action } = req.body;
    const seller = await User.findByPk(sellerId);

    if (!seller) {
      return res.status(404).send({ message: "User not found" });
    }
    if (seller.role !== "seller") {
      return res.status(400).send({ message: "Not a seller account" });
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
        details: { username: seller.username },
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
      details: { username: seller.username },
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
      attributes: ["id", "username", "createdAt"],
    });

    return res.send(sellers);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};
