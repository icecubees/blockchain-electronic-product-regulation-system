const path = require("path");

const artifactPath = path.join(
  __dirname,
  "../../blockchain/build/contracts/ProductRegulation.json"
);
const contractArtifact = require(artifactPath);

function getArtifactContractAddress() {
  const networkEntries = Object.entries(contractArtifact.networks || {});
  if (networkEntries.length === 0) {
    return null;
  }

  const [, latestNetwork] = networkEntries[networkEntries.length - 1];
  return latestNetwork.address || null;
}

let Web3;
try {
  const pkg = require("web3");
  Web3 = pkg.Web3 || pkg;
} catch (error) {
  Web3 = require("web3");
}

const GANACHE_URL = process.env.GANACHE_URL || "http://127.0.0.1:7545";
const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || getArtifactContractAddress();
const DEV_ONLY_AI_ORACLE_PRIVATE_KEY =
  "0x1111111111111111111111111111111111111111111111111111111111111111";

if (!CONTRACT_ADDRESS) {
  throw new Error(
    "Missing contract address. Set CONTRACT_ADDRESS or deploy contract to generate artifact network address."
  );
}

const DEFAULT_KEYS = {
  admin:
    process.env.CHAIN_ADMIN_PRIVATE_KEY || null,
  regulator:
    process.env.CHAIN_REGULATOR_PRIVATE_KEY || null,
  market:
    process.env.CHAIN_MARKET_PRIVATE_KEY || null,
  aiOracle:
    process.env.AI_ORACLE_PRIVATE_KEY || DEV_ONLY_AI_ORACLE_PRIVATE_KEY,
};

const web3 = new Web3(GANACHE_URL);
const contract = new web3.eth.Contract(contractArtifact.abi, CONTRACT_ADDRESS);

const accounts = {
  admin: DEFAULT_KEYS.admin ? web3.eth.accounts.privateKeyToAccount(DEFAULT_KEYS.admin) : { role: "admin" },
  regulator: DEFAULT_KEYS.regulator
    ? web3.eth.accounts.privateKeyToAccount(DEFAULT_KEYS.regulator)
    : { role: "regulator" },
  market: DEFAULT_KEYS.market ? web3.eth.accounts.privateKeyToAccount(DEFAULT_KEYS.market) : { role: "market" },
  aiOracle: web3.eth.accounts.privateKeyToAccount(DEFAULT_KEYS.aiOracle),
};

async function resolveUnlockedAccount(role) {
  const unlockedAccounts = await web3.eth.getAccounts();
  const roleIndexMap = {
    admin: 0,
    regulator: 1,
    market: 2,
  };

  const address = unlockedAccounts[roleIndexMap[role]];
  if (!address) {
    throw new Error(`No unlocked Ganache account available for role: ${role}`);
  }

  return address;
}

async function sendContractTransaction({ account, method, gas = 600000, value = "0" }) {
  const gasPrice = await web3.eth.getGasPrice();

  if (account.privateKey) {
    const signedTx = await web3.eth.accounts.signTransaction(
      {
        to: CONTRACT_ADDRESS,
        from: account.address,
        data: method.encodeABI(),
        gas,
        gasPrice,
        value,
      },
      account.privateKey
    );

    return web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  }

  const from = await resolveUnlockedAccount(account.role);
  return web3.eth.sendTransaction({
    to: CONTRACT_ADDRESS,
    from,
    data: method.encodeABI(),
    gas,
    gasPrice,
    value,
  });
}

module.exports = {
  web3,
  contract,
  accounts,
  CONTRACT_ADDRESS,
  sendContractTransaction,
};
