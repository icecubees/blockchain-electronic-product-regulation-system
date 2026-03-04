module.exports = (sequelize, Sequelize) => {
    const Order = sequelize.define("orders", {
      onChainId: { type: Sequelize.INTEGER },
      price: { type: Sequelize.FLOAT },
      
      // 0=Locked, 1=Released(待评价), 2=Completed(已评价), 3=Disputed, 4=Refunded
      status: { type: Sequelize.INTEGER },
      
      complaintReason: { type: Sequelize.STRING },

      // ===> 新增：评价信息
      rating: { type: Sequelize.INTEGER, defaultValue: 0 },
      comment: { type: Sequelize.STRING }
    });
  
    return Order;
};