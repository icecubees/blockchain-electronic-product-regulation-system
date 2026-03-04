module.exports = (sequelize, Sequelize) => {
    const User = sequelize.define("users", {
      username: { type: Sequelize.STRING, allowNull: false },
      password: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.STRING, allowNull: false },
      status: { type: Sequelize.INTEGER, defaultValue: 1 },
      ethAddress: { type: Sequelize.STRING },
      ethPrivateKey: { type: Sequelize.STRING },
      
      // ===> 新增：黑名单状态
      isBlacklisted: { 
          type: Sequelize.BOOLEAN, 
          defaultValue: false 
      }
    });
  
    return User;
};