const multer = require("multer");

const { verifyToken, requireRoles } = require("../middleware/authJwt");
const controller = require("../controllers/product.controller");

const upload = multer({ storage: multer.memoryStorage() });

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header("Access-Control-Allow-Headers", "x-access-token, Origin, Content-Type, Accept");
    next();
  });

  app.get("/api/products", controller.getAllProducts);
  app.get("/api/products/:productId/trace", controller.getProductTrace);
  app.get("/api/products/:productId/after-sales", controller.getProductAfterSales);

  app.get(
    "/api/products/pending",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.getPendingProducts
  );
  app.get(
    "/api/products/my-products",
    [verifyToken, requireRoles("seller")],
    controller.getMyProducts
  );

  app.post(
    "/api/products/add",
    [verifyToken, requireRoles("seller"), upload.single("reportFile")],
    controller.addProduct
  );
  app.post(
    "/api/products/audit",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.auditProduct
  );
  app.post(
    "/api/products/delist",
    [verifyToken, requireRoles("seller", "regulator", "admin")],
    controller.delistProduct
  );
  app.post(
    "/api/products/recall",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.recallProduct
  );
  app.post(
    "/api/products/restock",
    [verifyToken, requireRoles("seller")],
    controller.restockProduct
  );
  app.post(
    "/api/products/resubmit",
    [verifyToken, requireRoles("seller")],
    controller.resubmitProduct
  );

  app.post(
    "/api/products/purchase",
    [verifyToken, requireRoles("buyer")],
    controller.purchaseProduct
  );
  app.get(
    "/api/products/recall-notifications/summary",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.getRecallNotificationSummary
  );
  app.get(
    "/api/products/recall-notifications",
    [verifyToken, requireRoles("buyer", "regulator", "admin")],
    controller.getRecallNotifications
  );
  app.post(
    "/api/products/recall-notifications/:notificationId/status",
    [verifyToken, requireRoles("buyer", "regulator", "admin")],
    controller.updateRecallNotificationStatus
  );
  app.get(
    "/api/products/integration-jobs",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.getIntegrationJobs
  );
  app.post(
    "/api/products/integration-jobs/:jobId/retry",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.retryIntegrationJob
  );
  app.get(
    "/api/products/orders",
    [verifyToken, requireRoles("buyer", "seller")],
    controller.getMyOrders
  );
  app.post(
    "/api/products/after-sales",
    [verifyToken, requireRoles("seller", "regulator", "admin")],
    controller.recordAfterSales
  );
  app.post(
    "/api/products/ship",
    [verifyToken, requireRoles("seller")],
    controller.shipOrder
  );
  app.post(
    "/api/products/confirm",
    [verifyToken, requireRoles("buyer")],
    controller.confirmReceipt
  );
  app.post(
    "/api/products/rate",
    [verifyToken, requireRoles("buyer")],
    controller.rateOrder
  );

  app.post(
    "/api/products/complain",
    [verifyToken, requireRoles("buyer")],
    controller.raiseComplaint
  );
  app.post(
    "/api/products/respond-complaint",
    [verifyToken, requireRoles("seller")],
    controller.respondToComplaint
  );
  app.get(
    "/api/products/complaints",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.getAllComplaints
  );
  app.post(
    "/api/products/resolve",
    [verifyToken, requireRoles("regulator", "admin")],
    controller.resolveComplaint
  );
};
