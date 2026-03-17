// backend/server.js
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./models"); // 引入刚才定义的数据库模型

const app = express();

// 1. 中间件配置
app.use(cors()); // 允许前端跨域
app.use(bodyParser.json()); // 解析 JSON 请求体
app.use(bodyParser.urlencoded({ extended: true }));

// 2. 数据库同步 (关键步骤)
// force: true 会在每次启动时清空数据库（开发初期推荐，定型后改为 false）
// 既然是从零开始，我们先设为 true，确保表结构最新
db.sequelize.sync({ force: false }).then(() => {
    console.log("✅ 数据库已同步 (Drop and Resync Db)");
}).catch((err) => {
    console.error("❌ 数据库连接失败: " + err.message);
});

// 3. 基础测试路由
app.get("/", (req, res) => {
    res.json({ message: "系统后端运行正常" });
});

//路由
require("./routes/auth.routes.js")(app);
require("./routes/product.routes.js")(app);
// 4. 启动服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 服务器正在运行: http://localhost:${PORT}`);
});
