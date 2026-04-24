"use strict";

function normalizeTableName(table) {
  return String(typeof table === "string" ? table : table.tableName || "").toLowerCase();
}

function hasTable(tables, tableName) {
  return tables.map(normalizeTableName).includes(tableName.toLowerCase());
}

module.exports = {
  name: "202604220004-consolidate-admin-role-into-regulator",

  async up(queryInterface) {
    const tables = await queryInterface.showAllTables();

    if (hasTable(tables, "users")) {
      await queryInterface.bulkUpdate(
        "users",
        { role: "regulator" },
        { role: "admin" }
      );
    }

    if (hasTable(tables, "audit_logs")) {
      await queryInterface.bulkUpdate(
        "audit_logs",
        { operatorRole: "regulator" },
        { operatorRole: "admin" }
      );
    }
  },

  async down() {
    // Role consolidation is intentionally one-way to avoid reintroducing
    // legacy admin accounts after the system has switched to a single
    // privileged supervisor role.
  },
};
