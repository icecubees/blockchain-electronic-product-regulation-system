const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");
const db = require("../models");
const auditService = require("../services/audit.service");

async function verifyToken(req, res, next) {
  try {
    const token = req.headers["x-access-token"];

    if (!token) {
      return res.status(403).send({ message: "Missing token. Please login first." });
    }

    const decoded = jwt.verify(token, config.secret);
    const user = await db.user.findByPk(decoded.id, {
      attributes: ["id", "username", "role", "status", "isBlacklisted", "ethAddress"],
    });

    if (!user) {
      return res.status(401).send({ message: "User not found for token." });
    }
    if (user.status === 2) {
      return res.status(403).send({ message: "Account is frozen." });
    }

    req.userId = user.id;
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Token is invalid or expired." });
  }
}

function requireRoles(...roles) {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).send({ message: "Unauthenticated request." });
    }

    if (!roles.includes(req.user.role)) {
      await auditService.recordAccessDenied(req, roles);
      return res.status(403).send({ message: "You do not have permission to perform this action." });
    }

    next();
  };
}

module.exports = {
  verifyToken,
  requireRoles,
};
