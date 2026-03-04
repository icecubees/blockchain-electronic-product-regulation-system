module.exports = app => {
    const auth = require("../controllers/auth.controller.js");
    const { verifyToken } = require("../middleware/authJwt"); // 确保引入了鉴权中间件
    const router = require("express").Router();
  
    router.post("/register", auth.register);
    router.post("/login", auth.signin);

    // 监管方审批接口 (之前写的)
    router.post("/approve", [verifyToken], auth.approveSeller);

    // ===> 新增：获取待审核列表 (必须登录) <===
    router.get("/pending-sellers", [verifyToken], auth.getPendingSellers);
  
    app.use("/api/auth", router);
};