module.exports = (app) => {
  const auth = require("../controllers/auth.controller.js");
  const { verifyToken, requireRoles } = require("../middleware/authJwt");
  const router = require("express").Router();

  router.post("/register", auth.register);
  router.post("/login", auth.signin);
  router.post("/approve", [verifyToken, requireRoles("regulator", "admin")], auth.approveSeller);
  router.get(
    "/pending-sellers",
    [verifyToken, requireRoles("regulator", "admin")],
    auth.getPendingSellers
  );

  app.use("/api/auth", router);
};
