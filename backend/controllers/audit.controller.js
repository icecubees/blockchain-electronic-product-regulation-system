const db = require("../models");

exports.getAuditLogs = async (req, res) => {
  try {
    const where = {};

    if (req.query.action) {
      where.action = req.query.action;
    }
    if (req.query.operatorId) {
      where.operatorId = req.query.operatorId;
    }
    if (req.query.result) {
      where.result = req.query.result;
    }
    if (req.query.targetType) {
      where.targetType = req.query.targetType;
    }

    const logs = await db.auditLog.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Math.min(parseInt(req.query.limit || "100", 10), 200),
    });

    res.send(logs);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};
