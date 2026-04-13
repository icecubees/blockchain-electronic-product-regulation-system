module.exports = (sequelize, Sequelize) => {
  const Product = sequelize.define("products", {
    name: { type: Sequelize.STRING },
    price: { type: Sequelize.FLOAT },
    description: { type: Sequelize.STRING },
    ipfsHash: { type: Sequelize.STRING },
    qualificationHash: { type: Sequelize.STRING },
    stock: { type: Sequelize.INTEGER },
    auditStatus: { type: Sequelize.INTEGER },
    txHash: { type: Sequelize.STRING },
    onChainId: { type: Sequelize.INTEGER },
    auditReason: { type: Sequelize.STRING },
    auditBy: { type: Sequelize.INTEGER },
    auditAt: { type: Sequelize.DATE },
    delistReason: { type: Sequelize.STRING },
    delistedBy: { type: Sequelize.INTEGER },
    delistedAt: { type: Sequelize.DATE },
    sellerId: { type: Sequelize.INTEGER },
  });

  return Product;
};
