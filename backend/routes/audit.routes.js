module.exports = (app) => {
  const controller = require("../controllers/audit.controller");
  const { verifyToken, requireRoles } = require("../middleware/authJwt");
  const router = require("express").Router();

  router.get("/", [verifyToken, requireRoles("regulator", "admin")], controller.getAuditLogs);

  app.use("/api/audit-logs", router);
};
