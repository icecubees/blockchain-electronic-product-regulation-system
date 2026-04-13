module.exports = (sequelize, Sequelize) => {
  const Order = sequelize.define("orders", {
    onChainId: { type: Sequelize.INTEGER },
    price: { type: Sequelize.FLOAT },
    status: { type: Sequelize.INTEGER },
    complaintReason: { type: Sequelize.STRING },
    evidenceIpfsHash: { type: Sequelize.STRING },
    rating: { type: Sequelize.INTEGER, defaultValue: 0 },
    comment: { type: Sequelize.STRING },
    resolvedBy: { type: Sequelize.INTEGER },
    resolvedAt: { type: Sequelize.DATE },
    rulingForBuyer: { type: Sequelize.BOOLEAN },
    rulingDetails: { type: Sequelize.STRING },
  });

  return Order;
};
