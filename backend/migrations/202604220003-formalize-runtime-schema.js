"use strict";

function normalizeTableName(table) {
  return String(typeof table === "string" ? table : table.tableName || "").toLowerCase();
}

function hasTable(tables, tableName) {
  return tables.map(normalizeTableName).includes(tableName.toLowerCase());
}

async function ensureTable(queryInterface, Sequelize, tables, tableName, definition) {
  if (!hasTable(tables, tableName)) {
    await queryInterface.createTable(tableName, definition);
  }
}

async function ensureColumn(queryInterface, tableName, tableDefinition, columnName, columnDefinition) {
  if (!tableDefinition[columnName]) {
    await queryInterface.addColumn(tableName, columnName, columnDefinition);
  }
}

async function ensureColumns(queryInterface, Sequelize, tables, tableName, columnDefinitions) {
  if (!hasTable(tables, tableName)) {
    return;
  }

  const tableDefinition = await queryInterface.describeTable(tableName);
  for (const [columnName, columnDefinition] of Object.entries(columnDefinitions)) {
    await ensureColumn(queryInterface, tableName, tableDefinition, columnName, columnDefinition);
  }
}

function timestampColumns(Sequelize) {
  return {
    createdAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  };
}

module.exports = {
  name: "202604220003-formalize-runtime-schema",

  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();

    await ensureTable(queryInterface, Sequelize, tables, "integration_jobs", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      jobType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      targetType: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      targetId: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending",
      },
      retryCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      maxRetries: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 5,
      },
      lastError: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      payload: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      lastAttemptAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      completedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await ensureTable(queryInterface, Sequelize, tables, "recall_notifications", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      buyerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending",
      },
      notifiedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      viewedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      acknowledgedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await ensureTable(queryInterface, Sequelize, tables, "after_sales_requests", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      orderId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      productId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      buyerId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      evidenceIpfsHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: "pending_seller",
      },
      sellerResponse: {
        type: Sequelize.TEXT("long"),
        allowNull: true,
      },
      sellerEvidenceIpfsHash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      sellerRespondedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      escalatedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      escalatedBy: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    await ensureTable(queryInterface, Sequelize, tables, "system_settings", {
      key: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
      },
      value: {
        type: Sequelize.TEXT("long"),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      ...timestampColumns(Sequelize),
    });

    const refreshedTables = await queryInterface.showAllTables();

    await ensureColumns(queryInterface, Sequelize, refreshedTables, "products", {
      brand: { type: Sequelize.STRING, allowNull: true },
      model: { type: Sequelize.STRING, allowNull: true },
      category: { type: Sequelize.STRING, allowNull: true },
      serialNumber: { type: Sequelize.STRING, allowNull: true },
      batchNo: { type: Sequelize.STRING, allowNull: true },
      manufactureDate: { type: Sequelize.DATE, allowNull: true },
      warrantyUntil: { type: Sequelize.DATE, allowNull: true },
      isUsed: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      isRefurbished: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      batteryHealth: { type: Sequelize.INTEGER, allowNull: true },
      accessoryStatus: { type: Sequelize.STRING, allowNull: true },
      cccNumber: { type: Sequelize.STRING, allowNull: true },
      energyLevel: { type: Sequelize.STRING, allowNull: true },
      rohsStatus: { type: Sequelize.STRING, allowNull: true },
      inspectionAgency: { type: Sequelize.STRING, allowNull: true },
      inspectionDate: { type: Sequelize.DATE, allowNull: true },
      inspectionConclusion: { type: Sequelize.STRING, allowNull: true },
      batterySafetyPassed: { type: Sequelize.BOOLEAN, allowNull: true },
      chargerSafetyPassed: { type: Sequelize.BOOLEAN, allowNull: true },
      appearanceGrade: { type: Sequelize.STRING, allowNull: true },
      functionalTestPassed: { type: Sequelize.BOOLEAN, allowNull: true },
      repairHistoryDeclared: { type: Sequelize.BOOLEAN, allowNull: true },
      auditReasonCodes: { type: Sequelize.TEXT, allowNull: true },
      recallStatus: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
      recallReason: { type: Sequelize.STRING, allowNull: true },
      recallNoticeAt: { type: Sequelize.DATE, allowNull: true },
      recallBatchNo: { type: Sequelize.STRING, allowNull: true },
    });

    await ensureColumns(queryInterface, Sequelize, refreshedTables, "users", {
      qualificationType: { type: Sequelize.STRING, allowNull: true },
      walletBound: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      brandAuthorizationHash: { type: Sequelize.STRING, allowNull: true },
      repairQualificationHash: { type: Sequelize.STRING, allowNull: true },
      usedDeviceQualificationHash: { type: Sequelize.STRING, allowNull: true },
      qualificationNotes: { type: Sequelize.TEXT("long"), allowNull: true },
      frozenReason: { type: Sequelize.TEXT("long"), allowNull: true },
      frozenAt: { type: Sequelize.DATE, allowNull: true },
    });

    await ensureColumns(queryInterface, Sequelize, refreshedTables, "orders", {
      paymentStatus: { type: Sequelize.STRING, allowNull: true, defaultValue: "pending" },
      paymentMethod: { type: Sequelize.STRING, allowNull: true },
      paymentReference: { type: Sequelize.STRING, allowNull: true },
      paidAt: { type: Sequelize.DATE, allowNull: true },
      refundStatus: { type: Sequelize.STRING, allowNull: true, defaultValue: "none" },
      refundAmount: { type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 },
      refundedAt: { type: Sequelize.DATE, allowNull: true },
      shippingStatus: { type: Sequelize.STRING, allowNull: true, defaultValue: "pending" },
      trackingNumber: { type: Sequelize.STRING, allowNull: true },
      shippingCarrier: { type: Sequelize.STRING, allowNull: true },
      shippedAt: { type: Sequelize.DATE, allowNull: true },
      buyerConfirmedAt: { type: Sequelize.DATE, allowNull: true },
      complaintType: { type: Sequelize.STRING, allowNull: true },
      sellerResponse: { type: Sequelize.TEXT("long"), allowNull: true },
      sellerEvidenceIpfsHash: { type: Sequelize.STRING, allowNull: true },
      sellerRespondedAt: { type: Sequelize.DATE, allowNull: true },
    });
  },

  async down() {
    // This migration formalizes legacy runtime schema checks. It is intentionally
    // additive-only so rollback cannot remove columns or tables that may contain
    // production data or pre-existing Sequelize sync output.
  },
};
