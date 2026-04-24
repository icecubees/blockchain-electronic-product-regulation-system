const axios = require("axios");
const FormData = require("form-data");

const db = require("../models");
const auditService = require("../services/audit.service");
const integrationJobService = require("../services/integration-job.service");
const settingService = require("../services/system-setting.service");
const { syncSellerBlacklist } = require("../services/seller-blacklist.service");
const {
  web3,
  contract,
  accounts,
  CONTRACT_ADDRESS,
  sendContractTransaction,
} = require("../services/chain.service");

const Product = db.product;
const Order = db.order;
const User = db.user;
const AuditLog = db.auditLog;
const AfterSalesRecord = db.afterSalesRecord;
const AfterSalesRequest = db.afterSalesRequest;
const RecallNotification = db.recallNotification;
const Op = db.Sequelize.Op;

const ELECTRONIC_PRODUCT_CATEGORIES = [
  "mobile_phone",
  "laptop",
  "tablet",
  "earphone",
  "charger",
  "power_bank",
  "smart_watch",
  "camera",
  "router",
  "accessory",
];

const REVIEW_REASON_DEFINITIONS = [
  { code: "missing_ccc_information", label: "Missing CCC information" },
  { code: "missing_device_identifier", label: "Missing device identifier" },
  { code: "undisclosed_refurbished_status", label: "Undisclosed refurbished status" },
  { code: "battery_safety_concern", label: "Battery safety concern" },
  { code: "report_model_mismatch", label: "Report and declared model mismatch" },
  { code: "suspected_counterfeit", label: "Suspected counterfeit or unauthorized product" },
];

const REVIEW_REASON_CODE_SET = new Set(REVIEW_REASON_DEFINITIONS.map((item) => item.code));
const COMPLAINT_TYPE_OPTIONS = new Set([
  "battery_issue",
  "counterfeit_suspected",
  "refurbished_not_disclosed",
  "serial_number_mismatch",
  "performance_issue",
  "accessory_mismatch",
  "safety_risk",
]);
const AFTER_SALES_TYPE_OPTIONS = new Set([
  "warranty_claim",
  "repair",
  "component_replacement",
  "quality_refund",
]);
const DIRECT_COMPLAINT_TYPE_OPTIONS = new Set([
  "battery_issue",
  "counterfeit_suspected",
  "refurbished_not_disclosed",
  "serial_number_mismatch",
  "safety_risk",
]);
const AFTER_SALES_REQUEST_STATUSES = new Set([
  "pending_seller",
  "seller_responded",
  "escalated_to_complaint",
  "closed",
]);
const RECALL_NOTIFICATION_STATUSES = new Set(["pending", "viewed", "acknowledged", "closed"]);
const PRIVILEGED_ROLE = "regulator";

function isPrivilegedUserRole(role) {
  return role === PRIVILEGED_ROLE;
}

function normalizeOptionalString(value, fallback = null) {
  if (value === undefined) {
    return fallback;
  }

  const normalized = String(value ?? "").trim();
  return normalized ? normalized : null;
}

