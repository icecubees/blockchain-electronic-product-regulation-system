module.exports = (sequelize, Sequelize) => {
    const Product = sequelize.define("products", {
      name: { type: Sequelize.STRING },
      price: { type: Sequelize.FLOAT },
      description: { type: Sequelize.STRING },
      
      // 检测报告 Hash (原有的)
      ipfsHash: { type: Sequelize.STRING },

      // ===> 新增：资质证书 Hash (溯源)
      qualificationHash: { type: Sequelize.STRING },

      stock: { type: Sequelize.INTEGER },
      // 0=待审, 1=通过, 2=拒绝
      auditStatus: { type: Sequelize.INTEGER },
      
      txHash: { type: Sequelize.STRING },
      onChainId: { type: Sequelize.INTEGER },
      
      // 显式定义外键 (方便查询)
      sellerId: { type: Sequelize.INTEGER }
    });
  
    return Product;
};