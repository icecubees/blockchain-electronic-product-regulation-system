const config = require("../config/db.config.js");
const Sequelize = require("sequelize");

const sequelize = new Sequelize(config.DB, config.USER, config.PASSWORD, {
  host: config.HOST,
  dialect: config.dialect,
  logging: false,
  pool: {
    max: config.pool.max,
    min: config.pool.min,
    acquire: config.pool.acquire,
    idle: config.pool.idle,
  },
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.user = require("./user.model.js")(sequelize, Sequelize);
db.product = require("./product.model.js")(sequelize, Sequelize);
db.order = require("./order.model.js")(sequelize, Sequelize);
db.auditLog = require("./audit-log.model.js")(sequelize, Sequelize);

db.product.belongsTo(db.user, { as: "seller", foreignKey: "sellerId" });
db.order.belongsTo(db.product, { as: "product", foreignKey: "productId" });
db.order.belongsTo(db.user, { as: "buyer", foreignKey: "buyerId" });
db.auditLog.belongsTo(db.user, { as: "operator", foreignKey: "operatorId" });

module.exports = db;
