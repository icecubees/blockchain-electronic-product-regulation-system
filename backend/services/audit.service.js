const db = require("../models");

function safeSerialize(details) {
  if (!details) return null;
  if (typeof details === "string") return details;

  try {
    return JSON.stringify(details);
  } catch (error) {
    return String(details);
  }
}

function getIpAddress(req) {
  if (!req) return null;
  return (
    req.headers["x-forwarded-for"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    null
  );
}

async function record({
  operator,
  action,
  targetType,
  targetId,
  result,
  details,
  req,
  txHash,
  ipfsHash,
}) {
  try {
    await db.auditLog.create({
      operatorId: operator?.id || null,
      operatorUsername: operator?.username || null,
      operatorRole: operator?.role || null,
      action,
      targetType,
      targetId: targetId !== undefined && targetId !== null ? String(targetId) : null,
      result,
      details: safeSerialize(details),
      ipAddress: getIpAddress(req),
      txHash: txHash || null,
      ipfsHash: ipfsHash || null,
    });
  } catch (error) {
    console.error("Audit log write failed:", error.message);
  }
}

async function recordAccessDenied(req, requiredRoles) {
  await record({
    operator: req?.user,
    action: "ACCESS_DENIED",
    targetType: "ROUTE",
    targetId: `${req?.method || "UNKNOWN"} ${req?.originalUrl || req?.url || ""}`,
    result: "FAIL",
    details: {
      requiredRoles,
      currentRole: req?.user?.role || null,
    },
    req,
  });
}

module.exports = {
  record,
  recordAccessDenied,
};
