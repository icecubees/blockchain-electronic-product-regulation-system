const config = require("../config/db.config.js");
const Sequelize = require("sequelize");

const sequelize = new Sequelize(
  config.DB,
  config.USER,
  config.PASSWORD,
  {
    host: config.HOST,
    dialect: config.dialect,
    logging: false, // 关掉啰嗦的日志
    pool: {
      max: config.pool.max,
      min: config.pool.min,
      acquire: config.pool.acquire,
      idle: config.pool.idle
    }
  }
);

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// 引入模型
db.user = require("../models/user.model.js")(sequelize, Sequelize);
db.product = require("../models/product.model.js")(sequelize, Sequelize);
db.order = require("../models/order.model.js")(sequelize, Sequelize); // <--- 引入新模型

// === 定义关系 ===

// 1. 商品属于卖家
db.product.belongsTo(db.user, { as: "seller", foreignKey: "sellerId" });

// 2. 订单属于商品
db.order.belongsTo(db.product, { as: "product", foreignKey: "productId" });

// 3. 订单属于买家
db.order.belongsTo(db.user, { as: "buyer", foreignKey: "buyerId" });

module.exports = db;