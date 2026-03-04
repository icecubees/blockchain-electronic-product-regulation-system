// backend/config/db.config.js
module.exports = {
  HOST: "localhost",
  USER: "root",
  PASSWORD: "cyz55555", 
  DB: "electronic_regulation_db",
  dialect: "mysql",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
};