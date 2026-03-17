const { verifyToken } = require("../middleware/authJwt");
const controller = require("../controllers/product.controller");
const multer = require("multer");

const upload = multer({ dest: "uploads/" });

module.exports = function (app) {
  app.use(function (req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  app.get("/api/products", controller.getAllProducts);

  app.get("/api/products/pending", [verifyToken], controller.getPendingProducts);
  app.get("/api/products/my-products", [verifyToken], controller.getMyProducts);

  app.post("/api/products/add", [verifyToken, upload.single("reportFile")], controller.addProduct);
  app.post("/api/products/audit", [verifyToken], controller.auditProduct);
  app.post("/api/products/delist", [verifyToken], controller.delistProduct);

  app.post("/api/products/purchase", [verifyToken], controller.purchaseProduct);
  app.get("/api/products/orders", [verifyToken], controller.getMyOrders);
  app.post("/api/products/confirm", [verifyToken], controller.confirmReceipt);
  app.post("/api/products/rate", [verifyToken], controller.rateOrder);

  app.post("/api/products/complain", [verifyToken], controller.raiseComplaint);
  app.get("/api/products/complaints", [verifyToken], controller.getAllComplaints);
  app.post("/api/products/resolve", [verifyToken], controller.resolveComplaint);
};
