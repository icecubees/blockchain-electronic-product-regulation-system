// blockchain/truffle-config.js
module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // 本地地址
      port: 7545,            // Ganache GUI 默认端口
      network_id: "*",       // 匹配任何网络ID
    },
  },
  compilers: {
    solc: {
      version: "0.8.19",      // 指定编译器版本
    }
  }
};