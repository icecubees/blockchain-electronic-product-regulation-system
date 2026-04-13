module.exports = (sequelize, Sequelize) => {
  const AuditLog = sequelize.define("audit_logs", {
    operatorId: { type: Sequelize.INTEGER, allowNull: true },
    operatorUsername: { type: Sequelize.STRING, allowNull: true },
    operatorRole: { type: Sequelize.STRING, allowNull: true },
    action: { type: Sequelize.STRING, allowNull: false },
    targetType: { type: Sequelize.STRING, allowNull: false },
    targetId: { type: Sequelize.STRING, allowNull: true },
    result: { type: Sequelize.STRING, allowNull: false },
    details: { type: Sequelize.TEXT("long"), allowNull: true },
    ipAddress: { type: Sequelize.STRING, allowNull: true },
    txHash: { type: Sequelize.STRING, allowNull: true },
    ipfsHash: { type: Sequelize.STRING, allowNull: true },
  });

  return AuditLog;
};
