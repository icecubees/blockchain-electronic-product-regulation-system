const REQUIRED_ENV_VARS = [
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
  "AI_ORACLE_PRIVATE_KEY",
];

const DEVELOPMENT_DEFAULTS = {
  DB_HOST: "127.0.0.1",
  DB_USER: "root",
  DB_PASSWORD: "cyz55555",
  DB_NAME: "electronic_regulation_db",
  JWT_SECRET: "dev-only-jwt-secret-change-me",
  AI_ORACLE_PRIVATE_KEY:
    "0x1111111111111111111111111111111111111111111111111111111111111111",
};

function isProduction() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production";
}

function isMissingEnvVar(name) {
  // Local MySQL setups may intentionally use an empty password in development.
  if (!isProduction() && name === "DB_PASSWORD") {
    return process.env[name] === undefined;
  }

  return !process.env[name] || String(process.env[name]).trim() === "";
}

function applyDevelopmentDefaults() {
  const applied = [];

  for (const [name, value] of Object.entries(DEVELOPMENT_DEFAULTS)) {
    if (!process.env[name] || String(process.env[name]).trim() === "") {
      process.env[name] = value;
      applied.push(name);
    }
  }

  if (applied.length > 0) {
    console.warn(
      `[env] Using development defaults for: ${applied.join(", ")}`
    );
  }
}

function validateRequiredEnv() {
  if (!isProduction()) {
    applyDevelopmentDefaults();
  }

  const missing = REQUIRED_ENV_VARS.filter((name) => isMissingEnvVar(name));

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
}

module.exports = {
  validateRequiredEnv,
};
