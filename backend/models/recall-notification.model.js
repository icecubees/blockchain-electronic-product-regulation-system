module.exports = (sequelize, Sequelize) => {
  const RecallNotification = sequelize.define("recall_notifications", {
    buyerId: { type: Sequelize.INTEGER, allowNull: false },
    productId: { type: Sequelize.INTEGER, allowNull: false },
    orderId: { type: Sequelize.INTEGER, allowNull: false },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: "pending" },
    notifiedAt: { type: Sequelize.DATE, allowNull: false },
    viewedAt: { type: Sequelize.DATE, allowNull: true },
    acknowledgedAt: { type: Sequelize.DATE, allowNull: true },
  });

  return RecallNotification;
};
