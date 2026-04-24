require("dotenv").config();

const db = require("../models");
const { ensureRuntimeSchema } = require("../config/runtime-schema");
const { runMigrations } = require("./migrate");
const { createPrivilegedUser } = require("../controllers/auth.controller");

function getArgValue(name) {
  const arg = process.argv.find((item) => item.startsWith(`--${name}=`));
  return arg ? arg.slice(name.length + 3) : null;
}

async function main() {
  const username = getArgValue("username") || process.env.INIT_USERNAME;
  const password = getArgValue("password") || process.env.INIT_PASSWORD;
  const role = getArgValue("role") || process.env.INIT_ROLE || "regulator";
  const ethAddress = getArgValue("ethAddress") || process.env.INIT_ETH_ADDRESS || null;

  if (!username || !password) {
    throw new Error(
      "Usage: node backend/scripts/init-privileged-user.js --username=<name> --password=<password> [--role=regulator]"
    );
  }

  await db.sequelize.authenticate();
  await db.sequelize.sync({ force: false });
  await runMigrations();
  await ensureRuntimeSchema(db.sequelize, db.Sequelize);

  const user = await createPrivilegedUser({
    username,
    password,
    role,
    ethAddress,
  });

  console.log(
    JSON.stringify(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        ethAddress: user.ethAddress,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error("Failed to initialize privileged user:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.sequelize.close();
    } catch (error) {
      // Ignore close failures in CLI mode.
    }
  });
