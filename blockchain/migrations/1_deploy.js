const ProductRegulation = artifacts.require("ProductRegulation");

module.exports = async function (deployer) {
  const aiOraclePrivateKey =
    process.env.AI_ORACLE_PRIVATE_KEY ||
    "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce036f4f5f9e5d7b8c6a7d1";

  const aiOracleAddress = web3.eth.accounts.privateKeyToAccount(aiOraclePrivateKey).address;

  await deployer.deploy(ProductRegulation, aiOracleAddress);
};