function parseReasonCodes(input) {
  if (input === undefined || input === null || input === "") {
    return [];
  }

  let values = input;
  if (typeof input === "string") {
    try {
      values = JSON.parse(input);
    } catch (error) {
      values = String(input)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  if (!Array.isArray(values)) {
    values = [values];
  }

  const normalized = values
    .map((item) => String(item || "").trim())
    .filter((item) => REVIEW_REASON_CODE_SET.has(item));

  return Array.from(new Set(normalized));
}

function normalizeComplaintType(value, fallback = null) {
  const normalized = normalizeOptionalString(value, fallback);
  if (!normalized) {
    return normalized;
  }

  return COMPLAINT_TYPE_OPTIONS.has(normalized) ? normalized : fallback;
}

function normalizeAfterSalesType(value, fallback = null) {
  const normalized = normalizeOptionalString(value, fallback);
  if (!normalized) {
    return normalized;
  }

  return AFTER_SALES_TYPE_OPTIONS.has(normalized) ? normalized : fallback;
}

function normalizeAfterSalesRequestStatus(value, fallback = null) {
  const normalized = normalizeOptionalString(value, fallback);
  if (!normalized) {
    return normalized;
  }

  return AFTER_SALES_REQUEST_STATUSES.has(normalized) ? normalized : fallback;
}

function normalizeOptionalDate(value, fallback = null) {
  if (value === undefined) {
    return fallback;
  }

  if (value === null || value === "") {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function normalizeBooleanInput(value, fallback = null) {
  if (value === undefined) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "n", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
}

function normalizeBatteryHealth(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function normalizeCategory(value, fallback = null) {
  const normalized = normalizeOptionalString(value, fallback);
  if (!normalized) {
    return normalized;
  }

  return normalized.toLowerCase();
}

function parseBooleanQuery(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return normalizeBooleanInput(value, null);
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

function hashSummaryValue(value) {
  const normalized = normalizeOptionalString(value, null);
  if (!normalized) {
    return null;
  }

  return web3.utils.soliditySha3({ type: "string", value: normalized });
}

function deriveRiskLevel(product) {
  if (product.recallStatus) {
    return 2;
  }
  if (product.batterySafetyPassed === false || product.chargerSafetyPassed === false) {
    return 2;
  }
  if (product.inspectionConclusion === "fail") {
    return 2;
  }
  if (
    product.isUsed ||
    product.isRefurbished ||
    product.inspectionConclusion === "conditional_pass"
  ) {
    return 1;
  }

  return 0;
}

function validateElectronicFields(fields) {
  if (fields.category && !ELECTRONIC_PRODUCT_CATEGORIES.includes(fields.category)) {
    return `Unsupported category. Allowed values: ${ELECTRONIC_PRODUCT_CATEGORIES.join(", ")}`;
  }

  if (
    fields.batteryHealth !== null &&
    fields.batteryHealth !== undefined &&
    (!Number.isInteger(fields.batteryHealth) || fields.batteryHealth < 0 || fields.batteryHealth > 100)
  ) {
    return "Battery health must be an integer between 0 and 100";
  }

  return null;
}

function buildElectronicReviewChecklist(product) {
  const issues = [];

  if (["mobile_phone", "tablet"].includes(product.category)) {
    if (!normalizeOptionalString(product.brand, null)) {
      issues.push("Brand is required for mobile phones and tablets");
    }
    if (!normalizeOptionalString(product.model, null)) {
      issues.push("Model is required for mobile phones and tablets");
    }
    if (!normalizeOptionalString(product.serialNumber, null)) {
      issues.push("Serial number or IMEI is required for mobile phones and tablets");
    }
  }

  if (["charger", "power_bank"].includes(product.category)) {
    if (!normalizeOptionalString(product.cccNumber, null)) {
      issues.push("CCC number is required for chargers and power banks");
    }

    if (product.chargerSafetyPassed !== true && product.batterySafetyPassed !== true) {
      issues.push("At least one charger or battery safety check must be marked as passed");
    }
  }

  if (product.isUsed === true || product.isRefurbished === true) {
    if (!normalizeOptionalString(product.appearanceGrade, null)) {
      issues.push("Appearance grade is required for used or refurbished devices");
    }
    if (product.repairHistoryDeclared === null || product.repairHistoryDeclared === undefined) {
      issues.push("Repair history declaration is required for used or refurbished devices");
    }
  }

  return issues;
}

function getSuggestedReasonCodes(product, issues = []) {
  const suggestions = new Set();

  if (issues.some((item) => item.toLowerCase().includes("ccc"))) {
    suggestions.add("missing_ccc_information");
  }
  if (issues.some((item) => item.toLowerCase().includes("serial number") || item.toLowerCase().includes("imei"))) {
    suggestions.add("missing_device_identifier");
  }
  if ((product.isUsed || product.isRefurbished) && (product.repairHistoryDeclared === null || product.repairHistoryDeclared === undefined)) {
    suggestions.add("undisclosed_refurbished_status");
  }
  if (product.batterySafetyPassed === false || product.chargerSafetyPassed === false) {
    suggestions.add("battery_safety_concern");
  }

  return Array.from(suggestions);
}

function attachReviewInsights(product) {
  const missingReviewItems = buildElectronicReviewChecklist(product);
  product.dataValues.missingReviewItems = missingReviewItems;
  product.dataValues.suggestedReasonCodes = getSuggestedReasonCodes(product, missingReviewItems);
  product.dataValues.auditReasonCodes = parseReasonCodes(product.auditReasonCodes);
  return product;
}

function buildCreateProductMethod(productPayload, sellerWallet) {
  if (contractSupportsMethod("createProduct", 12)) {
    return contract.methods.createProduct(
      productPayload.name,
      web3.utils.toWei(productPayload.price.toString(), "ether"),
      productPayload.ipfsHash || "NoReport",
      productPayload.qualificationHash || "NoCert",
      productPayload.stock,
      sellerWallet,
      productPayload.brand || "",
      productPayload.model || "",
      productPayload.category || "",
      hashSummaryValue(productPayload.serialNumber) || "",
      hashSummaryValue(productPayload.cccNumber) || "",
      deriveRiskLevel(productPayload)
    );
  }

  return contract.methods.createProduct(
    productPayload.name,
    web3.utils.toWei(productPayload.price.toString(), "ether"),
    productPayload.ipfsHash || "NoReport",
    productPayload.qualificationHash || "NoCert",
    productPayload.stock,
    sellerWallet
  );
}

async function syncExtendedChainLifecycle(product, operatorAccount) {
  const chainId = product.onChainId > 0 ? product.onChainId : product.id;
  const txHashes = {};

  if (contractSupportsMethod("updateProductCompliance", 4)) {
    const receipt = await sendContractTransaction({
      account: operatorAccount,
      method: contract.methods.updateProductCompliance(
        chainId,
        product.category || "",
        hashSummaryValue(product.cccNumber) || "",
        deriveRiskLevel(product)
      ),
      gas: 700000,
    });
    txHashes.compliance = receipt.transactionHash;
  }

  if (product.isRefurbished && contractSupportsMethod("declareProductRefurbish", 3)) {
    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.declareProductRefurbish(
        chainId,
        deriveRiskLevel(product),
        product.description || "Refurbished device declared"
      ),
      gas: 600000,
    });
    txHashes.refurbish = receipt.transactionHash;
  }

  return txHashes;
}

async function recordLifecycleAuditEntries({ product, operator, req, txHashes = {} }) {
  await auditService.record({
    operator,
    action: "PRODUCT_COMPLIANCE_UPDATED",
    targetType: "PRODUCT",
    targetId: product.id,
    result: "SUCCESS",
    details: {
      category: product.category,
      cccNumberHash: hashSummaryValue(product.cccNumber),
      riskLevel: deriveRiskLevel(product),
    },
    req,
    txHash: txHashes.compliance,
  });

  if (product.isRefurbished) {
    await auditService.record({
      operator,
      action: "PRODUCT_REFURBISH_DECLARED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: {
        riskLevel: deriveRiskLevel(product),
        appearanceGrade: product.appearanceGrade,
      },
      req,
      txHash: txHashes.refurbish,
    });
  }

  if (product.warrantyUntil) {
    await auditService.record({
      operator,
      action: "WARRANTY_UPDATED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: {
        warrantyUntil: product.warrantyUntil,
      },
      req,
    });
  }
}

function buildElectronicProductFields(input, currentProduct = null) {
  return {
    brand: normalizeOptionalString(input.brand, currentProduct?.brand ?? null),
    model: normalizeOptionalString(input.model, currentProduct?.model ?? null),
    category: normalizeCategory(input.category, currentProduct?.category ?? null),
    serialNumber: normalizeOptionalString(input.serialNumber, currentProduct?.serialNumber ?? null),
    batchNo: normalizeOptionalString(input.batchNo, currentProduct?.batchNo ?? null),
    manufactureDate: normalizeOptionalDate(
      input.manufactureDate,
      currentProduct?.manufactureDate ?? null
    ),
    warrantyUntil: normalizeOptionalDate(
      input.warrantyUntil,
      currentProduct?.warrantyUntil ?? null
    ),
    isUsed: normalizeBooleanInput(input.isUsed, currentProduct?.isUsed ?? false),
    isRefurbished: normalizeBooleanInput(
      input.isRefurbished,
      currentProduct?.isRefurbished ?? false
    ),
    batteryHealth: normalizeBatteryHealth(input.batteryHealth, currentProduct?.batteryHealth ?? null),
    accessoryStatus: normalizeOptionalString(
      input.accessoryStatus,
      currentProduct?.accessoryStatus ?? null
    ),
    cccNumber: normalizeOptionalString(input.cccNumber, currentProduct?.cccNumber ?? null),
    energyLevel: normalizeOptionalString(input.energyLevel, currentProduct?.energyLevel ?? null),
    rohsStatus: normalizeOptionalString(input.rohsStatus, currentProduct?.rohsStatus ?? null),
    inspectionAgency: normalizeOptionalString(
      input.inspectionAgency,
      currentProduct?.inspectionAgency ?? null
    ),
    inspectionDate: normalizeOptionalDate(
      input.inspectionDate,
      currentProduct?.inspectionDate ?? null
    ),
    inspectionConclusion: normalizeOptionalString(
      input.inspectionConclusion,
      currentProduct?.inspectionConclusion ?? null
    ),
    batterySafetyPassed: normalizeBooleanInput(
      input.batterySafetyPassed,
      currentProduct?.batterySafetyPassed ?? null
    ),
    chargerSafetyPassed: normalizeBooleanInput(
      input.chargerSafetyPassed,
      currentProduct?.chargerSafetyPassed ?? null
    ),
    appearanceGrade: normalizeOptionalString(
      input.appearanceGrade,
      currentProduct?.appearanceGrade ?? null
    ),
    functionalTestPassed: normalizeBooleanInput(
      input.functionalTestPassed,
      currentProduct?.functionalTestPassed ?? null
    ),
    repairHistoryDeclared: normalizeBooleanInput(
      input.repairHistoryDeclared,
      currentProduct?.repairHistoryDeclared ?? null
    ),
  };
}

function maskIdentifier(value) {
  const normalized = normalizeOptionalString(value, null);
  if (!normalized) {
    return null;
  }

  if (normalized.length <= 6) {
    return normalized;
  }

  return `${normalized.slice(0, 3)}***${normalized.slice(-3)}`;
}

function buildAiAuditPayload(productPayload = {}, description = "") {
  return {
    name: productPayload?.name || "",
    description: description || productPayload?.description || "",
    brand: productPayload?.brand || "",
    model: productPayload?.model || "",
    category: productPayload?.category || "",
    serialNumber: productPayload?.serialNumber || "",
    batchNo: productPayload?.batchNo || "",
    isUsed: productPayload?.isUsed,
    isRefurbished: productPayload?.isRefurbished,
    batteryHealth: productPayload?.batteryHealth,
    accessoryStatus: productPayload?.accessoryStatus || "",
    cccNumber: productPayload?.cccNumber || "",
    energyLevel: productPayload?.energyLevel || "",
    rohsStatus: productPayload?.rohsStatus || "",
    inspectionAgency: productPayload?.inspectionAgency || "",
    inspectionConclusion: productPayload?.inspectionConclusion || "",
    batterySafetyPassed: productPayload?.batterySafetyPassed,
    chargerSafetyPassed: productPayload?.chargerSafetyPassed,
    appearanceGrade: productPayload?.appearanceGrade || "",
    functionalTestPassed: productPayload?.functionalTestPassed,
    repairHistoryDeclared: productPayload?.repairHistoryDeclared,
  };
}

function normalizeAiAssessment(responseData = {}) {
  const label = String(responseData?.label || responseData?.result || "FAIL").toUpperCase();
  const safeLabel = ["PASS", "REVIEW", "FAIL"].includes(label) ? label : "FAIL";

  return {
    label: safeLabel,
    result: safeLabel === "PASS" ? "PASS" : "FAIL",
    confidence: Number(responseData?.confidence || 0),
    passProbability: Number(responseData?.pass_probability || 0),
    reasonHints: Array.isArray(responseData?.reason_hints) ? responseData.reason_hints : [],
    modelVersion: responseData?.model_version || null,
    shouldBlock: safeLabel === "FAIL",
    requiresManualReview: safeLabel === "REVIEW",
    isApprovedLike: safeLabel !== "FAIL",
  };
}

async function callAiAuditService(description, uploadedFile, productPayload = null) {
  try {
    const form = new FormData();

    if (uploadedFile?.buffer) {
      form.append("file", uploadedFile.buffer, {
        filename: uploadedFile.originalname || "report.pdf",
        contentType: uploadedFile.mimetype || "application/pdf",
      });
    } else {
      form.append("file", Buffer.from(description || "", "utf-8"), {
        filename: "description.txt",
        contentType: "text/plain",
      });
    }

    if (productPayload) {
      form.append("payload", JSON.stringify(buildAiAuditPayload(productPayload, description)));
    }

    const response = await axios.post("http://127.0.0.1:5000/audit", form, {
      headers: { ...form.getHeaders() },
      maxBodyLength: Infinity,
    });

    return normalizeAiAssessment(response.data);
  } catch (error) {
    console.error("AI service call failed:", error.message);
    return {
      label: "UNAVAILABLE",
      result: "UNAVAILABLE",
      confidence: 0,
      passProbability: 0,
      reasonHints: [],
      modelVersion: null,
      shouldBlock: false,
      requiresManualReview: true,
      isApprovedLike: false,
      serviceUnavailable: true,
    };
  }
}

function isAiServiceUnavailable(aiAssessment) {
  return Boolean(aiAssessment?.serviceUnavailable);
}

function buildAiDisabledAssessment() {
  return {
    label: "DISABLED",
    result: "DISABLED",
    confidence: 0,
    passProbability: 0,
    reasonHints: [],
    modelVersion: null,
    shouldBlock: false,
    requiresManualReview: true,
    isApprovedLike: true,
    disabledByRegulator: true,
  };
}

function signAiAuditResult(productId, isPass) {
  const payloadHash = web3.utils.soliditySha3(
    { type: "uint256", value: Number(productId) },
    { type: "bool", value: Boolean(isPass) }
  );

  const signature = web3.eth.accounts.sign(payloadHash, accounts.aiOracle.privateKey).signature;
  return { payloadHash, signature, oracleAddress: accounts.aiOracle.address };
}

async function getSellerTransactionCount(sellerId) {
  return Order.count({
    include: [
      {
        model: Product,
        as: "product",
        where: { sellerId },
      },
    ],
    where: {
      status: { [Op.in]: [1, 2] },
    },
  });
}

async function enrichSellerReputation(product) {
  const sellerSync = await syncSellerBlacklist(product.seller);
  product.dataValues.sellerScore = sellerSync.reputationScore;
  product.dataValues.sellerChainBlacklisted = sellerSync.isBlacklisted;

  try {
    product.dataValues.sellerTxCount = await getSellerTransactionCount(product.seller.id);
  } catch (error) {
    product.dataValues.sellerTxCount = 0;
  }
}

async function buildProductRiskProfile(product, sellerSync = null) {
  const [complaintCount, refundCount, repairCount, reusedCccCount, reusedSerialCount, sellerProfile] =
    await Promise.all([
      Order.count({
        where: {
          productId: product.id,
          status: {
            [Op.in]: [3, 4],
          },
        },
      }),
      Order.count({
        where: {
          productId: product.id,
          status: 4,
        },
      }),
      AfterSalesRecord
        ? AfterSalesRecord.count({
            where: {
              productId: product.id,
            },
          })
        : Promise.resolve(0),
      product.cccNumber
        ? Product.count({
            where: {
              cccNumber: product.cccNumber,
              id: {
                [Op.ne]: product.id,
              },
            },
          })
        : Promise.resolve(0),
      product.serialNumber
        ? Product.count({
            where: {
              serialNumber: product.serialNumber,
              id: {
                [Op.ne]: product.id,
              },
            },
          })
        : Promise.resolve(0),
      sellerSync
        ? Promise.resolve(sellerSync)
        : product.seller
          ? syncSellerBlacklist(product.seller)
          : Promise.resolve({ isBlacklisted: false, reputationScore: 60 }),
    ]);

  const riskTags = [];
  if (complaintCount >= 2) {
    riskTags.push("high_complaint_frequency");
  }
  if (refundCount >= 1) {
    riskTags.push("refund_history");
  }
  if (reusedCccCount > 0) {
    riskTags.push("reused_ccc_number");
  }
  if (reusedSerialCount > 0) {
    riskTags.push("reused_serial_pattern");
  }
  if (repairCount >= 2) {
    riskTags.push("frequent_after_sales");
  }
  if (product.recallStatus) {
    riskTags.push("recalled_device");
  }
  if (sellerProfile?.isBlacklisted) {
    riskTags.push("seller_blacklisted");
  }
  if (product.isRefurbished && product.repairHistoryDeclared !== true) {
    riskTags.push("refurbish_disclosure_gap");
  }

  let riskLevel = "low";
  if (
    riskTags.some((tag) =>
      ["recalled_device", "seller_blacklisted", "reused_serial_pattern"].includes(tag)
    ) || refundCount >= 2
  ) {
    riskLevel = "high";
  } else if (riskTags.length > 0 || complaintCount >= 1) {
    riskLevel = "medium";
  }

  return {
    riskLevel,
    riskTags,
    complaintCount,
    refundCount,
    repairCount,
    reusedCccCount,
    reusedSerialCount,
  };
}

async function attachDerivedRiskProfile(product) {
  const sellerSync = {
    isBlacklisted: Boolean(product.dataValues?.sellerChainBlacklisted || product.seller?.isBlacklisted),
    reputationScore: product.dataValues?.sellerScore ?? 60,
  };
  product.dataValues.riskProfile = await buildProductRiskProfile(product, sellerSync);
  return product;
}

async function getChainProductSnapshot(product) {
  const fallbackChainId = product.onChainId > 0 ? product.onChainId : product.id;
  const fallback = {
    chainProductId: fallbackChainId,
    isAudited: product.auditStatus === 1,
    isDelisted: product.auditStatus === 2 && product.stock <= 0,
    stock: product.stock,
    sellerWallet: product.seller?.ethAddress || null,
    brand: product.brand || null,
    model: product.model || null,
    category: product.category || null,
    deviceIdHash: hashSummaryValue(product.serialNumber),
    cccNumberHash: hashSummaryValue(product.cccNumber),
    riskLevel: deriveRiskLevel(product),
    recallFlag: Boolean(product.recallStatus),
    exists: false,
    source: "db_derived",
  };

  try {
    const chainProduct = await contract.methods.products(fallbackChainId).call();
    if (!chainProduct || !chainProduct.exists) {
      return fallback;
    }

    return {
      chainProductId: parseInt(chainProduct.id, 10) || fallbackChainId,
      isAudited: Boolean(chainProduct.isAudited),
      isDelisted: Boolean(chainProduct.isDelisted),
      stock: parseInt(chainProduct.stock, 10) || 0,
      sellerWallet: chainProduct.seller || fallback.sellerWallet,
      brand: chainProduct.brand || fallback.brand,
      model: chainProduct.model || fallback.model,
      category: chainProduct.category || fallback.category,
      deviceIdHash: chainProduct.deviceIdHash || fallback.deviceIdHash,
      cccNumberHash: chainProduct.cccNumberHash || fallback.cccNumberHash,
      riskLevel:
        chainProduct.riskLevel !== undefined && chainProduct.riskLevel !== null
          ? parseInt(chainProduct.riskLevel, 10)
          : fallback.riskLevel,
      recallFlag:
        chainProduct.recallFlag !== undefined && chainProduct.recallFlag !== null
          ? Boolean(chainProduct.recallFlag)
          : fallback.recallFlag,
      exists: Boolean(chainProduct.exists),
      source:
        chainProduct.brand ||
        chainProduct.model ||
        chainProduct.category ||
        chainProduct.deviceIdHash ||
        chainProduct.cccNumberHash ||
        chainProduct.recallFlag !== undefined
          ? "chain_extended"
          : "chain_legacy",
    };
  } catch (error) {
    return fallback;
  }
}

async function buildProductTraceDetails(product) {
  const [orders, afterSalesRecords] = await Promise.all([
    Order.findAll({
      where: { productId: product.id },
      include: [
        {
          model: User,
          as: "buyer",
          attributes: ["id", "username"],
        },
        {
          model: RecallNotification,
          as: "recallNotifications",
        },
      ],
      order: [["createdAt", "ASC"]],
    }),
    AfterSalesRecord
      ? AfterSalesRecord.findAll({
          where: { productId: product.id },
          include: [
            {
              model: User,
              as: "creator",
              attributes: ["id", "username", "role"],
            },
          ],
          order: [["createdAt", "ASC"]],
        })
      : Promise.resolve([]),
  ]);

  const orderIdStrings = orders.map((order) => String(order.id));
  const productTargetId = String(product.id);

  const [sellerSync, chainSnapshot, sellerTxCount, traceLogs, reviewer, riskProfile] = await Promise.all([
    syncSellerBlacklist(product.seller),
    getChainProductSnapshot(product),
    getSellerTransactionCount(product.seller.id),
    AuditLog.findAll({
      where: {
        [Op.or]: [
          {
            targetType: "PRODUCT",
            targetId: productTargetId,
          },
          ...(orderIdStrings.length > 0
            ? [
                {
                  targetType: "ORDER",
                  targetId: {
                    [Op.in]: orderIdStrings,
                  },
                },
              ]
            : []),
        ],
      },
      order: [["createdAt", "ASC"]],
    }),
    product.auditBy
      ? User.findByPk(product.auditBy, { attributes: ["id", "username", "role"] })
      : Promise.resolve(null),
    buildProductRiskProfile(product),
  ]);

  const complaintCount = orders.filter((order) => [3, 4].includes(order.status)).length;
  const normalizedTimeline = traceLogs
    .map((log) => ({
      id: log.id,
      entityType: log.targetType,
      entityId: log.targetId,
      action: log.action,
      result: log.result,
      details: log.details,
      txHash: log.txHash,
      ipfsHash: log.ipfsHash,
      createdAt: log.createdAt,
    }))
    .sort((left, right) => new Date(left.createdAt) - new Date(right.createdAt));

  return {
    productId: product.id,
    chainProductId: chainSnapshot.chainProductId,
    name: product.name,
    description: product.description,
    brand: product.brand,
    model: product.model,
    category: product.category,
    serialNumberMasked: maskIdentifier(product.serialNumber),
    batchNo: product.batchNo,
    manufactureDate: product.manufactureDate,
    warrantyUntil: product.warrantyUntil,
    isUsed: Boolean(product.isUsed),
    isRefurbished: Boolean(product.isRefurbished),
    batteryHealth: product.batteryHealth,
    accessoryStatus: product.accessoryStatus,
    cccNumber: product.cccNumber,
    energyLevel: product.energyLevel,
    rohsStatus: product.rohsStatus,
    compliance: {
      inspectionAgency: product.inspectionAgency,
      inspectionDate: product.inspectionDate,
      inspectionConclusion: product.inspectionConclusion,
      batterySafetyPassed: product.batterySafetyPassed,
      chargerSafetyPassed: product.chargerSafetyPassed,
      appearanceGrade: product.appearanceGrade,
      functionalTestPassed: product.functionalTestPassed,
      repairHistoryDeclared: product.repairHistoryDeclared,
    },
    review: {
      reasonCodes: parseReasonCodes(product.auditReasonCodes),
      reasonCodeOptions: REVIEW_REASON_DEFINITIONS,
      missingReviewItems: buildElectronicReviewChecklist(product),
    },
    recall: {
      recallStatus: Boolean(product.recallStatus),
      recallReason: product.recallReason,
      recallNoticeAt: product.recallNoticeAt,
      recallBatchNo: product.recallBatchNo,
    },
    price: product.price,
    stock: product.stock,
    auditStatus: product.auditStatus,
    auditReason: product.auditReason,
    ipfsHash: product.ipfsHash,
    qualificationHash: product.qualificationHash,
    txHash: product.txHash,
    createdAt: product.createdAt,
    auditAt: product.auditAt,
    delistedAt: product.delistedAt,
    delistReason: product.delistReason,
    seller: {
      id: product.seller.id,
      username: product.seller.username,
      ethAddress: product.seller.ethAddress,
      isBlacklisted: sellerSync.isBlacklisted,
      reputationScore: sellerSync.reputationScore,
      completedTransactionCount: sellerTxCount,
      qualificationType: product.seller.qualificationType || null,
    },
    reviewer: reviewer
      ? {
          id: reviewer.id,
          username: reviewer.username,
          role: reviewer.role,
        }
      : null,
    chain: chainSnapshot,
    chainSummary: {
      brand: chainSnapshot.brand,
      model: chainSnapshot.model,
      category: chainSnapshot.category,
      deviceIdHash: chainSnapshot.deviceIdHash,
      cccNumberHash: chainSnapshot.cccNumberHash,
      riskLevel: chainSnapshot.riskLevel,
      recallFlag: chainSnapshot.recallFlag,
    },
    metrics: {
      orderCount: orders.length,
      complaintCount,
    },
    riskProfile,
    orders: orders.map((order) => ({
      id: order.id,
      onChainId: order.onChainId,
      buyer: order.buyer
        ? {
            id: order.buyer.id,
            username: order.buyer.username,
          }
        : null,
      price: order.price,
      status: order.status,
      shippingStatus: order.shippingStatus,
      trackingNumber: order.trackingNumber,
      shippingCarrier: order.shippingCarrier,
      shippedAt: order.shippedAt,
      buyerConfirmedAt: order.buyerConfirmedAt,
      rating: order.rating,
      comment: order.comment,
      complaintType: order.complaintType,
      complaintReason: order.complaintReason,
      evidenceIpfsHash: order.evidenceIpfsHash,
      sellerResponse: order.sellerResponse,
      sellerEvidenceIpfsHash: order.sellerEvidenceIpfsHash,
      sellerRespondedAt: order.sellerRespondedAt,
      rulingForBuyer: order.rulingForBuyer,
      rulingDetails: order.rulingDetails,
      recallNotifications: Array.isArray(order.recallNotifications)
        ? order.recallNotifications.map((notification) => serializeRecallNotification(notification))
        : [],
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    })),
    afterSalesRecords: afterSalesRecords.map((record) => ({
      ...serializeAfterSalesRecord(record),
    })),
    timeline: normalizedTimeline,
  };
}

function serializeAfterSalesRecord(record) {
  return {
    id: record.id,
    orderId: record.orderId,
    productId: record.productId,
    type: record.type,
    componentName: record.componentName,
    description: record.description,
    serviceResult: record.serviceResult,
    evidenceIpfsHash: record.evidenceIpfsHash,
    createdAt: record.createdAt,
    creator: record.creator
      ? {
          id: record.creator.id,
          username: record.creator.username,
          role: record.creator.role,
        }
      : null,
  };
}

function serializeAfterSalesRequest(request) {
  return {
    id: request.id,
    orderId: request.orderId,
    productId: request.productId,
    buyerId: request.buyerId,
    type: request.type,
    description: request.description,
    evidenceIpfsHash: request.evidenceIpfsHash,
    status: request.status,
    sellerResponse: request.sellerResponse,
    sellerEvidenceIpfsHash: request.sellerEvidenceIpfsHash,
    sellerRespondedAt: request.sellerRespondedAt,
    escalatedAt: request.escalatedAt,
    escalatedBy: request.escalatedBy,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    buyer: request.buyer
      ? {
          id: request.buyer.id,
          username: request.buyer.username,
          role: request.buyer.role,
        }
      : null,
  };
}

function serializeRecallNotification(notification) {
  return {
    id: notification.id,
    buyerId: notification.buyerId,
    productId: notification.productId,
    orderId: notification.orderId,
    status: notification.status,
    notifiedAt: notification.notifiedAt,
    viewedAt: notification.viewedAt,
    acknowledgedAt: notification.acknowledgedAt,
    product: notification.product
      ? {
          id: notification.product.id,
          name: notification.product.name,
          recallStatus: notification.product.recallStatus,
          recallReason: notification.product.recallReason,
          recallNoticeAt: notification.product.recallNoticeAt,
          recallBatchNo: notification.product.recallBatchNo,
        }
      : null,
    order: notification.order
      ? {
          id: notification.order.id,
          status: notification.order.status,
          shippingStatus: notification.order.shippingStatus,
        }
      : null,
  };
}

function canEnterComplaintFlow(order) {
  return [0, 1, 2].includes(order.status);
}

async function findOrderAfterSalesRequest(orderId, buyerId) {
  return AfterSalesRequest.findOne({
    where: {
      orderId,
      buyerId,
      status: {
        [Op.in]: ["pending_seller", "seller_responded", "closed", "escalated_to_complaint"],
      },
    },
    order: [["createdAt", "DESC"]],
  });
}

async function openComplaintForOrder({
  order,
  buyer,
  complaintType,
  reason,
  evidenceIpfsHash = null,
  req,
  auditDetails = {},
}) {
  const complaintText = evidenceIpfsHash
    ? `[${complaintType}] ${reason} (Evidence: ipfs://${evidenceIpfsHash})`
    : `[${complaintType}] ${reason}`;

  const receipt = await sendContractTransaction({
    account: accounts.market,
    method: contract.methods.raiseComplaint(
      getOrderChainId(order),
      buyer.ethAddress,
      complaintText
    ),
    gas: 600000,
  });

  order.status = 3;
  order.complaintType = complaintType;
  order.complaintReason = reason;
  order.evidenceIpfsHash = evidenceIpfsHash || null;
  order.refundStatus = "pending_review";
  order.sellerResponse = null;
  order.sellerEvidenceIpfsHash = null;
  order.sellerRespondedAt = null;
  await order.save();

  await auditService.record({
    operator: req.user,
    action: "COMPLAINT_RAISED",
    targetType: "ORDER",
    targetId: order.id,
    result: "SUCCESS",
    details: {
      complaintType,
      evidenceIpfsHash: evidenceIpfsHash || null,
      ...auditDetails,
    },
    req,
    txHash: receipt.transactionHash,
    ipfsHash: evidenceIpfsHash || null,
  });

  return receipt;
}

function getOrderChainId(order) {
  return order.onChainId > 0 ? order.onChainId : order.id;
}

function addressesEqual(left, right) {
  if (!left || !right) {
    return false;
  }
  return String(left).toLowerCase() === String(right).toLowerCase();
}

function getOrderCreatedEventAbi() {
  return (contract?.options?.jsonInterface || []).find(
    (item) => item.type === "event" && item.name === "OrderCreated"
  );
}

function getContractEventAbi(eventName) {
  return (contract?.options?.jsonInterface || []).find(
    (item) => item.type === "event" && item.name === eventName
  );
}

function decodeContractEvent(receipt, eventName) {
  const eventAbi = getContractEventAbi(eventName);
  if (!eventAbi || !receipt?.logs) {
    return null;
  }

  const signature = web3.eth.abi.encodeEventSignature(eventAbi);
  const eventLog = receipt.logs.find(
    (log) =>
      addressesEqual(log.address, CONTRACT_ADDRESS) &&
      Array.isArray(log.topics) &&
      addressesEqual(log.topics[0], signature)
  );

  if (!eventLog) {
    return null;
  }

  return web3.eth.abi.decodeLog(eventAbi.inputs, eventLog.data, eventLog.topics.slice(1));
}

function decodeOrderCreatedEvent(receipt) {
  return decodeContractEvent(receipt, "OrderCreated");
}

function getUpdateLock(transaction) {
  return transaction?.LOCK?.UPDATE;
}

async function withTransaction(work) {
  return db.sequelize.transaction(async (transaction) => work(transaction));
}

async function findProductForUpdate(productId, transaction) {
  return Product.findByPk(productId, {
    transaction,
    lock: getUpdateLock(transaction),
  });
}

async function queueIntegrationJob({
  jobType,
  targetType,
  targetId = null,
  status = integrationJobService.JOB_STATUS.PENDING,
  payload = null,
  error,
  req,
}) {
  return integrationJobService.createJob({
    jobType,
    targetType,
    targetId,
    status,
    payload,
    error,
    operator: req?.user || null,
    req,
  });
}

function parseIntegerQuery(value, fallbackValue, options = {}) {
  if (value === undefined || value === null || value === "") {
    return fallbackValue;
  }

  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallbackValue;
  }

  if (typeof options.min === "number" && parsed < options.min) {
    return fallbackValue;
  }

  if (typeof options.max === "number" && parsed > options.max) {
    return fallbackValue;
  }

  return parsed;
}

function parseNumberQuery(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shouldUsePaginatedCollectionResponse(query = {}, keys = []) {
  return keys.some((key) => query[key] !== undefined);
}

function sendCollectionResponse(res, items, { page, pageSize, total }, usePaginatedResponse) {
  if (!usePaginatedResponse) {
    return res.send(items);
  }

  return res.send({
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(Math.ceil(total / pageSize), 1),
    },
  });
}

exports.getAllProducts = async (req, res) => {
  try {
    const page = parseIntegerQuery(req.query.page, 1, { min: 1 });
    const pageSize = parseIntegerQuery(req.query.pageSize, 12, { min: 1, max: 50 });
    const keyword = String(req.query.q || "").trim();
    const sellerId = parseIntegerQuery(req.query.sellerId, null, { min: 1 });
    const category = normalizeCategory(req.query.category, null);
    const brand = normalizeOptionalString(req.query.brand, null);
    const isUsed = parseBooleanQuery(req.query.isUsed);
    const isRefurbished = parseBooleanQuery(req.query.isRefurbished);
    const recallStatus = parseBooleanQuery(req.query.recallStatus);
    const cccStatus = normalizeOptionalString(req.query.cccStatus, null);
    const minPrice = parseNumberQuery(req.query.minPrice);
    const maxPrice = parseNumberQuery(req.query.maxPrice);
    const sortBy = String(req.query.sortBy || "latest");

    const where = {};

    if (recallStatus === true) {
      where.recallStatus = true;
    } else {
      where.auditStatus = 1;
      where.stock = { [Op.gt]: 0 };
      where.recallStatus = false;
    }

    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
      ];
    }

    if (sellerId) {
      where.sellerId = sellerId;
    }

    if (category) {
      where.category = category;
    }

    if (brand) {
      where.brand = { [Op.like]: `%${brand}%` };
    }

    if (isUsed !== null) {
      where.isUsed = isUsed;
    }

    if (isRefurbished !== null) {
      where.isRefurbished = isRefurbished;
    }

    if (cccStatus === "missing") {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [{ cccNumber: null }, { cccNumber: "" }],
        },
      ];
    } else if (cccStatus === "present") {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          cccNumber: {
            [Op.ne]: null,
          },
        },
        {
          cccNumber: {
            [Op.ne]: "",
          },
        },
      ];
    }

    if (minPrice !== null || maxPrice !== null) {
      where.price = {};
      if (minPrice !== null) {
        where.price[Op.gte] = minPrice;
      }
      if (maxPrice !== null) {
        where.price[Op.lte] = maxPrice;
      }
    }

    const orderOptions = {
      latest: [["createdAt", "DESC"]],
      price_asc: [["price", "ASC"]],
      price_desc: [["price", "DESC"]],
      stock_desc: [["stock", "DESC"]],
    };

    const order = orderOptions[sortBy] || orderOptions.latest;
    const offset = (page - 1) * pageSize;

    const queryResult = await Product.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["id", "username", "isBlacklisted", "ethAddress"],
        },
      ],
      order,
      offset,
      limit: pageSize,
    });

    await Promise.all(queryResult.rows.map(enrichSellerReputation));
    await Promise.all(queryResult.rows.map(attachDerivedRiskProfile));

    const activeProducts = queryResult.rows.filter(
      (product) => !product.dataValues.sellerChainBlacklisted && !product.seller.isBlacklisted
    );

    const totalPages = Math.max(1, Math.ceil(queryResult.count / pageSize));
    res.send({
      items: activeProducts,
      pagination: {
        page,
        pageSize,
        total: queryResult.count,
        totalPages,
      },
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getPendingProducts = async (req, res) => {
  try {
    const page = parseIntegerQuery(req.query.page, 1, { min: 1 });
    const pageSize = parseIntegerQuery(req.query.pageSize || req.query.limit, 20, {
      min: 1,
      max: 100,
    });
    const keyword = normalizeOptionalString(req.query.q, null);
    const category = normalizeCategory(req.query.category, null);
    const brand = normalizeOptionalString(req.query.brand, null);
    const sellerId = parseIntegerQuery(req.query.sellerId, null, { min: 1 });
    const usePaginatedResponse = shouldUsePaginatedCollectionResponse(req.query, [
      "page",
      "pageSize",
      "limit",
      "q",
      "category",
      "brand",
      "sellerId",
    ]);

    const where = { auditStatus: 0 };
    if (category) {
      where.category = category;
    }
    if (brand) {
      where.brand = { [Op.like]: `%${brand}%` };
    }
    if (keyword) {
      where[Op.or] = [
        { name: { [Op.like]: `%${keyword}%` } },
        { description: { [Op.like]: `%${keyword}%` } },
        { brand: { [Op.like]: `%${keyword}%` } },
        { model: { [Op.like]: `%${keyword}%` } },
        { serialNumber: { [Op.like]: `%${keyword}%` } },
      ];
    }

    const sellerInclude = {
      model: User,
      as: "seller",
      attributes: ["id", "username", "ethAddress"],
    };
    if (sellerId) {
      sellerInclude.where = { id: sellerId };
    }

    const query = {
      where,
      include: [sellerInclude],
      order: [["createdAt", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
    const products = await Product.findAll(query);
    const items = products.map(attachReviewInsights);

    if (!usePaginatedResponse) {
      return res.send(items);
    }

    const total = await Product.count({
      where,
      include: [sellerInclude.where ? { ...sellerInclude, attributes: [] } : sellerInclude],
      distinct: true,
      col: "id",
    });

    return sendCollectionResponse(res, items, { page, pageSize, total }, true);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getProductTrace = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.productId, {
      include: [
        {
          model: User,
          as: "seller",
          attributes: [
            "id",
            "username",
            "ethAddress",
            "isBlacklisted",
            "qualificationType",
          ],
        },
      ],
    });

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const traceDetails = await buildProductTraceDetails(product);
    return res.send(traceDetails);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getMyProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { sellerId: req.userId },
      order: [["createdAt", "DESC"]],
    });
    res.send(products.map(attachReviewInsights));
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.addProduct = async (req, res) => {
  try {
    const { name, price, description, ipfsHash, qualificationHash, stock, sellerWallet } = req.body;
    const seller = await User.findByPk(req.userId);
    const electronicFields = buildElectronicProductFields(req.body);
    const electronicValidationError = validateElectronicFields(electronicFields);

    if (!seller) {
      return res.status(404).send({ message: "Seller not found" });
    }
    if (seller.role !== "seller") {
      return res.status(403).send({ message: "Only sellers can publish products" });
    }
    if (seller.status !== 1) {
      return res.status(403).send({ message: "Seller account is not approved yet" });
    }
    const sellerSync = await syncSellerBlacklist(seller);
    if (sellerSync.isBlacklisted) {
      return res.status(403).send({ message: "Your account is blacklisted" });
    }
    if (electronicValidationError) {
      return res.status(400).send({ message: electronicValidationError });
    }

    const currentSellerWallet = sellerWallet || (seller.walletBound ? seller.ethAddress : null);
    if (!currentSellerWallet || !web3.utils.isAddress(currentSellerWallet)) {
      return res.status(400).send({ message: "Valid seller wallet is required" });
    }
    if (!addressesEqual(seller.ethAddress, currentSellerWallet)) {
      seller.ethAddress = currentSellerWallet;
    }
    seller.walletBound = true;
    if (typeof seller.save === "function") {
      await seller.save();
    }

    const aiAuditEnabled = await settingService.isAiAuditEnabled();
    const aiAssessment = aiAuditEnabled
      ? await callAiAuditService(description || "", req.file, {
          name,
          description,
          ...electronicFields,
        })
      : buildAiDisabledAssessment();
    const degradedToManualReview = isAiServiceUnavailable(aiAssessment);

    if (aiAssessment.shouldBlock) {
      const rejectedProduct = await Product.create({
        name,
        price,
        description,
        ipfsHash,
        qualificationHash,
        stock: parseInt(stock, 10),
        sellerId: seller.id,
        auditStatus: 2,
        auditReason: "AI 预审核判定该商品未通过。",
        onChainId: 0,
        txHash: "AI_REJECTED",
        ...electronicFields,
      });

      await auditService.record({
        operator: req.user,
        action: "PRODUCT_AI_REJECTED",
        targetType: "PRODUCT",
        targetId: rejectedProduct.id,
        result: "SUCCESS",
        details: {
          name,
          aiLabel: aiAssessment.label,
          aiConfidence: aiAssessment.confidence,
          aiPassProbability: aiAssessment.passProbability,
          aiReasonHints: aiAssessment.reasonHints,
          aiModelVersion: aiAssessment.modelVersion,
        },
        req,
      });

      return res.send({
        message: "AI 预审核判定该商品未通过。",
        aiAssessment,
        product: rejectedProduct,
      });
    }

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: buildCreateProductMethod(
        {
          name,
          price: Number(price),
          ipfsHash,
          qualificationHash,
          stock: parseInt(stock, 10),
          ...electronicFields,
        },
        currentSellerWallet
      ),
      gas: 2000000,
    });

    const chainProductId = parseInt(await contract.methods.productCount().call(), 10);
    const product = await Product.create({
      name,
      price,
      description,
      ipfsHash,
      qualificationHash,
      stock: parseInt(stock, 10),
      sellerId: seller.id,
      auditStatus: 0,
      auditReason: degradedToManualReview
        ? "AI 服务暂不可用，已转入人工审核。"
        : !aiAuditEnabled
        ? "监督方已关闭 AI 预审核，已转入人工审核。"
        : null,
      txHash: receipt.transactionHash,
      onChainId: chainProductId,
      ...electronicFields,
    });

    const lifecycleTxHashes = await syncExtendedChainLifecycle(product, accounts.regulator);

    await auditService.record({
      operator: req.user,
      action: "PRODUCT_CREATED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: {
        name,
        chainProductId,
        aiLabel: aiAssessment.label,
        aiConfidence: aiAssessment.confidence,
        aiPassProbability: aiAssessment.passProbability,
        aiReasonHints: aiAssessment.reasonHints,
        aiModelVersion: aiAssessment.modelVersion,
        aiAuditEnabled,
      },
      req,
      txHash: receipt.transactionHash,
    });

    if (!aiAuditEnabled) {
      await auditService.record({
        operator: req.user,
        action: "PRODUCT_AI_SKIPPED_BY_SETTING",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          source: "create",
          name,
          reason: "监督方已关闭 AI 预审核",
        },
        req,
      });
    }

    if (degradedToManualReview) {
      await auditService.record({
        operator: req.user,
        action: "PRODUCT_AI_DEGRADED_TO_MANUAL_REVIEW",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          source: "create",
          name,
          reason: "AI 服务暂不可用",
        },
        req,
      });
    }

    res.send({
      message: degradedToManualReview
        ? "AI 预审核暂不可用，商品已转入人工审核。"
        : !aiAuditEnabled
        ? "监督方已关闭 AI 预审核，商品已转入人工审核。"
        : aiAssessment.requiresManualReview
        ? "AI 预审核建议人工复核，等待监督方审核。"
        : "AI 预审核通过，等待监督方审核。",
      aiAssessment,
      product,
    });
  } catch (error) {
    console.error("Add product failed:", error);
    res.status(500).send({ message: error.message });
  }
};

