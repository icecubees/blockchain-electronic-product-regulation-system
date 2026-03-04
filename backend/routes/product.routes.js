const { verifyToken } = require("../middleware/authJwt");
const controller = require("../controllers/product.controller");

// ===> 1. 引入 multer
const multer = require("multer");
// ===> 2. 配置临时存储路径 (文件会暂时存在 uploads/ 文件夹下)
const upload = multer({ dest: "uploads/" });

module.exports = function(app) {
  app.use(function(req, res, next) {
    res.header(
      "Access-Control-Allow-Headers",
      "x-access-token, Origin, Content-Type, Accept"
    );
    next();
  });

  // ==============================
  // 📦 商品管理 (Product)
  // ==============================

  // 1. 获取市场所有商品 (公开)
  app.get("/api/products", controller.getAllProducts);

  // 2. 监管方获取待审核商品 (需要登录)
  app.get(
    "/api/products/pending",
    [verifyToken], 
    controller.getPendingProducts
  );

  // 3. [关键修复] 商家获取自己的商品 (我的商品库)
  // ⚠️ 之前可能漏了这一行
  app.get(
    "/api/products/my-products",
    [verifyToken],
    controller.getMyProducts
  );

  // 4. 商家上架商品
  app.post(
    "/api/products/add",
    [verifyToken, upload.single('reportFile')], 
    controller.addProduct
  );

  // 5. 监管审核商品
  app.post(
    "/api/products/audit",
    [verifyToken], 
    controller.auditProduct
  );

  // ==============================
  // 🛍️ 交易与订单 (Orders)
  // ==============================

  // 6. 购买商品
  app.post(
    "/api/products/purchase",
    [verifyToken], 
    controller.purchaseProduct
  );

  // 7. 获取我的订单
  app.get(
    "/api/products/orders",
    [verifyToken],
    controller.getMyOrders
  );

  // 8. 确认收货
  app.post(
    "/api/products/confirm",
    [verifyToken], 
    controller.confirmReceipt
  );

  // 9. [新增] 评价订单
  app.post(
    "/api/products/rate",
    [verifyToken],
    controller.rateOrder
  );

  // 10. 发起投诉
  app.post(
    "/api/products/complain",
    [verifyToken], 
    controller.raiseComplaint
  );

  // ===> 新增：获取投诉列表 (监管者专用)
  app.get(
    "/api/products/complaints",
    [verifyToken], // 建议加上 authJwt.isRegulatorOrAdmin 中间件
    controller.getAllComplaints
  );

  // 11. 裁决投诉
  app.post(
    "/api/products/resolve",
    [verifyToken], 
    controller.resolveComplaint
  );
};