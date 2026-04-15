module.exports = (sequelize, Sequelize) => {
  const IntegrationJob = sequelize.define("integration_jobs", {
    jobType: { type: Sequelize.STRING, allowNull: false },
    targetType: { type: Sequelize.STRING, allowNull: false },
    targetId: { type: Sequelize.STRING, allowNull: true },
    status: { type: Sequelize.STRING, allowNull: false, defaultValue: "pending" },
    retryCount: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    maxRetries: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 5 },
    lastError: { type: Sequelize.TEXT("long"), allowNull: true },
    payload: { type: Sequelize.TEXT("long"), allowNull: true },
    lastAttemptAt: { type: Sequelize.DATE, allowNull: true },
    completedAt: { type: Sequelize.DATE, allowNull: true },
  });

  return IntegrationJob;
};
