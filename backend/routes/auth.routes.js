module.exports = (app) => {
  const auth = require("../controllers/auth.controller.js");
  const { verifyToken, requireRoles } = require("../middleware/authJwt");
  const router = require("express").Router();

  router.post("/register", auth.register);
  router.post("/login", auth.signin);
  router.post("/approve", [verifyToken, requireRoles("regulator")], auth.approveSeller);
  router.get(
    "/blacklisted-sellers",
    [verifyToken, requireRoles("regulator")],
    auth.getBlacklistedSellers
  );
  router.post(
    "/unblacklist",
    [verifyToken, requireRoles("regulator")],
    auth.unblacklistSeller
  );
  router.get(
    "/pending-sellers",
    [verifyToken, requireRoles("regulator")],
    auth.getPendingSellers
  );
  router.get("/users", [verifyToken, requireRoles("regulator")], auth.getUsers);
  router.patch(
    "/users/:userId/status",
    [verifyToken, requireRoles("regulator")],
    auth.updateUserStatus
  );
  router.patch(
    "/wallet",
    [verifyToken, requireRoles("buyer", "seller")],
    auth.bindWallet
  );
  router.patch(
    "/seller/wallet",
    [verifyToken, requireRoles("seller")],
    auth.bindSellerWallet
  );

  app.use("/api/auth", router);
};
