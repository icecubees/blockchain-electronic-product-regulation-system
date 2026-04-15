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
db.afterSalesRecord = require("./after-sales-record.model.js")(sequelize, Sequelize);
db.integrationJob = require("./integration-job.model.js")(sequelize, Sequelize);
db.recallNotification = require("./recall-notification.model.js")(sequelize, Sequelize);

db.product.belongsTo(db.user, { as: "seller", foreignKey: "sellerId" });
db.product.hasMany(db.afterSalesRecord, { as: "afterSalesRecords", foreignKey: "productId" });
db.order.belongsTo(db.product, { as: "product", foreignKey: "productId" });
db.order.belongsTo(db.user, { as: "buyer", foreignKey: "buyerId" });
db.order.hasMany(db.afterSalesRecord, { as: "afterSalesRecords", foreignKey: "orderId" });
db.order.hasMany(db.recallNotification, { as: "recallNotifications", foreignKey: "orderId" });
db.auditLog.belongsTo(db.user, { as: "operator", foreignKey: "operatorId" });
db.afterSalesRecord.belongsTo(db.order, { as: "order", foreignKey: "orderId" });
db.afterSalesRecord.belongsTo(db.product, { as: "product", foreignKey: "productId" });
db.afterSalesRecord.belongsTo(db.user, { as: "creator", foreignKey: "createdBy" });
db.recallNotification.belongsTo(db.order, { as: "order", foreignKey: "orderId" });
db.recallNotification.belongsTo(db.product, { as: "product", foreignKey: "productId" });
db.recallNotification.belongsTo(db.user, { as: "buyer", foreignKey: "buyerId" });
db.product.hasMany(db.recallNotification, { as: "recallNotifications", foreignKey: "productId" });
db.user.hasMany(db.recallNotification, { as: "recallNotifications", foreignKey: "buyerId" });

module.exports = db;
