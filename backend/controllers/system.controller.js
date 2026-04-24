const settingService = require("../services/system-setting.service");
const auditService = require("../services/audit.service");
const db = require("../models");
const { getPinataHealth } = require("../services/pinata.service");

async function getDatabaseHealth() {
  try {
    await db.sequelize.authenticate();
    const queryInterface = db.sequelize.getQueryInterface();
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) =>
      String(typeof table === "string" ? table : table.tableName || "").toLowerCase()
    );
    let executedMigrationCount = 0;

    if (normalizedTables.includes("schema_migrations")) {
      const [rows] = await db.sequelize.query("SELECT COUNT(*) AS count FROM schema_migrations");
      executedMigrationCount = Number(rows?.[0]?.count || 0);
    }

    return {
      status: "online",
      message: "数据库连接正常",
      tableCount: tables.length,
      migrationTableReady: normalizedTables.includes("schema_migrations"),
      executedMigrationCount,
    };
  } catch (error) {
    return {
      status: "offline",
      message: error.message,
    };
  }
}

async function getBlockchainHealth() {
  try {
    const { getChainHealth } = require("../services/chain.service");
    return getChainHealth();
  } catch (error) {
    return {
      status: "offline",
      message: error.message,
    };
  }
}

exports.getAiAuditSetting = async (req, res) => {
  try {
    const enabled = await settingService.isAiAuditEnabled();
    return res.send({ enabled });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.updateAiAuditSetting = async (req, res) => {
  try {
    const enabled = Boolean(req.body?.enabled);
    const nextEnabled = await settingService.setAiAuditEnabled(enabled);

    await auditService.record({
      operator: req.user,
      action: "AI_AUDIT_SETTING_UPDATED",
      targetType: "SYSTEM_SETTING",
      targetId: settingService.AI_AUDIT_ENABLED_KEY,
      result: "SUCCESS",
      details: {
        enabled: nextEnabled,
      },
      req,
    });

    return res.send({ enabled: nextEnabled });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getSystemHealth = async (req, res) => {
  try {
    const [aiAuditEnabled, database, blockchain, pinata] = await Promise.all([
      settingService.isAiAuditEnabled(),
      getDatabaseHealth(),
      getBlockchainHealth(),
      getPinataHealth(),
    ]);

    return res.send({
      generatedAt: new Date().toISOString(),
      aiAudit: {
        status: aiAuditEnabled ? "online" : "disabled",
        enabled: aiAuditEnabled,
        message: aiAuditEnabled ? "AI 预审核开关已开启" : "AI 预审核开关已关闭",
      },
      database,
      blockchain,
      pinata,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};
