module.exports = (sequelize, Sequelize) => {
  const User = sequelize.define("users", {
    username: { type: Sequelize.STRING, allowNull: false },
    password: { type: Sequelize.STRING, allowNull: false },
    role: { type: Sequelize.STRING, allowNull: false },
    status: { type: Sequelize.INTEGER, defaultValue: 1 },
    ethAddress: { type: Sequelize.STRING },
    qualificationType: { type: Sequelize.STRING },
    brandAuthorizationHash: { type: Sequelize.STRING },
    repairQualificationHash: { type: Sequelize.STRING },
    usedDeviceQualificationHash: { type: Sequelize.STRING },
    qualificationNotes: { type: Sequelize.TEXT("long") },
    frozenReason: { type: Sequelize.TEXT("long") },
    frozenAt: { type: Sequelize.DATE },
    isBlacklisted: {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    },
  });

  return User;
};
