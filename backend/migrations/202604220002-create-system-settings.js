"use strict";

const TABLE_NAME = "system_settings";

module.exports = {
  name: "202604220002-create-system-settings",

  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const hasTable = tables.some((table) => {
      const tableName = typeof table === "string" ? table : table.tableName;
      return String(tableName).toLowerCase() === TABLE_NAME;
    });

    if (!hasTable) {
      await queryInterface.createTable(TABLE_NAME, {
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

    await queryInterface.bulkInsert(
      TABLE_NAME,
      [
        {
          key: "ai_audit_enabled",
          value: "true",
          description: "Controls whether seller product submissions call the AI pre-audit service.",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      {
        ignoreDuplicates: true,
      }
    );
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const hasTable = tables.some((table) => {
      const tableName = typeof table === "string" ? table : table.tableName;
      return String(tableName).toLowerCase() === TABLE_NAME;
    });

    if (hasTable) {
      await queryInterface.dropTable(TABLE_NAME);
    }
  },
};
