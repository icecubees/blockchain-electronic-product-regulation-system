module.exports = (sequelize, Sequelize) => {
  const SystemSetting = sequelize.define("system_settings", {
    key: {
      type: Sequelize.STRING,
      allowNull: false,
      primaryKey: true,
    },
    value: {
      type: Sequelize.TEXT("long"),
      allowNull: false,
    },
    description: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  });

  return SystemSetting;
};
