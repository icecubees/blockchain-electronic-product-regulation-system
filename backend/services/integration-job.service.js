const db = require("../models");
const auditService = require("./audit.service");
const { syncSellerBlacklist } = require("./seller-blacklist.service");
const {
  web3,
  contract,
  accounts,
  sendContractTransaction,
} = require("./chain.service");

const IntegrationJob = db.integrationJob;
const Product = db.product;
const Order = db.order;
const User = db.user;
const RecallNotification = db.recallNotification;
const Op = db.Sequelize.Op;

const JOB_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  MANUAL_REVIEW: "manual_review",
};

const JOB_TYPE = {
  PURCHASE_PRODUCT: "purchase_product",
  RECALL_PRODUCT: "recall_product",
  FILE_UPLOAD_FAILURE: "file_upload_failure",
};

function safeSerialize(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function parsePayload(payload) {
  if (!payload) {
    return null;
  }

  if (typeof payload !== "string") {
    return payload;
  }

  try {
    return JSON.parse(payload);
  } catch (error) {
    return payload;
  }
}

function serializeJob(job) {
  if (!job) {
    return null;
  }

  return {
    id: job.id,
    jobType: job.jobType,
    targetType: job.targetType,
    targetId: job.targetId,
    status: job.status,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    lastError: job.lastError,
    payload: parsePayload(job.payload),
    lastAttemptAt: job.lastAttemptAt,
    completedAt: job.completedAt,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function createJob({
  jobType,
  targetType,
  targetId = null,
  status = JOB_STATUS.PENDING,
  payload = null,
  error = null,
  maxRetries = 5,
  operator = null,
  req = null,
}) {
  try {
    const job = await IntegrationJob.create({
      jobType,
      targetType,
      targetId: targetId !== undefined && targetId !== null ? String(targetId) : null,
      status,
      retryCount: 0,
      maxRetries,
      lastError: error ? String(error.message || error) : null,
      payload: safeSerialize(payload),
      lastAttemptAt: null,
      completedAt: null,
    });

    await auditService.record({
      operator,
      action: "INTEGRATION_JOB_CREATED",
      targetType: "INTEGRATION_JOB",
      targetId: job.id,
      result: status === JOB_STATUS.MANUAL_REVIEW ? "MANUAL_REVIEW" : "PENDING",
      details: {
        jobType,
        targetType,
        originalTargetId: targetId,
        status,
      },
      req,
    });

    return job;
  } catch (jobError) {
    console.error("Integration job write failed:", jobError.message);
    return null;
  }
}

async function listJobs(filters = {}) {
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.jobType) {
    where.jobType = filters.jobType;
  }
  if (filters.activeOnly) {
    where.status = {
      [Op.in]: [JOB_STATUS.PENDING, JOB_STATUS.FAILED, JOB_STATUS.MANUAL_REVIEW],
    };
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  const jobs = await IntegrationJob.findAll({
    where,
    order: [["createdAt", "DESC"]],
    limit,
  });

  return jobs.map((job) => serializeJob(job));
}

function contractSupportsMethod(name, inputCount = null) {
  const methods = contract?.options?.jsonInterface || [];
  return methods.some(
    (item) =>
      item.type === "function" &&
      item.name === name &&
      (inputCount === null || (item.inputs || []).length === inputCount)
  );
}

function getUpdateLock(transaction) {
  return transaction?.LOCK?.UPDATE;
}

async function retryPurchaseProduct(job, payload) {
  let txHash = payload?.txHash || null;
  let chainOrderId = Number(payload?.chainOrderId || 0) || null;

  return db.sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(payload.productId, {
      transaction,
      lock: getUpdateLock(transaction),
    });
    if (!product) {
      throw new Error("Product not found for purchase retry");
    }

    const buyer = await User.findByPk(payload.buyerId);
    if (!buyer) {
      throw new Error("Buyer not found for purchase retry");
    }

    if (!chainOrderId) {
      if (product.auditStatus !== 1) {
        throw new Error("Product is not available for purchase retry");
      }
      if (product.recallStatus) {
        throw new Error("Recalled products cannot be purchased");
      }
      if (product.stock <= 0) {
        throw new Error("Out of stock");
      }

      const seller = await User.findByPk(product.sellerId);
      const sellerSync = await syncSellerBlacklist(seller);
      if (sellerSync.isBlacklisted) {
        throw new Error("Seller is blacklisted");
      }

      const chainId = product.onChainId > 0 ? product.onChainId : product.id;
      const receipt = await sendContractTransaction({
        account: accounts.market,
        method: contract.methods.purchaseProduct(chainId, buyer.ethAddress),
        gas: 1200000,
        value: web3.utils.toWei(String(product.price), "ether"),
      });
      txHash = receipt.transactionHash;
      chainOrderId = parseInt(await contract.methods.orderCount().call(), 10);
    }

    let order = await Order.findOne({
      where: { onChainId: chainOrderId },
      transaction,
    });

    if (!order) {
      order = await Order.create(
        {
          productId: product.id,
          buyerId: buyer.id,
          price: payload.price ?? product.price,
          status: 0,
          paymentStatus: "paid",
          paymentMethod: "contract_escrow",
          paymentReference: `CHAIN_ORDER_${chainOrderId}`,
          paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date(),
          refundStatus: "none",
          refundAmount: 0,
          refundedAt: null,
          shippingStatus: "pending",
          onChainId: chainOrderId,
        },
        { transaction }
      );

      product.stock = product.stock - 1;
      await product.save({ transaction });
    }

    return {
      txHash,
      chainOrderId,
      orderId: order.id,
      productId: product.id,
    };
  });
}

async function retryRecallProduct(job, payload) {
  let txHash = payload?.txHash || null;

  return db.sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(payload.productId, {
      transaction,
      lock: getUpdateLock(transaction),
    });
    if (!product) {
      throw new Error("Product not found for recall retry");
    }

    if (!txHash) {
      const chainId = product.onChainId > 0 ? product.onChainId : product.id;
      const recallRiskLevel = 2;
      const receipt = await sendContractTransaction({
        account: accounts.regulator,
        method: contractSupportsMethod("flagProductRecall", 4)
          ? contract.methods.flagProductRecall(
              chainId,
              payload.reason,
              payload.batchNo || product.batchNo || "",
              recallRiskLevel
            )
          : contract.methods.delistProduct(chainId, `Recall: ${payload.reason}`),
        gas: 600000,
      });
      txHash = receipt.transactionHash;
    }

    product.recallStatus = true;
    product.recallReason = payload.reason;
    product.recallNoticeAt = payload.recallNoticeAt
      ? new Date(payload.recallNoticeAt)
      : new Date();
    product.recallBatchNo = payload.batchNo || product.batchNo || null;
    product.auditStatus = 2;
    product.stock = 0;
    product.delistReason = `Recall: ${payload.reason}`;
    product.delistedBy = payload.operatorId || product.delistedBy || null;
    product.delistedAt = payload.delistedAt ? new Date(payload.delistedAt) : new Date();
    await product.save({ transaction });

    const affectedOrders = await Order.findAll({
      where: { productId: product.id },
      transaction,
    });
    const existingNotifications = await RecallNotification.findAll({
      where: { productId: product.id },
      transaction,
    });
    const existingOrderIds = new Set(existingNotifications.map((item) => item.orderId));
    const notificationPayloads = affectedOrders
      .filter((order) => order.buyerId && !existingOrderIds.has(order.id))
      .map((order) => ({
        buyerId: order.buyerId,
        productId: product.id,
        orderId: order.id,
        status: "pending",
        notifiedAt: payload.recallNoticeAt ? new Date(payload.recallNoticeAt) : new Date(),
        viewedAt: null,
        acknowledgedAt: null,
      }));

    if (notificationPayloads.length > 0) {
      await RecallNotification.bulkCreate(notificationPayloads, { transaction });
    }

    return {
      txHash,
      productId: product.id,
    };
  });
}

