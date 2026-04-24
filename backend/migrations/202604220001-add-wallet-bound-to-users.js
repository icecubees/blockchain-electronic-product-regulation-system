"use strict";

module.exports = {
  name: "202604220001-add-wallet-bound-to-users",

  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const hasUsersTable = tables.some((table) => {
      const tableName = typeof table === "string" ? table : table.tableName;
      return String(tableName).toLowerCase() === "users";
    });

    if (!hasUsersTable) {
      return;
    }

    const users = await queryInterface.describeTable("users");
    if (!users.walletBound) {
      await queryInterface.addColumn("users", "walletBound", {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const hasUsersTable = tables.some((table) => {
      const tableName = typeof table === "string" ? table : table.tableName;
      return String(tableName).toLowerCase() === "users";
    });

    if (!hasUsersTable) {
      return;
    }

    const users = await queryInterface.describeTable("users");
    if (users.walletBound) {
      await queryInterface.removeColumn("users", "walletBound");
    }
  },
};
