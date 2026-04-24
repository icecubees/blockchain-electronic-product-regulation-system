async function ensureColumn(queryInterface, tableName, tableDefinition, columnName, columnDefinition) {
  if (!tableDefinition[columnName]) {
    await queryInterface.addColumn(tableName, columnName, columnDefinition);
  }
}

async function ensureRuntimeSchema(sequelize, Sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const tables = await queryInterface.showAllTables();
  const normalizedTables = tables.map((table) =>
    typeof table === "string" ? table.toLowerCase() : String(table.tableName || "").toLowerCase()
  );

  if (!normalizedTables.includes("integration_jobs")) {
    await queryInterface.createTable("integration_jobs", {
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  }

  if (!normalizedTables.includes("recall_notifications")) {
    await queryInterface.createTable("recall_notifications", {
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  }

  if (!normalizedTables.includes("after_sales_requests")) {
    await queryInterface.createTable("after_sales_requests", {
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  }

  if (!normalizedTables.includes("system_settings")) {
    await queryInterface.createTable("system_settings", {
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
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  }

  if (normalizedTables.includes("products")) {
    const products = await queryInterface.describeTable("products");

    await ensureColumn(queryInterface, "products", products, "brand", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "model", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "category", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "serialNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "batchNo", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "manufactureDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "warrantyUntil", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "isUsed", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, "products", products, "isRefurbished", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, "products", products, "batteryHealth", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "accessoryStatus", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "cccNumber", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "energyLevel", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "rohsStatus", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "inspectionAgency", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "inspectionDate", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "inspectionConclusion", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "batterySafetyPassed", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "chargerSafetyPassed", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "appearanceGrade", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "functionalTestPassed", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "repairHistoryDeclared", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "auditReasonCodes", {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "recallStatus", {
      type: Sequelize.BOOLEAN,
      allowNull: true,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, "products", products, "recallReason", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "recallNoticeAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "products", products, "recallBatchNo", {
      type: Sequelize.STRING,
      allowNull: true,
    });
  }

  if (normalizedTables.includes("users")) {
    const users = await queryInterface.describeTable("users");

    await ensureColumn(queryInterface, "users", users, "qualificationType", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", users, "walletBound", {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await ensureColumn(queryInterface, "users", users, "brandAuthorizationHash", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", users, "repairQualificationHash", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", users, "usedDeviceQualificationHash", {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", users, "qualificationNotes", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", users, "frozenReason", {
      type: Sequelize.TEXT("long"),
      allowNull: true,
    });
    await ensureColumn(queryInterface, "users", users, "frozenAt", {
      type: Sequelize.DATE,
      allowNull: true,
    });
  }

  if (!normalizedTables.includes("orders")) {
    return;
  }

  const orders = await queryInterface.describeTable("orders");

  await ensureColumn(queryInterface, "orders", orders, "paymentStatus", {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: "pending",
  });
  await ensureColumn(queryInterface, "orders", orders, "paymentMethod", {
    type: Sequelize.STRING,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "paymentReference", {
    type: Sequelize.STRING,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "paidAt", {
    type: Sequelize.DATE,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "refundStatus", {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: "none",
  });
  await ensureColumn(queryInterface, "orders", orders, "refundAmount", {
    type: Sequelize.FLOAT,
    allowNull: true,
    defaultValue: 0,
  });
  await ensureColumn(queryInterface, "orders", orders, "refundedAt", {
    type: Sequelize.DATE,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "shippingStatus", {
    type: Sequelize.STRING,
    allowNull: true,
    defaultValue: "pending",
  });
  await ensureColumn(queryInterface, "orders", orders, "trackingNumber", {
    type: Sequelize.STRING,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "shippingCarrier", {
    type: Sequelize.STRING,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "shippedAt", {
    type: Sequelize.DATE,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "buyerConfirmedAt", {
    type: Sequelize.DATE,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "complaintType", {
    type: Sequelize.STRING,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "sellerResponse", {
    type: Sequelize.TEXT("long"),
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "sellerEvidenceIpfsHash", {
    type: Sequelize.STRING,
    allowNull: true,
  });
  await ensureColumn(queryInterface, "orders", orders, "sellerRespondedAt", {
    type: Sequelize.DATE,
    allowNull: true,
  });
}

module.exports = {
  ensureRuntimeSchema,
};