async function runRetry(job) {
  const payload = parsePayload(job.payload) || {};

  if (job.jobType === JOB_TYPE.PURCHASE_PRODUCT) {
    return retryPurchaseProduct(job, payload);
  }
  if (job.jobType === JOB_TYPE.RECALL_PRODUCT) {
    return retryRecallProduct(job, payload);
  }

  throw new Error(`Retry is not supported for job type: ${job.jobType}`);
}

async function retryJob(job, { operator = null, req = null } = {}) {
  job.status = JOB_STATUS.RUNNING;
  job.retryCount = Number(job.retryCount || 0) + 1;
  job.lastAttemptAt = new Date();
  await job.save();

  try {
    const result = await runRetry(job);
    job.status = JOB_STATUS.COMPLETED;
    job.completedAt = new Date();
    job.lastError = null;
    job.payload = safeSerialize({
      ...(parsePayload(job.payload) || {}),
      lastReplayResult: result,
    });
    await job.save();

    await auditService.record({
      operator,
      action: "INTEGRATION_JOB_COMPLETED",
      targetType: "INTEGRATION_JOB",
      targetId: job.id,
      result: "SUCCESS",
      details: {
        jobType: job.jobType,
        replayResult: result,
      },
      req,
      txHash: result?.txHash || null,
    });

    return serializeJob(job);
  } catch (error) {
    job.status =
      job.jobType === JOB_TYPE.FILE_UPLOAD_FAILURE ? JOB_STATUS.MANUAL_REVIEW : JOB_STATUS.FAILED;
    job.lastError = String(error.message || error);
    await job.save();

    await auditService.record({
      operator,
      action: "INTEGRATION_JOB_RETRY_FAILED",
      targetType: "INTEGRATION_JOB",
      targetId: job.id,
      result: "FAIL",
      details: {
        jobType: job.jobType,
        error: job.lastError,
      },
      req,
    });

    throw error;
  }
}

module.exports = {
  JOB_STATUS,
  JOB_TYPE,
  createJob,
  listJobs,
  retryJob,
  serializeJob,
};
