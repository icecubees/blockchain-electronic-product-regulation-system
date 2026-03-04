const jwt = require("jsonwebtoken");
const config = require("../config/auth.config.js");

verifyToken = (req, res, next) => {
  // 从请求头获取 token (通常是 x-access-token 或 Authorization)
  let token = req.headers["x-access-token"];

  if (!token) {
    return res.status(403).send({ message: "未提供 Token！请先登录。" });
  }

  jwt.verify(token, config.secret, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Token 非法或已过期！" });
    }
    // 把解析出来的 userId 塞进 req 对象，方便后面的控制器使用
    req.userId = decoded.id;
    next();
  });
};

const authJwt = {
  verifyToken: verifyToken
};

module.exports = authJwt;