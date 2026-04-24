module.exports = (app) => {
  const controller = require("../controllers/system.controller");
  const { verifyToken, requireRoles } = require("../middleware/authJwt");
  const router = require("express").Router();

  router.get("/ai-audit", [verifyToken, requireRoles("regulator")], controller.getAiAuditSetting);
  router.get("/health", [verifyToken, requireRoles("regulator")], controller.getSystemHealth);
  router.patch(
    "/ai-audit",
    [verifyToken, requireRoles("regulator")],
    controller.updateAiAuditSetting
  );

  app.use("/api/system-settings", router);
};
