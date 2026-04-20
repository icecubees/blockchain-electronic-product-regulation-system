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
const { Op } = db.Sequelize;
const SELLER_QUALIFICATION_TYPES = new Set([
  "retailer",
  "brand_authorized",
  "repair_service",
  "used_device_specialist",
  "comprehensive",
]);
const PRIVILEGED_ROLES = new Set(["admin", "regulator"]);
const USER_STATUSES = new Set([0, 1, 2]);

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

function normalizeRole(value) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeStatus(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "number") {
    return USER_STATUSES.has(value) ? value : fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  const aliasMap = {
    pending: 0,
    active: 1,
    frozen: 2,
  };

  if (Object.prototype.hasOwnProperty.call(aliasMap, normalized)) {
    return aliasMap[normalized];
  }

  const parsed = parseInt(normalized, 10);
  return USER_STATUSES.has(parsed) ? parsed : fallback;
}

function parsePositiveInteger(value, fallbackValue, max = 100) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  return Math.min(parsed, max);
}

function getUserScopeForOperator(operator) {
  if (operator?.role === "admin") {
    return ["buyer", "seller", "regulator", "admin"];
  }

  if (operator?.role === "regulator") {
    return ["buyer", "seller"];
  }

  return [];
}

function canManageUser(operator, targetUser) {
  if (!operator || !targetUser || operator.id === targetUser.id) {
    return false;
  }

  if (operator.role === "admin") {
    return targetUser.role !== "admin";
  }

  if (operator.role === "regulator") {
    return ["buyer", "seller"].includes(targetUser.role);
  }

  return false;
}

function serializeManagedUser(user, operator) {
  const rawUser = user?.dataValues || user;

  return {
    id: rawUser.id,
    username: rawUser.username,
    role: rawUser.role,
    status: rawUser.status,
    ethAddress: rawUser.ethAddress,
    qualificationType: rawUser.qualificationType || null,
    isBlacklisted: Boolean(rawUser.isBlacklisted),
    frozenReason: rawUser.frozenReason || null,
    frozenAt: rawUser.frozenAt || null,
    createdAt: rawUser.createdAt,
    updatedAt: rawUser.updatedAt,
    canManage: canManageUser(operator, rawUser),
  };
}

async function createPrivilegedUser({
  username,
  password,
  role,
  ethAddress = null,
}) {
  const normalizedUsername = normalizeOptionalString(username);
  const normalizedRole = normalizeRole(role);
  const normalizedPassword = String(password || "");

  if (!normalizedUsername || !normalizedPassword) {
    throw new Error("Username and password are required");
  }
  if (!PRIVILEGED_ROLES.has(normalizedRole)) {
    throw new Error("Role must be admin or regulator");
  }

  const existed = await User.findOne({ where: { username: normalizedUsername } });
  if (existed) {
    throw new Error("Username already exists");
  }

  return User.create({
    username: normalizedUsername,
    password: bcrypt.hashSync(normalizedPassword, 8),
    role: normalizedRole,
    status: 1,
    ethAddress: ethAddress || web3.eth.accounts.create().address,
  });
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
      return res.status(403).send({
        message: "Account is frozen",
        frozenReason: user.frozenReason || null,
      });
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
      status: user.status,
      ethAddress: user.ethAddress,
      accessToken: token,
      reputationScore: sellerProfile.reputationScore,
      isBlacklisted: sellerProfile.isBlacklisted,
      frozenReason: user.frozenReason || null,
      frozenAt: user.frozenAt || null,
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

exports.getUsers = async (req, res) => {
  try {
    const page = parsePositiveInteger(req.query.page, 1, 100000);
    const pageSize = parsePositiveInteger(req.query.pageSize || req.query.limit, 10, 100);
    const roleFilter = normalizeRole(req.query.role);
    const statusFilter = normalizeStatus(req.query.status, null);
    const keyword = normalizeOptionalString(req.query.q);
    const visibleRoles = getUserScopeForOperator(req.user);

    if (visibleRoles.length === 0) {
      return res.status(403).send({ message: "You do not have permission to view users" });
    }

    const where = {
      role: roleFilter && visibleRoles.includes(roleFilter) ? roleFilter : { [Op.in]: visibleRoles },
    };

    if (statusFilter !== null) {
      where.status = statusFilter;
    }
    if (keyword) {
      where[Op.or] = [
        { username: { [Op.like]: `%${keyword}%` } },
        { ethAddress: { [Op.like]: `%${keyword}%` } },
      ];
    }

    const query = {
      where,
      attributes: [
        "id",
        "username",
        "role",
        "status",
        "ethAddress",
        "qualificationType",
        "isBlacklisted",
        "frozenReason",
        "frozenAt",
        "createdAt",
        "updatedAt",
      ],
      order: [["updatedAt", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };

    const [users, total] = await Promise.all([
      User.findAll(query),
      User.count({ where }),
    ]);

    return res.send({
      items: users.map((user) => serializeManagedUser(user, req.user)),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(Math.ceil(total / pageSize), 1),
      },
      governance: {
        currentRole: req.user.role,
        visibleRoles,
      },
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const nextStatus = normalizeStatus(req.body.status, null);
    const governanceReason = String(req.body.reason || "").trim();
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }
    if (nextStatus === null || ![1, 2].includes(nextStatus)) {
      return res.status(400).send({ message: "Status must be 1(active) or 2(frozen)" });
    }
    if (!canManageUser(req.user, user)) {
      await auditService.recordAccessDenied(req, ["regulator", "admin"]);
      return res.status(403).send({ message: "You do not have permission to manage this user" });
    }
    if (nextStatus === 2 && !governanceReason) {
      return res.status(400).send({ message: "Freeze reason is required" });
    }

    user.status = nextStatus;
    if (nextStatus === 2) {
      user.frozenReason = governanceReason;
      user.frozenAt = new Date();
    } else {
      user.frozenReason = null;
      user.frozenAt = null;
    }
    await user.save();

    await auditService.record({
      operator: req.user,
      action: nextStatus === 2 ? "USER_FROZEN" : "USER_UNFROZEN",
      targetType: "USER",
      targetId: user.id,
      result: "SUCCESS",
      details: {
        username: user.username,
        role: user.role,
        reason: governanceReason || null,
      },
      req,
    });

    return res.send({
      message: nextStatus === 2 ? "User frozen successfully" : "User restored successfully",
      user: serializeManagedUser(user, req.user),
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.createPrivilegedUser = createPrivilegedUser;
