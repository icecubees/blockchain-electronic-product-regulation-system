const { contract, accounts, sendContractTransaction } = require("./chain.service");

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_REPUTATION_SCORE = 60;
const DEFAULT_RESTORE_SCORE = 20;

async function fetchChainSellerData(ethAddress) {
  if (!ethAddress) {
    return null;
  }

  const sellerData = await contract.methods.sellers(ethAddress).call();
  const hasChainProfile =
    sellerData &&
    sellerData.walletAddress &&
    sellerData.walletAddress.toLowerCase() !== ZERO_ADDRESS;

  if (!hasChainProfile) {
    return null;
  }

  return sellerData;
}

async function syncSellerBlacklist(user) {
  const dbFallback = {
    isBlacklisted: Boolean(user?.isBlacklisted),
    reputationScore: DEFAULT_REPUTATION_SCORE,
    source: "db",
  };

  if (!user || user.role !== "seller" || !user.ethAddress) {
    return dbFallback;
  }

  try {
    const sellerData = await fetchChainSellerData(user.ethAddress);
    if (!sellerData) {
      return dbFallback;
    }

    const chainBlacklisted = Boolean(sellerData.isBlacklisted);
    const parsedScore = parseInt(sellerData.reputationScore, 10);
    const reputationScore = Number.isNaN(parsedScore)
      ? DEFAULT_REPUTATION_SCORE
      : parsedScore;

    if (user.isBlacklisted !== chainBlacklisted) {
      user.isBlacklisted = chainBlacklisted;
      if (typeof user.save === "function") {
        await user.save({ fields: ["isBlacklisted"] });
      }
    }

    return {
      isBlacklisted: chainBlacklisted,
      reputationScore,
      source: "chain",
    };
  } catch (error) {
    console.error("Seller blacklist sync failed:", error.message);
    return dbFallback;
  }
}

async function removeSellerFromBlacklist(user, options = {}) {
  if (!user || user.role !== "seller" || !user.ethAddress) {
    throw new Error("Only seller accounts can be restored");
  }

  const reason = String(options.reason || "").trim();
  const restoredScore = Number.isFinite(Number(options.restoredScore))
    ? Number(options.restoredScore)
    : DEFAULT_RESTORE_SCORE;

  if (!reason) {
    throw new Error("Restore reason is required");
  }

  if (restoredScore < 0) {
    throw new Error("Restored score must be zero or greater");
  }

  if (typeof contract.methods.restoreSeller !== "function") {
    throw new Error("Contract method restoreSeller is unavailable. Recompile and redeploy the contract.");
  }

  const receipt = await sendContractTransaction({
    account: accounts.regulator,
    method: contract.methods.restoreSeller(user.ethAddress, restoredScore, reason),
    gas: 700000,
  });

  user.isBlacklisted = false;
  if (typeof user.save === "function") {
    await user.save({ fields: ["isBlacklisted"] });
  }

  return {
    receipt,
    restoredScore,
    reason,
  };
}

module.exports = {
  syncSellerBlacklist,
  removeSellerFromBlacklist,
  fetchChainSellerData,
  DEFAULT_RESTORE_SCORE,
};
