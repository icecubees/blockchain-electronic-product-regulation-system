module.exports = (app) => {
  const auth = require("../controllers/auth.controller.js");
  const { verifyToken, requireRoles } = require("../middleware/authJwt");
  const router = require("express").Router();

  router.post("/register", auth.register);
  router.post("/login", auth.signin);
  router.post("/approve", [verifyToken, requireRoles("regulator", "admin")], auth.approveSeller);
  router.get(
    "/blacklisted-sellers",
    [verifyToken, requireRoles("regulator", "admin")],
    auth.getBlacklistedSellers
  );
  router.post(
    "/unblacklist",
    [verifyToken, requireRoles("regulator", "admin")],
    auth.unblacklistSeller
  );
  router.get(
    "/pending-sellers",
    [verifyToken, requireRoles("regulator", "admin")],
    auth.getPendingSellers
  );
  router.get("/users", [verifyToken, requireRoles("regulator", "admin")], auth.getUsers);
  router.patch(
    "/users/:userId/status",
    [verifyToken, requireRoles("regulator", "admin")],
    auth.updateUserStatus
  );

  app.use("/api/auth", router);
};
