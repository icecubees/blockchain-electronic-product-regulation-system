module.exports = (sequelize, Sequelize) => {
  const AfterSalesRequest = sequelize.define("after_sales_requests", {
    orderId: { type: Sequelize.INTEGER, allowNull: false },
    productId: { type: Sequelize.INTEGER, allowNull: false },
    buyerId: { type: Sequelize.INTEGER, allowNull: false },
    type: { type: Sequelize.STRING, allowNull: false },
    description: { type: Sequelize.TEXT("long"), allowNull: false },
    evidenceIpfsHash: { type: Sequelize.STRING },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: "pending_seller" },
    sellerResponse: { type: Sequelize.TEXT("long") },
    sellerEvidenceIpfsHash: { type: Sequelize.STRING },
    sellerRespondedAt: { type: Sequelize.DATE },
    escalatedAt: { type: Sequelize.DATE },
    escalatedBy: { type: Sequelize.INTEGER },
  });

  return AfterSalesRequest;
};
