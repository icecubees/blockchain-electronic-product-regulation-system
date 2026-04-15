module.exports = (sequelize, Sequelize) => {
  const AfterSalesRecord = sequelize.define("after_sales_records", {
    orderId: { type: Sequelize.INTEGER, allowNull: false },
    productId: { type: Sequelize.INTEGER, allowNull: false },
    type: { type: Sequelize.STRING, allowNull: false },
    componentName: { type: Sequelize.STRING },
    description: { type: Sequelize.TEXT("long"), allowNull: false },
    serviceResult: { type: Sequelize.STRING },
    createdBy: { type: Sequelize.INTEGER, allowNull: false },
    evidenceIpfsHash: { type: Sequelize.STRING },
  });

  return AfterSalesRecord;
};