exports.auditProduct = async (req, res) => {
  try {
    const { productId, reason, decision } = req.body;
    const product = await Product.findByPk(productId);
    const reviewReason = String(reason || "").trim();
    const reasonCodes = parseReasonCodes(req.body.reasonCodes);

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    if (product.auditStatus !== 0) {
      return res.status(400).send({ message: "Only pending products can be audited" });
    }
    if (!reviewReason) {
      return res.status(400).send({ message: "Review reason is required" });
    }

    const requestedDecision = Number(decision);
    if (![0, 1].includes(requestedDecision)) {
      return res.status(400).send({ message: "Invalid review decision" });
    }
    const missingReviewItems =
      requestedDecision === 1 ? buildElectronicReviewChecklist(product) : [];
    if (requestedDecision === 1 && missingReviewItems.length > 0) {
      await auditService.record({
        operator: req.user,
        action: "PRODUCT_REVIEW_BLOCKED",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "FAIL",
        details: {
          missingItems: missingReviewItems,
          requestedDecision,
        },
        req,
      });

      return res.status(400).send({
        message: "Electronic-device review requirements are incomplete",
        missingItems: missingReviewItems,
      });
    }
    const aiAssessment =
      requestedDecision === 0
        ? {
            label: "FAIL",
            result: "FAIL",
            confidence: 0,
            passProbability: 0,
            reasonHints: [],
            modelVersion: null,
            shouldBlock: true,
            requiresManualReview: false,
            isApprovedLike: false,
          }
        : await callAiAuditService(product.description || "", null, product);
    const aiOraclePass = requestedDecision === 1 && aiAssessment.isApprovedLike;

    const chainId = product.onChainId > 0 ? product.onChainId : product.id;
    const { signature, oracleAddress } = signAiAuditResult(chainId, aiOraclePass);
    const receipt = await sendContractTransaction({
      account: accounts.regulator,
      method: contract.methods.auditProduct(
        chainId,
        aiOraclePass,
        reviewReason,
        signature
      ),
      gas: 800000,
    });

    product.auditStatus = aiOraclePass ? 1 : 2;
    product.auditReason = reviewReason;
    product.auditReasonCodes = reasonCodes.length ? JSON.stringify(reasonCodes) : null;
    product.auditBy = req.userId;
    product.auditAt = new Date();
    await product.save();

    const lifecycleTxHashes =
      product.auditStatus === 1 ? await syncExtendedChainLifecycle(product, accounts.regulator) : {};

    await auditService.record({
      operator: req.user,
      action: "PRODUCT_AUDITED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: {
        requestedDecision,
        auditStatus: product.auditStatus,
        reason: reviewReason,
        reasonCodes,
        oracleAddress,
        aiLabel: aiAssessment.label,
        aiConfidence: aiAssessment.confidence,
        aiPassProbability: aiAssessment.passProbability,
        aiReasonHints: aiAssessment.reasonHints,
        aiModelVersion: aiAssessment.modelVersion,
      },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({
      message: "Audit completed with AI oracle signature.",
      auditStatus: product.auditStatus,
      aiOracleSigner: oracleAddress,
      aiAssessment,
      reasonCodes,
    });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.delistProduct = async (req, res) => {
  try {
    const { productId, reason } = req.body;
    const result = await withTransaction(async (transaction) => {
      const product = await findProductForUpdate(productId, transaction);

      if (!product) {
        return { status: 404, body: { message: "Product not found" } };
      }

      const isRegulator = isPrivilegedUserRole(req.user.role);
      const isSellerOwner = req.user.role === "seller" && req.user.id === product.sellerId;

      if (!isRegulator && !isSellerOwner) {
        await auditService.recordAccessDenied(req, ["seller(owner)", PRIVILEGED_ROLE]);
        return { status: 403, body: { message: "No permission to delist this product" } };
      }

      const chainId = product.onChainId > 0 ? product.onChainId : product.id;
      const receipt = await sendContractTransaction({
        account: isRegulator ? accounts.regulator : accounts.market,
        method: contract.methods.delistProduct(chainId, reason || "Manual delist"),
        gas: 600000,
      });

      product.auditStatus = 2;
      product.stock = 0;
      product.delistReason = reason || "Manual delist";
      product.delistedBy = req.userId;
      product.delistedAt = new Date();
      await product.save({ transaction });

      await auditService.record({
        operator: req.user,
        action: "PRODUCT_DELISTED",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          reason: product.delistReason,
          forced: isRegulator,
        },
        req,
        txHash: receipt.transactionHash,
      });

      return {
        status: 200,
        body: { message: "Product delisted successfully" },
      };
    });

    return res.status(result.status).send(result.body);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.recallProduct = async (req, res) => {
  let recallJobPayload = null;
  try {
    const { productId, reason, batchNo } = req.body;
    const recallReason = String(reason || "").trim();
    const normalizedBatchNo = normalizeOptionalString(batchNo, null);
    if (!recallReason) {
      return res.status(400).send({ message: "Recall reason is required" });
    }

    const result = await withTransaction(async (transaction) => {
      const product = await findProductForUpdate(productId, transaction);

      if (!product) {
        return { status: 404, body: { message: "Product not found" } };
      }
      if (product.recallStatus) {
        return { status: 400, body: { message: "Product has already been recalled" } };
      }

      const chainId = product.onChainId > 0 ? product.onChainId : product.id;
      const recallRiskLevel = 2;
      const recallNoticeAt = new Date();
      const delistedAt = new Date();
      recallJobPayload = {
        productId: product.id,
        chainId,
        reason: recallReason,
        batchNo: normalizedBatchNo || product.batchNo || null,
        operatorId: req.userId,
        recallNoticeAt,
        delistedAt,
      };
      const receipt = await sendContractTransaction({
        account: accounts.regulator,
        method: contractSupportsMethod("flagProductRecall", 4)
          ? contract.methods.flagProductRecall(
              chainId,
              recallReason,
              normalizedBatchNo || product.batchNo || "",
              recallRiskLevel
            )
          : contract.methods.delistProduct(chainId, `Recall: ${recallReason}`),
        gas: 600000,
      });
      recallJobPayload.txHash = receipt.transactionHash;

      product.recallStatus = true;
      product.recallReason = recallReason;
      product.recallNoticeAt = recallNoticeAt;
      product.recallBatchNo = normalizedBatchNo || product.batchNo || null;
      product.auditStatus = 2;
      product.stock = 0;
      product.delistReason = `Recall: ${recallReason}`;
      product.delistedBy = req.userId;
      product.delistedAt = delistedAt;
      await product.save({ transaction });

      const affectedOrders = await Order.findAll({
        where: { productId: product.id },
        transaction,
      });
      const notificationPayloads = affectedOrders
        .filter((order) => order.buyerId)
        .map((order) => ({
          buyerId: order.buyerId,
          productId: product.id,
          orderId: order.id,
          status: "pending",
          notifiedAt: recallNoticeAt,
          viewedAt: null,
          acknowledgedAt: null,
        }));

      if (notificationPayloads.length > 0) {
        await RecallNotification.bulkCreate(notificationPayloads, { transaction });
      }

      await auditService.record({
        operator: req.user,
        action: "PRODUCT_RECALL_FLAGGED",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          reason: recallReason,
          batchNo: product.recallBatchNo,
          forcedDelist: true,
          riskLevel: recallRiskLevel,
        },
        req,
        txHash: receipt.transactionHash,
      });

      await auditService.record({
        operator: req.user,
        action: "RECALL_NOTIFICATIONS_CREATED",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          notificationCount: notificationPayloads.length,
          affectedOrderCount: affectedOrders.length,
        },
        req,
      });

      return {
        status: 200,
        body: {
          message: "Product recalled successfully",
          notificationsCreated: notificationPayloads.length,
          recallStatus: true,
          txHash: receipt.transactionHash,
        },
      };
    });

    return res.status(result.status).send(result.body);
  } catch (error) {
    if (recallJobPayload) {
      await queueIntegrationJob({
        jobType: integrationJobService.JOB_TYPE.RECALL_PRODUCT,
        targetType: "PRODUCT",
        targetId: recallJobPayload.productId,
        payload: recallJobPayload,
        error,
        req,
      });
    }
    return res.status(500).send({ message: error.message });
  }
};

exports.restockProduct = async (req, res) => {
  try {
    const { productId, amount } = req.body;
    const parsedAmount = parseIntegerQuery(amount, 0, { min: 1, max: 1000000 });
    if (!parsedAmount) {
      return res.status(400).send({ message: "Invalid restock amount" });
    }
    if (typeof contract.methods.restockProduct !== "function") {
      return res.status(500).send({
        message: "Contract method restockProduct is unavailable. Please recompile and redeploy contract.",
      });
    }

    const result = await withTransaction(async (transaction) => {
      const product = await findProductForUpdate(productId, transaction);

      if (!product) {
        return { status: 404, body: { message: "Product not found" } };
      }
      if (req.user.role !== "seller" || req.user.id !== product.sellerId) {
        await auditService.recordAccessDenied(req, ["seller(owner)"]);
        return { status: 403, body: { message: "No permission to restock this product" } };
      }
      if (product.auditStatus !== 1) {
        return { status: 400, body: { message: "Only approved products can be restocked" } };
      }
      if (product.recallStatus) {
        return { status: 400, body: { message: "Recalled products cannot be restocked" } };
      }

      const seller = await User.findByPk(product.sellerId);
      const sellerSync = await syncSellerBlacklist(seller);
      if (sellerSync.isBlacklisted) {
        return { status: 403, body: { message: "Your account is blacklisted" } };
      }

      const chainId = product.onChainId > 0 ? product.onChainId : product.id;
      const receipt = await sendContractTransaction({
        account: accounts.market,
        method: contract.methods.restockProduct(chainId, parsedAmount),
        gas: 700000,
      });

      product.stock += parsedAmount;
      await product.save({ transaction });

      await auditService.record({
        operator: req.user,
        action: "PRODUCT_RESTOCKED",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          amount: parsedAmount,
          newStock: product.stock,
        },
        req,
        txHash: receipt.transactionHash,
      });

      return {
        status: 200,
        body: {
          message: "Product restocked successfully",
          stock: product.stock,
          txHash: receipt.transactionHash,
        },
      };
    });

    return res.status(result.status).send(result.body);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.resubmitProduct = async (req, res) => {
  try {
    const {
      productId,
      name,
      price,
      description,
      ipfsHash,
      qualificationHash,
      stock,
      sellerWallet,
    } = req.body;
    const product = await Product.findByPk(productId);

    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }
    if (req.user.role !== "seller" || req.user.id !== product.sellerId) {
      await auditService.recordAccessDenied(req, ["seller(owner)"]);
      return res.status(403).send({ message: "No permission to resubmit this product" });
    }
    if (product.auditStatus !== 2) {
      return res.status(400).send({ message: "Only rejected products can be resubmitted" });
    }
    if (product.recallStatus) {
      return res.status(400).send({ message: "Recalled products cannot be resubmitted" });
    }

    const seller = await User.findByPk(product.sellerId);
    const sellerSync = await syncSellerBlacklist(seller);
    if (sellerSync.isBlacklisted) {
      return res.status(403).send({ message: "Your account is blacklisted" });
    }

    const nextName = String(name || product.name || "").trim();
    const nextDescription = String(description || product.description || "").trim();
    const nextPrice = Number(price ?? product.price);
    const nextStock = parseIntegerQuery(stock, product.stock, { min: 1, max: 1000000 });
    const nextIpfsHash = ipfsHash !== undefined ? String(ipfsHash || "") : product.ipfsHash;
    const nextQualificationHash =
      qualificationHash !== undefined
        ? String(qualificationHash || "")
        : product.qualificationHash;
    const nextElectronicFields = buildElectronicProductFields(req.body, product);
    const electronicValidationError = validateElectronicFields(nextElectronicFields);

    if (!nextName) {
      return res.status(400).send({ message: "Product name is required" });
    }
    if (!Number.isFinite(nextPrice) || nextPrice <= 0) {
      return res.status(400).send({ message: "Invalid product price" });
    }
    if (!Number.isInteger(nextStock) || nextStock <= 0) {
      return res.status(400).send({ message: "Invalid stock value" });
    }
    if (electronicValidationError) {
      return res.status(400).send({ message: electronicValidationError });
    }

    const currentSellerWallet = sellerWallet || (seller.walletBound ? seller.ethAddress : null);
    if (!currentSellerWallet || !web3.utils.isAddress(currentSellerWallet)) {
      return res.status(400).send({ message: "Valid seller wallet is required" });
    }
    if (!addressesEqual(seller.ethAddress, currentSellerWallet)) {
      seller.ethAddress = currentSellerWallet;
    }
    seller.walletBound = true;
    if (typeof seller.save === "function") {
      await seller.save();
    }

    const aiAuditEnabled = await settingService.isAiAuditEnabled();
    const aiAssessment = aiAuditEnabled
      ? await callAiAuditService(nextDescription, null, {
          name: nextName,
          description: nextDescription,
          ...nextElectronicFields,
        })
      : buildAiDisabledAssessment();
    const degradedToManualReview = isAiServiceUnavailable(aiAssessment);
    if (aiAssessment.shouldBlock) {
      product.name = nextName;
      product.description = nextDescription;
      product.price = nextPrice;
      product.stock = nextStock;
      product.ipfsHash = nextIpfsHash;
      product.qualificationHash = nextQualificationHash;
      Object.assign(product, nextElectronicFields);
      product.auditStatus = 2;
      product.auditReason = "AI 预审核判定本次重新提交未通过。";
      await product.save();

      await auditService.record({
        operator: req.user,
        action: "PRODUCT_RESUBMISSION_AI_REJECTED",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          name: nextName,
          aiLabel: aiAssessment.label,
          aiConfidence: aiAssessment.confidence,
          aiPassProbability: aiAssessment.passProbability,
          aiReasonHints: aiAssessment.reasonHints,
          aiModelVersion: aiAssessment.modelVersion,
        },
        req,
      });

      return res.status(400).send({
        message: "AI 预审核判定本次重新提交未通过。",
        aiAssessment,
        product,
      });
    }

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: buildCreateProductMethod(
        {
          name: nextName,
          price: nextPrice,
          ipfsHash: nextIpfsHash,
          qualificationHash: nextQualificationHash,
          stock: nextStock,
          ...nextElectronicFields,
        },
        currentSellerWallet
      ),
      gas: 2000000,
    });

    const chainProductId = parseInt(await contract.methods.productCount().call(), 10);

    product.name = nextName;
    product.description = nextDescription;
    product.price = nextPrice;
    product.stock = nextStock;
    product.ipfsHash = nextIpfsHash;
    product.qualificationHash = nextQualificationHash;
    Object.assign(product, nextElectronicFields);
    product.auditStatus = 0;
    product.auditReason = degradedToManualReview
      ? "AI 服务暂不可用，已转入人工审核。"
      : !aiAuditEnabled
      ? "监督方已关闭 AI 预审核，已转入人工审核。"
      : "商品已重新提交，等待监督方审核。";
    product.auditBy = null;
    product.auditAt = null;
    product.delistReason = null;
    product.delistedBy = null;
    product.delistedAt = null;
    product.txHash = receipt.transactionHash;
    product.onChainId = chainProductId;
    await product.save();

    const lifecycleTxHashes = await syncExtendedChainLifecycle(product, accounts.regulator);

    await auditService.record({
      operator: req.user,
      action: "PRODUCT_RESUBMITTED",
      targetType: "PRODUCT",
      targetId: product.id,
      result: "SUCCESS",
      details: {
        chainProductId,
        aiLabel: aiAssessment.label,
        aiConfidence: aiAssessment.confidence,
        aiPassProbability: aiAssessment.passProbability,
        aiReasonHints: aiAssessment.reasonHints,
        aiModelVersion: aiAssessment.modelVersion,
        aiAuditEnabled,
      },
      req,
      txHash: receipt.transactionHash,
    });

    if (!aiAuditEnabled) {
      await auditService.record({
        operator: req.user,
        action: "PRODUCT_AI_SKIPPED_BY_SETTING",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          source: "resubmit",
          name: nextName,
          reason: "监督方已关闭 AI 预审核",
        },
        req,
      });
    }

    if (degradedToManualReview) {
      await auditService.record({
        operator: req.user,
        action: "PRODUCT_AI_DEGRADED_TO_MANUAL_REVIEW",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: {
          source: "resubmit",
          name: nextName,
          reason: "AI 服务暂不可用",
        },
        req,
      });
    }

    await recordLifecycleAuditEntries({
      product,
      operator: req.user,
      req,
      txHashes: lifecycleTxHashes,
    });

    return res.send({
      message: degradedToManualReview
        ? "AI 预审核暂不可用，本次重新提交已转入人工审核。"
        : !aiAuditEnabled
        ? "监督方已关闭 AI 预审核，本次重新提交已转入人工审核。"
        : aiAssessment.requiresManualReview
        ? "AI 预审核建议人工复核，等待监督方审核。"
        : "商品重新提交成功，等待监督方审核。",
      aiAssessment,
      product,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.purchaseProduct = async (req, res) => {
  let purchaseJobPayload = null;
  try {
    const { productId } = req.body;

    const buyer = await User.findByPk(req.userId);

    if (!buyer) {
      return res.status(404).send({ message: "买家不存在" });
    }

    const result = await withTransaction(async (transaction) => {
      const product = await findProductForUpdate(productId, transaction);

      if (!product) {
        return { status: 404, body: { message: "商品不存在" } };
      }
      if (product.auditStatus !== 1) {
        return { status: 400, body: { message: "商品当前不可购买" } };
      }
      if (product.recallStatus) {
        return { status: 400, body: { message: "已召回商品不可购买" } };
      }
      if (product.stock <= 0) {
        return { status: 400, body: { message: "商品库存不足" } };
      }

      const seller = await User.findByPk(product.sellerId);
      const sellerSync = await syncSellerBlacklist(seller);
      if (sellerSync.isBlacklisted) {
        return { status: 400, body: { message: "卖家已被列入黑名单" } };
      }

      const chainId = product.onChainId > 0 ? product.onChainId : product.id;
      purchaseJobPayload = {
        productId: product.id,
        buyerId: buyer.id,
        price: product.price,
        paidAt: new Date(),
      };
      const receipt = await sendContractTransaction({
        account: accounts.market,
        method: contract.methods.purchaseProduct(chainId, buyer.ethAddress),
        gas: 1200000,
        value: web3.utils.toWei(String(product.price), "ether"),
      });

      const chainOrderId = parseInt(await contract.methods.orderCount().call(), 10);
      purchaseJobPayload.txHash = receipt.transactionHash;
      purchaseJobPayload.chainOrderId = chainOrderId;

      const order = await Order.create(
        {
          productId: product.id,
          buyerId: buyer.id,
          price: product.price,
          status: 0,
          paymentStatus: "paid",
          paymentMethod: "contract_escrow",
          paymentReference: `CHAIN_ORDER_${chainOrderId}`,
          paidAt: purchaseJobPayload.paidAt,
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

      await auditService.record({
        operator: req.user,
        action: "PRODUCT_PURCHASED",
        targetType: "PRODUCT",
        targetId: product.id,
        result: "SUCCESS",
        details: { chainOrderId },
        req,
        txHash: receipt.transactionHash,
      });

      await auditService.record({
        operator: req.user,
        action: "ORDER_PAYMENT_RECORDED",
        targetType: "ORDER",
        targetId: order.id,
        result: "SUCCESS",
        details: {
          paymentStatus: order.paymentStatus,
          paymentMethod: order.paymentMethod,
          paymentReference: order.paymentReference,
          paidAt: purchaseJobPayload.paidAt,
        },
        req,
        txHash: receipt.transactionHash,
      });

      return {
        status: 200,
        body: { message: "购买成功" },
      };
    });

    return res.status(result.status).send(result.body);
  } catch (error) {
    if (purchaseJobPayload) {
      await queueIntegrationJob({
        jobType: integrationJobService.JOB_TYPE.PURCHASE_PRODUCT,
        targetType: "ORDER",
        targetId: purchaseJobPayload.chainOrderId || purchaseJobPayload.productId,
        payload: purchaseJobPayload,
        error,
        req,
      });
    }
    console.error(error);
    res.status(500).send({ message: "购买失败：" + error.message });
  }
};

exports.prepareWalletPurchase = async (req, res) => {
  try {
    const productId = req.params.productId || req.body.productId;
    const buyer = await User.findByPk(req.userId);

    if (!buyer) {
      return res.status(404).send({ message: "买家不存在" });
    }

    const product = await Product.findByPk(productId);
    if (!product) {
      return res.status(404).send({ message: "商品不存在" });
    }
    if (product.auditStatus !== 1) {
      return res.status(400).send({ message: "商品当前不可购买" });
    }
    if (product.recallStatus) {
      return res.status(400).send({ message: "已召回商品不可购买" });
    }
    if (product.stock <= 0) {
      return res.status(400).send({ message: "商品库存不足" });
    }

    const seller = await User.findByPk(product.sellerId);
    const sellerSync = await syncSellerBlacklist(seller);
    if (sellerSync.isBlacklisted) {
      return res.status(400).send({ message: "卖家已被列入黑名单" });
    }

    const chainProductId = product.onChainId > 0 ? product.onChainId : product.id;
    const method = contract.methods.purchaseProductFromWallet(chainProductId);

    return res.status(200).send({
      contractAddress: CONTRACT_ADDRESS,
      data: method.encodeABI(),
      value: web3.utils.toWei(String(product.price), "ether"),
      chainProductId,
      productId: product.id,
      price: product.price,
      currentUserWallet: buyer.walletBound ? buyer.ethAddress : null,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.finalizeWalletPurchase = async (req, res) => {
  try {
    const { productId, txHash } = req.body;

    if (!productId || !txHash) {
      return res.status(400).send({ message: "商品和交易哈希不能为空" });
    }

    const buyer = await User.findByPk(req.userId);
    if (!buyer) {
      return res.status(404).send({ message: "买家不存在" });
    }

    const receipt = await web3.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      return res.status(404).send({ message: "未找到链上交易回执" });
    }
    if (!receipt.status) {
      return res.status(400).send({ message: "钱包购买交易在链上执行失败" });
    }
    if (!addressesEqual(receipt.to, CONTRACT_ADDRESS)) {
      return res.status(400).send({ message: "交易未发送到托管合约" });
    }

    const orderEvent = decodeOrderCreatedEvent(receipt);
    if (!orderEvent) {
      return res.status(400).send({ message: "交易中未找到订单创建事件" });
    }
    if (!addressesEqual(receipt.from, orderEvent.buyer)) {
      return res.status(400).send({ message: "交易发起钱包与订单买家不一致" });
    }

    const chainOrderId = parseInt(orderEvent.orderId, 10);
    const chainProductId = parseInt(orderEvent.productId, 10);
    const chainBuyer = orderEvent.buyer;

    const result = await withTransaction(async (transaction) => {
      const product = await findProductForUpdate(productId, transaction);
      if (!product) {
        return { status: 404, body: { message: "商品不存在" } };
      }

      const expectedChainProductId = product.onChainId > 0 ? product.onChainId : product.id;
      if (Number(expectedChainProductId) !== Number(chainProductId)) {
        return { status: 400, body: { message: "交易商品与请求商品不一致" } };
      }

      let order = await Order.findOne({
        where: { onChainId: chainOrderId },
        transaction,
      });

      if (!addressesEqual(buyer.ethAddress, chainBuyer)) {
        buyer.ethAddress = chainBuyer;
      }
      buyer.walletBound = true;
      if (typeof buyer.save === "function") {
        await buyer.save({ transaction });
      }

      if (!order) {
        order = await Order.create(
          {
            productId: product.id,
            buyerId: buyer.id,
            price: product.price,
            status: 0,
            paymentStatus: "paid",
            paymentMethod: "metamask_contract_escrow",
            paymentReference: `CHAIN_ORDER_${chainOrderId}`,
            paidAt: new Date(),
            refundStatus: "none",
            refundAmount: 0,
            refundedAt: null,
            shippingStatus: "pending",
            onChainId: chainOrderId,
          },
          { transaction }
        );

        product.stock = Math.max(Number(product.stock) - 1, 0);
        await product.save({ transaction });

        await auditService.record({
          operator: req.user,
          action: "PRODUCT_PURCHASED",
          targetType: "PRODUCT",
          targetId: product.id,
          result: "SUCCESS",
          details: { chainOrderId, paymentMethod: "metamask_contract_escrow" },
          req,
          txHash,
        });

        await auditService.record({
          operator: req.user,
          action: "ORDER_PAYMENT_RECORDED",
          targetType: "ORDER",
          targetId: order.id,
          result: "SUCCESS",
          details: {
            paymentStatus: order.paymentStatus,
            paymentMethod: order.paymentMethod,
            paymentReference: order.paymentReference,
            wallet: chainBuyer,
          },
          req,
          txHash,
        });
      }

      return {
        status: 200,
        body: {
          message: "Wallet purchase finalized",
          orderId: order.id,
          chainOrderId,
          txHash,
        },
      };
    });

    return res.status(result.status).send(result.body);
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: error.message });
  }
};

exports.prepareWalletConfirmReceipt = async (req, res) => {
  try {
    const orderId = req.params.orderId || req.body.orderId;
    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);

    if (!order || !buyer) {
      return res.status(404).send({ message: "订单不存在" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "只能确认自己的订单" });
    }
    if (order.status !== 0) {
      return res.status(400).send({ message: "仅托管中的订单可以确认收货" });
    }
    if (order.shippingStatus === "pending") {
      return res.status(400).send({ message: "卖家尚未发货" });
    }

    const chainOrderId = getOrderChainId(order);
    const method = contract.methods.confirmReceiptFromWallet(chainOrderId);

    return res.status(200).send({
      contractAddress: CONTRACT_ADDRESS,
      data: method.encodeABI(),
      value: "0",
      orderId: order.id,
      chainOrderId,
      currentUserWallet: buyer.walletBound ? buyer.ethAddress : null,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.finalizeWalletConfirmReceipt = async (req, res) => {
  try {
    const { orderId, txHash } = req.body;

    if (!orderId || !txHash) {
      return res.status(400).send({ message: "订单和交易哈希不能为空" });
    }

    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);

    if (!order || !buyer) {
      return res.status(404).send({ message: "订单不存在" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "只能确认自己的订单" });
    }
    if (order.shippingStatus === "pending") {
      return res.status(400).send({ message: "卖家尚未发货" });
    }

    const receipt = await web3.eth.getTransactionReceipt(txHash);
    if (!receipt) {
      return res.status(404).send({ message: "未找到链上交易回执" });
    }
    if (!receipt.status) {
      return res.status(400).send({ message: "钱包确认收货交易在链上执行失败" });
    }
    if (!addressesEqual(receipt.to, CONTRACT_ADDRESS)) {
      return res.status(400).send({ message: "交易未发送到托管合约" });
    }

    const orderConfirmedEvent = decodeContractEvent(receipt, "OrderConfirmed");
    if (!orderConfirmedEvent) {
      return res.status(400).send({ message: "交易中未找到确认收货事件" });
    }

    const chainOrderId = getOrderChainId(order);
    if (Number(orderConfirmedEvent.orderId) !== Number(chainOrderId)) {
      return res.status(400).send({ message: "交易订单与请求订单不一致" });
    }
    if (!addressesEqual(receipt.from, orderConfirmedEvent.buyer)) {
      return res.status(400).send({ message: "交易发起钱包与订单买家不一致" });
    }

    const chainOrder = await contract.methods.orders(chainOrderId).call();
    if (!addressesEqual(chainOrder.buyer, receipt.from)) {
      return res.status(400).send({ message: "当前钱包不是链上订单买家" });
    }
    if (String(chainOrder.state) !== "1") {
      return res.status(400).send({ message: "链上订单尚未释放资金" });
    }

    if (!addressesEqual(buyer.ethAddress, receipt.from)) {
      buyer.ethAddress = receipt.from;
    }
    buyer.walletBound = true;
    if (typeof buyer.save === "function") {
      await buyer.save();
    }

    order.status = 1;
    order.shippingStatus = "delivered";
    order.buyerConfirmedAt = new Date();
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "ORDER_CONFIRMED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: { paymentRelease: "metamask_confirm_receipt", wallet: receipt.from },
      req,
      txHash,
    });

    return res.send({ message: "确认收货成功" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getMyOrders = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId);
    let orders = [];

    if (user.role === "buyer") {
      orders = await Order.findAll({
        where: { buyerId: req.userId },
        include: [
          {
            model: Product,
            as: "product",
            include: [{ model: User, as: "seller", attributes: ["id", "username", "ethAddress"] }],
          },
          {
            model: AfterSalesRecord,
            as: "afterSalesRecords",
            include: [{ model: User, as: "creator", attributes: ["id", "username", "role"] }],
          },
          {
            model: AfterSalesRequest,
            as: "afterSalesRequests",
            include: [{ model: User, as: "buyer", attributes: ["id", "username", "role"] }],
          },
          {
            model: RecallNotification,
            as: "recallNotifications",
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    } else if (user.role === "seller") {
      orders = await Order.findAll({
        include: [
          {
            model: Product,
            as: "product",
            where: { sellerId: req.userId },
          },
          {
            model: User,
            as: "buyer",
            attributes: ["id", "username", "ethAddress"],
          },
          {
            model: AfterSalesRecord,
            as: "afterSalesRecords",
            include: [{ model: User, as: "creator", attributes: ["id", "username", "role"] }],
          },
          {
            model: AfterSalesRequest,
            as: "afterSalesRequests",
            include: [{ model: User, as: "buyer", attributes: ["id", "username", "role"] }],
          },
        ],
        order: [["createdAt", "DESC"]],
      });
    }

    res.send(orders);
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getRecallNotifications = async (req, res) => {
  try {
    const where = {};

    if (req.user.role === "buyer") {
      where.buyerId = req.userId;
    } else if (req.query.buyerId) {
      where.buyerId = parseInt(req.query.buyerId, 10);
    }

    if (req.query.productId) {
      where.productId = parseInt(req.query.productId, 10);
    }

    const notifications = await RecallNotification.findAll({
      where,
      include: [
        {
          model: Product,
          as: "product",
        },
        {
          model: Order,
          as: "order",
        },
        ...(isPrivilegedUserRole(req.user.role)
          ? [
              {
                model: User,
                as: "buyer",
                attributes: ["id", "username", "ethAddress"],
              },
            ]
          : []),
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.send(
      notifications.map((notification) => ({
        ...serializeRecallNotification(notification),
        buyer:
          notification.buyer && isPrivilegedUserRole(req.user.role)
            ? {
                id: notification.buyer.id,
                username: notification.buyer.username,
                ethAddress: notification.buyer.ethAddress,
              }
            : undefined,
      }))
    );
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.updateRecallNotificationStatus = async (req, res) => {
  try {
    const notification = await RecallNotification.findByPk(req.params.notificationId, {
      include: [
        {
          model: Product,
          as: "product",
        },
        {
          model: Order,
          as: "order",
        },
      ],
    });

    if (!notification) {
      return res.status(404).send({ message: "Recall notification not found" });
    }
    if (req.user.role === "buyer" && notification.buyerId !== req.userId) {
      await auditService.recordAccessDenied(req, ["buyer(owner)", PRIVILEGED_ROLE]);
      return res.status(403).send({ message: "You can only update your own recall notification" });
    }

    const nextStatus = normalizeOptionalString(req.body.status, "acknowledged");
    if (!RECALL_NOTIFICATION_STATUSES.has(nextStatus) || nextStatus === "pending") {
      return res.status(400).send({ message: "Unsupported recall notification status" });
    }

    if (!notification.viewedAt) {
      notification.viewedAt = new Date();
    }
    if (nextStatus === "acknowledged") {
      notification.acknowledgedAt = new Date();
    }
    notification.status = nextStatus;
    await notification.save();

    await auditService.record({
      operator: req.user,
      action: "RECALL_NOTIFICATION_UPDATED",
      targetType: "RECALL_NOTIFICATION",
      targetId: notification.id,
      result: "SUCCESS",
      details: {
        status: notification.status,
        orderId: notification.orderId,
        productId: notification.productId,
      },
      req,
    });

    return res.send({
      message: "Recall notification updated successfully",
      notification: serializeRecallNotification(notification),
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getRecallNotificationSummary = async (req, res) => {
  try {
    const where = {};
    if (req.query.productId) {
      where.productId = parseInt(req.query.productId, 10);
    }

    const [total, pending, viewed, acknowledged, closed] = await Promise.all([
      RecallNotification.count({ where }),
      RecallNotification.count({ where: { ...where, status: "pending" } }),
      RecallNotification.count({ where: { ...where, status: "viewed" } }),
      RecallNotification.count({ where: { ...where, status: "acknowledged" } }),
      RecallNotification.count({ where: { ...where, status: "closed" } }),
    ]);

    return res.send({
      total,
      pending,
      viewed,
      acknowledged,
      closed,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.createAfterSalesRequest = async (req, res) => {
  try {
    const { orderId, description, evidenceIpfsHash } = req.body;
    const type = normalizeAfterSalesType(req.body.type, null);
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Product,
          as: "product",
        },
      ],
    });

    if (!order || !order.product) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.buyerId !== req.userId) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "You can only request after-sales service for your own order" });
    }
    if (![0, 1, 2].includes(order.status)) {
      return res.status(400).send({ message: "This order cannot open a new after-sales request" });
    }
    if (!type) {
      return res.status(400).send({ message: "After-sales request type is required" });
    }

    const normalizedDescription = String(description || "").trim();
    if (!normalizedDescription) {
      return res.status(400).send({ message: "After-sales request description is required" });
    }

    const openRequest = await AfterSalesRequest.findOne({
      where: {
        orderId: order.id,
        buyerId: req.userId,
        status: {
          [Op.in]: ["pending_seller", "seller_responded"],
        },
      },
      order: [["createdAt", "DESC"]],
    });
    if (openRequest) {
      return res.status(400).send({ message: "There is already an open after-sales request for this order" });
    }

    const request = await AfterSalesRequest.create({
      orderId: order.id,
      productId: order.productId,
      buyerId: req.userId,
      type,
      description: normalizedDescription,
      evidenceIpfsHash: normalizeOptionalString(evidenceIpfsHash, null),
      status: "pending_seller",
    });

    await auditService.record({
      operator: req.user,
      action: "AFTER_SALES_REQUEST_CREATED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: {
        afterSalesRequestId: request.id,
        type,
        evidenceIpfsHash: normalizeOptionalString(evidenceIpfsHash, null),
      },
      req,
      ipfsHash: normalizeOptionalString(evidenceIpfsHash, null),
    });

    const savedRequest = await AfterSalesRequest.findByPk(request.id, {
      include: [{ model: User, as: "buyer", attributes: ["id", "username", "role"] }],
    });

    return res.send({
      message: "After-sales request submitted successfully",
      request: serializeAfterSalesRequest(savedRequest || request),
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.respondToAfterSalesRequest = async (req, res) => {
  try {
    const { requestId, response, evidenceIpfsHash } = req.body;
    const request = await AfterSalesRequest.findByPk(requestId, {
      include: [
        {
          model: Order,
          as: "order",
          include: [
            {
              model: Product,
              as: "product",
            },
          ],
        },
        {
          model: User,
          as: "buyer",
          attributes: ["id", "username", "role"],
        },
      ],
    });

    if (!request || !request.order || !request.order.product) {
      return res.status(404).send({ message: "After-sales request not found" });
    }
    if (req.user.role !== "seller" || req.user.id !== request.order.product.sellerId) {
      await auditService.recordAccessDenied(req, ["seller(owner)"]);
      return res.status(403).send({ message: "You can only respond to after-sales requests for your own orders" });
    }
    if (request.status !== "pending_seller") {
      return res.status(400).send({ message: "Only pending after-sales requests can be answered" });
    }

    const sellerResponse = String(response || "").trim();
    if (!sellerResponse) {
      return res.status(400).send({ message: "Seller after-sales response is required" });
    }

    request.sellerResponse = sellerResponse;
    request.sellerEvidenceIpfsHash = normalizeOptionalString(evidenceIpfsHash, null);
    request.sellerRespondedAt = new Date();
    request.status = "seller_responded";
    await request.save();

    await auditService.record({
      operator: req.user,
      action: "AFTER_SALES_REQUEST_RESPONDED",
      targetType: "ORDER",
      targetId: request.orderId,
      result: "SUCCESS",
      details: {
        afterSalesRequestId: request.id,
        evidenceIpfsHash: normalizeOptionalString(evidenceIpfsHash, null),
      },
      req,
      ipfsHash: normalizeOptionalString(evidenceIpfsHash, null),
    });

    return res.send({
      message: "After-sales request responded successfully",
      request: serializeAfterSalesRequest(request),
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.escalateAfterSalesRequestToComplaint = async (req, res) => {
  try {
    const { requestId, complaintType, rulingDetails } = req.body;
    const request = await AfterSalesRequest.findByPk(requestId, {
      include: [
        {
          model: Order,
          as: "order",
        },
        {
          model: User,
          as: "buyer",
          attributes: ["id", "username", "role", "ethAddress"],
        },
      ],
    });

    if (!request || !request.order || !request.buyer) {
      return res.status(404).send({ message: "After-sales request not found" });
    }
    if (request.order.status === 3) {
      return res.status(400).send({ message: "This order is already in complaint flow" });
    }

    const normalizedComplaintType = normalizeComplaintType(complaintType, null);
    if (!normalizedComplaintType) {
      return res.status(400).send({ message: "Complaint type is required" });
    }
    if (!canEnterComplaintFlow(request.order)) {
      return res.status(400).send({ message: "This order cannot be escalated to complaint flow" });
    }

    await openComplaintForOrder({
      order: request.order,
      buyer: request.buyer,
      complaintType: normalizedComplaintType,
      reason: rulingDetails || request.description,
      evidenceIpfsHash: request.evidenceIpfsHash,
      req,
      auditDetails: {
        escalatedFromAfterSalesRequestId: request.id,
      },
    });

    request.status = "escalated_to_complaint";
    request.escalatedAt = new Date();
    request.escalatedBy = req.userId;
    await request.save();

    await auditService.record({
      operator: req.user,
      action: "AFTER_SALES_REQUEST_ESCALATED",
      targetType: "ORDER",
      targetId: request.orderId,
      result: "SUCCESS",
      details: {
        afterSalesRequestId: request.id,
        complaintType: normalizedComplaintType,
      },
      req,
    });

    return res.send({ message: "After-sales request escalated to complaint successfully" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.recordAfterSales = async (req, res) => {
  try {
    const { orderId, componentName, description, serviceResult, evidenceIpfsHash } = req.body;
    const type = normalizeAfterSalesType(req.body.type, null);
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Product,
          as: "product",
        },
      ],
    });

    if (!order || !order.product) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (!type) {
      return res.status(400).send({ message: "After-sales type is required" });
    }

    const normalizedDescription = String(description || "").trim();
    if (!normalizedDescription) {
      return res.status(400).send({ message: "After-sales description is required" });
    }

    if (
      req.user.role === "seller" &&
      req.user.id !== order.product.sellerId
    ) {
      await auditService.recordAccessDenied(req, ["seller(owner)", PRIVILEGED_ROLE]);
      return res.status(403).send({ message: "You can only record service for your own orders" });
    }

    const record = await AfterSalesRecord.create({
      orderId: order.id,
      productId: order.productId,
      type,
      componentName: normalizeOptionalString(componentName, null),
      description: normalizedDescription,
      serviceResult: normalizeOptionalString(serviceResult, null),
      createdBy: req.userId,
      evidenceIpfsHash: normalizeOptionalString(evidenceIpfsHash, null),
    });

    let txHash = null;
    if (
      ["repair", "component_replacement", "warranty_claim"].includes(type) &&
      contractSupportsMethod("recordProductRepair", 3)
    ) {
      const chainId = order.product.onChainId > 0 ? order.product.onChainId : order.product.id;
      const receipt = await sendContractTransaction({
        account: accounts.market,
        method: contract.methods.recordProductRepair(
          chainId,
          normalizeOptionalString(componentName, type) || type,
          normalizedDescription
        ),
        gas: 650000,
      });
      txHash = receipt.transactionHash;
    }

    await auditService.record({
      operator: req.user,
      action: type === "warranty_claim" ? "WARRANTY_UPDATED" : "PRODUCT_REPAIR_RECORDED",
      targetType: "PRODUCT",
      targetId: order.productId,
      result: "SUCCESS",
      details: {
        orderId: order.id,
        type,
        componentName: normalizeOptionalString(componentName, null),
        serviceResult: normalizeOptionalString(serviceResult, null),
        evidenceIpfsHash: normalizeOptionalString(evidenceIpfsHash, null),
      },
      req,
      txHash,
      ipfsHash: normalizeOptionalString(evidenceIpfsHash, null),
    });

    const savedRecord = await AfterSalesRecord.findByPk(record.id, {
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "role"],
        },
      ],
    });

    return res.send({
      message: "After-sales record saved successfully",
      record: serializeAfterSalesRecord(savedRecord || record),
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getProductAfterSales = async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.productId);
    if (!product) {
      return res.status(404).send({ message: "Product not found" });
    }

    const records = await AfterSalesRecord.findAll({
      where: { productId: product.id },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "username", "role"],
        },
      ],
      order: [["createdAt", "ASC"]],
    });

    return res.send(records.map((record) => serializeAfterSalesRecord(record)));
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.shipOrder = async (req, res) => {
  try {
    const { orderId, trackingNumber, shippingCarrier } = req.body;
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Product,
          as: "product",
        },
      ],
    });

    if (!order || !order.product) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (req.user.role !== "seller" || req.user.id !== order.product.sellerId) {
      await auditService.recordAccessDenied(req, ["seller(owner)"]);
      return res.status(403).send({ message: "You can only ship your own order" });
    }
    if (order.status !== 0) {
      return res.status(400).send({ message: "Only active orders can be shipped" });
    }
    if (order.shippingStatus === "shipped" || order.shippingStatus === "delivered") {
      return res.status(400).send({ message: "This order has already been shipped" });
    }

    const normalizedTrackingNumber = String(trackingNumber || "").trim();
    const normalizedCarrier = String(shippingCarrier || "").trim();
    if (!normalizedTrackingNumber) {
      return res.status(400).send({ message: "Tracking number is required" });
    }

    order.shippingStatus = "shipped";
    order.trackingNumber = normalizedTrackingNumber;
    order.shippingCarrier = normalizedCarrier || null;
    order.shippedAt = new Date();
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "ORDER_SHIPPED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: {
        trackingNumber: normalizedTrackingNumber,
        shippingCarrier: normalizedCarrier || null,
      },
      req,
    });

    return res.send({ message: "Order shipped successfully" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.confirmReceipt = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);

    if (!order || !buyer) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "只能确认自己的订单" });
    }
    if (order.status !== 0) {
      return res.status(400).send({ message: "仅托管中的订单可以确认收货" });
    }
    if (order.shippingStatus === "pending") {
      return res.status(400).send({ message: "卖家尚未发货" });
    }

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.confirmReceipt(getOrderChainId(order), buyer.ethAddress),
      gas: 600000,
    });

    order.status = 1;
    order.shippingStatus = "delivered";
    order.buyerConfirmedAt = new Date();
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "ORDER_CONFIRMED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      req,
      txHash: receipt.transactionHash,
    });

    res.send({ message: "确认收货成功" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.rateOrder = async (req, res) => {
  try {
    const { orderId, rating, comment } = req.body;
    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);

    if (!order || !buyer) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "You can only rate your own order" });
    }
    if (order.status !== 1) {
      return res.status(400).send({ message: "Only confirmed orders can be rated" });
    }

    const receipt = await sendContractTransaction({
      account: accounts.market,
      method: contract.methods.rateOrder(
        getOrderChainId(order),
        buyer.ethAddress,
        parseInt(rating, 10),
        comment || ""
      ),
      gas: 600000,
    });

    order.status = 2;
    order.rating = rating;
    order.comment = comment;
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "ORDER_RATED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: { rating },
      req,
      txHash: receipt.transactionHash,
    });

    res.send({ message: "Rated successfully" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.raiseComplaint = async (req, res) => {
  try {
    const { orderId, reason, evidenceIpfsHash } = req.body;
    const order = await Order.findByPk(orderId);
    const buyer = await User.findByPk(req.userId);
    const complaintType = normalizeComplaintType(req.body.complaintType, null);

    if (!order || !buyer) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.buyerId !== buyer.id) {
      await auditService.recordAccessDenied(req, ["buyer(owner)"]);
      return res.status(403).send({ message: "You can only complain about your own order" });
    }
    if (!complaintType) {
      return res.status(400).send({ message: "Complaint type is required" });
    }
    if (!canEnterComplaintFlow(order)) {
      return res.status(400).send({ message: "Only active, confirmed, or completed orders can enter complaint flow" });
    }

    if (!DIRECT_COMPLAINT_TYPE_OPTIONS.has(complaintType)) {
      const afterSalesRequest = await findOrderAfterSalesRequest(order.id, buyer.id);
      if (!afterSalesRequest) {
        return res.status(400).send({
          message: "Please submit an after-sales request before escalating this type of issue to complaint flow",
        });
      }
    }

    await openComplaintForOrder({
      order,
      buyer,
      complaintType,
      reason,
      evidenceIpfsHash,
      req,
    });

    res.send({ message: "Complaint submitted" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.respondToComplaint = async (req, res) => {
  try {
    const { orderId, response, evidenceIpfsHash } = req.body;
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: Product,
          as: "product",
        },
      ],
    });

    if (!order || !order.product) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (req.user.role !== "seller" || req.user.id !== order.product.sellerId) {
      await auditService.recordAccessDenied(req, ["seller(owner)"]);
      return res.status(403).send({ message: "You can only respond to complaints on your own orders" });
    }
    if (order.status !== 3) {
      return res.status(400).send({ message: "Only disputed orders can accept seller response" });
    }

    const sellerResponse = String(response || "").trim();
    if (!sellerResponse) {
      return res.status(400).send({ message: "Seller response is required" });
    }

    order.sellerResponse = sellerResponse;
    order.sellerEvidenceIpfsHash = evidenceIpfsHash || null;
    order.sellerRespondedAt = new Date();
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "SELLER_RESPONSE_SUBMITTED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: {
        evidenceIpfsHash: evidenceIpfsHash || null,
      },
      req,
      ipfsHash: evidenceIpfsHash || null,
    });

    return res.send({ message: "Seller response submitted successfully" });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.resolveComplaint = async (req, res) => {
  try {
    const { orderId, rulingForBuyer, rulingDetails } = req.body;
    const order = await Order.findByPk(orderId);

    if (!order) {
      return res.status(404).send({ message: "Order not found" });
    }
    if (order.status !== 3) {
      return res.status(400).send({ message: "Only disputed orders can be resolved" });
    }

    const product = await Product.findByPk(order.productId);
    const seller = product ? await User.findByPk(product.sellerId) : null;
    const sellerRiskBefore = seller ? await syncSellerBlacklist(seller) : null;

    const receipt = await sendContractTransaction({
      account: accounts.regulator,
      method: contract.methods.resolveComplaint(
        getOrderChainId(order),
        Boolean(rulingForBuyer),
        rulingDetails || ""
      ),
      gas: 700000,
    });

    order.status = rulingForBuyer ? 4 : 1;
    order.resolvedBy = req.userId;
    order.resolvedAt = new Date();
    order.rulingForBuyer = Boolean(rulingForBuyer);
    order.rulingDetails = rulingDetails || "";
    order.paymentStatus = rulingForBuyer ? "refunded" : order.paymentStatus || "paid";
    order.refundStatus = rulingForBuyer ? "refunded" : "rejected";
    order.refundAmount = rulingForBuyer ? order.price : 0;
    order.refundedAt = rulingForBuyer ? new Date() : null;
    await order.save();

    await auditService.record({
      operator: req.user,
      action: "COMPLAINT_RESOLVED",
      targetType: "ORDER",
      targetId: order.id,
      result: "SUCCESS",
      details: {
        rulingForBuyer: Boolean(rulingForBuyer),
        rulingDetails: rulingDetails || "",
      },
      req,
      txHash: receipt.transactionHash,
    });

    if (Boolean(rulingForBuyer)) {
      await auditService.record({
        operator: req.user,
        action: "ORDER_REFUND_COMPLETED",
        targetType: "ORDER",
        targetId: order.id,
        result: "SUCCESS",
        details: {
          refundStatus: order.refundStatus,
          refundAmount: order.refundAmount,
          refundedAt: order.refundedAt,
        },
        req,
        txHash: receipt.transactionHash,
      });
    }

    if (seller) {
      const sellerRiskAfter = await syncSellerBlacklist(seller);
      if (sellerRiskBefore && !sellerRiskBefore.isBlacklisted && sellerRiskAfter.isBlacklisted) {
        await auditService.record({
          operator: req.user,
          action: "SELLER_BLACKLISTED",
          targetType: "USER",
          targetId: seller.id,
          result: "SUCCESS",
          details: {
            reason: "Reputation below zero after complaint resolution",
            orderId: order.id,
          },
          req,
          txHash: receipt.transactionHash,
        });
      }
    }

    res.send({ message: "Complaint resolved" });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.getIntegrationJobs = async (req, res) => {
  try {
    const jobs = await integrationJobService.listJobs({
      status: normalizeOptionalString(req.query.status, null),
      jobType: normalizeOptionalString(req.query.jobType, null),
      activeOnly: parseBooleanQuery(req.query.activeOnly) === true,
      limit: req.query.limit,
    });

    return res.send(jobs);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.retryIntegrationJob = async (req, res) => {
  try {
    const job = await db.integrationJob.findByPk(req.params.jobId);
    if (!job) {
      return res.status(404).send({ message: "Integration job not found" });
    }

    const retriedJob = await integrationJobService.retryJob(job, {
      operator: req.user,
      req,
    });

    return res.send({
      message: "Integration job retried successfully",
      job: retriedJob,
    });
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};

exports.getAllComplaints = async (req, res) => {
  try {
    const page = parseIntegerQuery(req.query.page, 1, { min: 1 });
    const pageSize = parseIntegerQuery(req.query.pageSize || req.query.limit, 20, {
      min: 1,
      max: 100,
    });
    const keyword = normalizeOptionalString(req.query.q, null);
    const orderId = parseIntegerQuery(req.query.orderId, null, { min: 1 });
    const buyerId = parseIntegerQuery(req.query.buyerId, null, { min: 1 });
    const sellerId = parseIntegerQuery(req.query.sellerId, null, { min: 1 });
    const complaintType = normalizeComplaintType(req.query.complaintType, null);
    const hasSellerResponse = parseBooleanQuery(req.query.hasSellerResponse);
    const usePaginatedResponse = shouldUsePaginatedCollectionResponse(req.query, [
      "page",
      "pageSize",
      "limit",
      "q",
      "orderId",
      "buyerId",
      "sellerId",
      "complaintType",
      "hasSellerResponse",
    ]);

    const where = { status: 3 };
    const andConditions = [];
    if (orderId) {
      where.id = orderId;
    }
    if (buyerId) {
      where.buyerId = buyerId;
    }
    if (complaintType) {
      where.complaintType = complaintType;
    }
    if (hasSellerResponse === true) {
      andConditions.push({
        sellerResponse: { [Op.ne]: null },
      });
    } else if (hasSellerResponse === false) {
      andConditions.push({
        [Op.or]: [{ sellerResponse: null }, { sellerResponse: "" }],
      });
    }
    if (keyword) {
      andConditions.push({
        [Op.or]: [
          { complaintReason: { [Op.like]: `%${keyword}%` } },
          { sellerResponse: { [Op.like]: `%${keyword}%` } },
          { rulingDetails: { [Op.like]: `%${keyword}%` } },
        ],
      });
    }
    if (andConditions.length > 0) {
      where[Op.and] = andConditions;
    }

    const productInclude = {
      model: Product,
      as: "product",
      include: [
        {
          model: User,
          as: "seller",
          attributes: ["username", "id", "ethAddress"],
          ...(sellerId ? { where: { id: sellerId } } : {}),
        },
      ],
    };
    const buyerInclude = {
      model: User,
      as: "buyer",
      attributes: ["username", "id", "ethAddress"],
    };

    const complaints = await Order.findAll({
      where,
      include: [productInclude, buyerInclude],
      order: [["updatedAt", "DESC"]],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    for (const complaint of complaints) {
      try {
        const sellerSync = await syncSellerBlacklist(complaint.product.seller);
        complaint.product.seller.dataValues.score = sellerSync.reputationScore;
        complaint.product.seller.dataValues.isBlacklisted = sellerSync.isBlacklisted;
      } catch (error) {
        complaint.product.seller.dataValues.score = 60;
      }
    }

    if (!usePaginatedResponse) {
      return res.send(complaints);
    }

    const total = await Order.count({
      where,
      include: [productInclude, buyerInclude],
      distinct: true,
      col: "id",
    });

    return sendCollectionResponse(res, complaints, { page, pageSize, total }, true);
  } catch (error) {
    return res.status(500).send({ message: error.message });
  }
};
