require("dotenv").config();
require("./config/env.validation").validateRequiredEnv();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./models");
const { ensureRuntimeSchema } = require("./config/runtime-schema");
const { runMigrations } = require("./scripts/migrate");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

function shouldRunRuntimeSchemaFallback() {
  const explicitValue = String(process.env.RUNTIME_SCHEMA_FALLBACK || "").toLowerCase();
  if (explicitValue === "true") {
    return true;
  }
  if (explicitValue === "false") {
    return false;
  }

  return String(process.env.NODE_ENV || "").toLowerCase() !== "production";
}

db.sequelize
  .authenticate()
  .then(() => db.sequelize.sync({ force: false }))
  .then(() => runMigrations({ log: (message) => console.log(message) }))
  .then(() => {
    if (!shouldRunRuntimeSchemaFallback()) {
      return null;
    }

    console.log("Runtime schema fallback enabled for local compatibility.");
    return ensureRuntimeSchema(db.sequelize, db.Sequelize);
  })
  .then(() => {
    console.log("Database synced successfully");
  })
  .catch((error) => {
    console.error("Database sync failed:", error.message);
  });

app.get("/", (req, res) => {
  res.json({ message: "Backend service is running" });
});

require("./routes/auth.routes.js")(app);
require("./routes/product.routes.js")(app);
require("./routes/file.routes.js")(app);
require("./routes/audit.routes.js")(app);
require("./routes/system.routes.js")(app);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
