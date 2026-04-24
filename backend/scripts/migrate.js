"use strict";

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../models");

const MIGRATIONS_TABLE = "schema_migrations";
const migrationsDir = path.resolve(__dirname, "../migrations");

async function ensureMigrationsTable(queryInterface, Sequelize) {
  const tables = await queryInterface.showAllTables();
  const hasTable = tables.some((table) => {
    const tableName = typeof table === "string" ? table : table.tableName;
    return String(tableName).toLowerCase() === MIGRATIONS_TABLE;
  });

  if (hasTable) {
    return;
  }

  await queryInterface.createTable(MIGRATIONS_TABLE, {
    name: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true,
    },
    executedAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
  });
}

function loadMigrations() {
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".js"))
    .sort()
    .map((fileName) => {
      const migration = require(path.join(migrationsDir, fileName));
      const name = migration.name || fileName.replace(/\.js$/, "");

      if (typeof migration.up !== "function") {
        throw new Error(`Migration ${fileName} is missing an up() function.`);
      }

      return {
        name,
        fileName,
        up: migration.up,
        down: migration.down,
      };
    });
}

async function getExecutedMigrationNames(sequelize) {
  const [rows] = await sequelize.query(`SELECT name FROM ${MIGRATIONS_TABLE}`);
  return new Set(rows.map((row) => row.name));
}

async function recordMigration(sequelize, name) {
  await sequelize.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (name, executedAt) VALUES (:name, :executedAt)`,
    {
      replacements: {
        name,
        executedAt: new Date(),
      },
    }
  );
}

async function removeMigrationRecord(sequelize, name) {
  await sequelize.query(`DELETE FROM ${MIGRATIONS_TABLE} WHERE name = :name`, {
    replacements: { name },
  });
}

async function runMigrations({ direction = "up", limit = null, log = console.log } = {}) {
  const { sequelize, Sequelize } = db;
  const queryInterface = sequelize.getQueryInterface();

  await ensureMigrationsTable(queryInterface, Sequelize);

  const migrations = loadMigrations();
  const executedNames = await getExecutedMigrationNames(sequelize);

  if (direction === "down") {
    const rollbackCount = limit === null ? undefined : limit || 1;
    const executedMigrations = migrations
      .filter((migration) => executedNames.has(migration.name))
      .reverse()
      .slice(0, rollbackCount);

    for (const migration of executedMigrations) {
      if (typeof migration.down !== "function") {
        throw new Error(`Migration ${migration.fileName} is missing a down() function.`);
      }

      await migration.down(queryInterface, Sequelize);
      await removeMigrationRecord(sequelize, migration.name);
      log(`Rolled back migration: ${migration.name}`);
    }

    return executedMigrations.map((migration) => migration.name);
  }

  const pendingMigrations = migrations.filter((migration) => !executedNames.has(migration.name));

  for (const migration of pendingMigrations) {
    await migration.up(queryInterface, Sequelize);
    await recordMigration(sequelize, migration.name);
    log(`Executed migration: ${migration.name}`);
  }

  if (pendingMigrations.length === 0) {
    log("No pending migrations.");
  }

  return pendingMigrations.map((migration) => migration.name);
}

async function main() {
  const direction = process.argv.includes("--down") ? "down" : "up";
  const all = process.argv.includes("--all");

  await db.sequelize.authenticate();
  await runMigrations({
    direction,
    limit: all ? null : 1,
  });
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error("Database migration failed:", error.message);
      process.exitCode = 1;
    })
    .finally(async () => {
      try {
        await db.sequelize.close();
      } catch (error) {
        // Ignore close failures in CLI mode.
      }
    });
}

module.exports = {
  runMigrations,
};
