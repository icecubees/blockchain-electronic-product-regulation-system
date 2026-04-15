const ProductRegulation = artifacts.require("ProductRegulation");

module.exports = async function (deployer) {
  const devOnlyAiOraclePrivateKey =
    "0x1111111111111111111111111111111111111111111111111111111111111111";
  const aiOraclePrivateKey =
    process.env.AI_ORACLE_PRIVATE_KEY || devOnlyAiOraclePrivateKey;
  const unlockedAccounts = await web3.eth.getAccounts();

  const aiOracleAddress = web3.eth.accounts.privateKeyToAccount(aiOraclePrivateKey).address;
  const regulatorOperator =
    process.env.CHAIN_REGULATOR_ADDRESS ||
    (process.env.CHAIN_REGULATOR_PRIVATE_KEY
      ? web3.eth.accounts.privateKeyToAccount(process.env.CHAIN_REGULATOR_PRIVATE_KEY).address
      : unlockedAccounts[1]);
  const marketOperator =
    process.env.CHAIN_MARKET_ADDRESS ||
    (process.env.CHAIN_MARKET_PRIVATE_KEY
      ? web3.eth.accounts.privateKeyToAccount(process.env.CHAIN_MARKET_PRIVATE_KEY).address
      : unlockedAccounts[2]);

  await deployer.deploy(ProductRegulation, aiOracleAddress, regulatorOperator, marketOperator);
};
