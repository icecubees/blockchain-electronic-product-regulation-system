const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const db = require("../models");
const auditService = require("../services/audit.service");
const productController = require("../controllers/product.controller");
const { createMockRes } = require("./test-helpers");
const chainService = require("../services/chain.service");

function mockSequelizeTransaction(t) {
  const originalTransaction = db.sequelize.transaction;
  const transaction = {
    LOCK: {
      UPDATE: "UPDATE",
    },
  };

  db.sequelize.transaction = async (callback) => callback(transaction);
  t.after(() => {
    db.sequelize.transaction = originalTransaction;
  });

  return transaction;
}

test("shipOrder updates shipping metadata for seller-owned order", async (t) => {
  const originalFindByPk = db.order.findByPk;
  const originalRecord = auditService.record;
  const auditCalls = [];

  const order = {
    id: 12,
    status: 0,
    shippingStatus: "pending",
    trackingNumber: null,
    shippingCarrier: null,
    shippedAt: null,
    product: {
      sellerId: 9,
    },
    async save() {
      return this;
    },
  };

  db.order.findByPk = async () => order;
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };

  t.after(() => {
    db.order.findByPk = originalFindByPk;
    auditService.record = originalRecord;
  });

  const req = {
    body: {
      orderId: 12,
      trackingNumber: "SF123456789",
      shippingCarrier: "SF Express",
    },
    user: {
      id: 9,
      role: "seller",
      username: "seller_a",
    },
  };
  const res = createMockRes();

  await productController.shipOrder(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Order shipped successfully");
  assert.equal(order.shippingStatus, "shipped");
  assert.equal(order.trackingNumber, "SF123456789");
  assert.equal(order.shippingCarrier, "SF Express");
  assert.equal(auditCalls[0].action, "ORDER_SHIPPED");
});

test("respondToComplaint stores seller response and evidence", async (t) => {
  const originalFindByPk = db.order.findByPk;
  const originalRecord = auditService.record;
  const auditCalls = [];

  const order = {
    id: 22,
    status: 3,
    sellerResponse: null,
    sellerEvidenceIpfsHash: null,
    sellerRespondedAt: null,
    product: {
      sellerId: 7,
    },
    async save() {
      return this;
    },
  };

  db.order.findByPk = async () => order;
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };

  t.after(() => {
    db.order.findByPk = originalFindByPk;
    auditService.record = originalRecord;
  });

  const req = {
    body: {
      orderId: 22,
      response: "We shipped the correct item with valid packaging.",
      evidenceIpfsHash: "QmSellerEvidence",
    },
    user: {
      id: 7,
      role: "seller",
      username: "seller_b",
    },
  };
  const res = createMockRes();

  await productController.respondToComplaint(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Seller response submitted successfully");
  assert.equal(order.sellerResponse, "We shipped the correct item with valid packaging.");
  assert.equal(order.sellerEvidenceIpfsHash, "QmSellerEvidence");
  assert.equal(auditCalls[0].action, "SELLER_RESPONSE_SUBMITTED");
});

test("raiseComplaint stores structured complaint type", async (t) => {
  const originalFindByPkOrder = db.order.findByPk;
  const originalFindByPkUser = db.user.findByPk;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalRaiseComplaintMethod = chainService.contract.methods.raiseComplaint;

  const auditCalls = [];
  const order = {
    id: 61,
    buyerId: 4,
    status: 0,
    complaintType: null,
    complaintReason: null,
    evidenceIpfsHash: null,
    async save() {
      return this;
    },
  };

  db.order.findByPk = async () => order;
  db.user.findByPk = async () => ({ id: 4, ethAddress: "0xbuyer" });
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xcomplaint" });
  chainService.contract.methods.raiseComplaint = () => ({
    encodeABI: () => "0xraiseComplaint",
  });

  t.after(() => {
    db.order.findByPk = originalFindByPkOrder;
    db.user.findByPk = originalFindByPkUser;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.raiseComplaint = originalRaiseComplaintMethod;
  });

  const req = {
    body: {
      orderId: 61,
      complaintType: "battery_issue",
      reason: "Battery drains abnormally fast.",
      evidenceIpfsHash: "QmBuyerEvidence",
    },
    userId: 4,
    user: { id: 4, role: "buyer", username: "buyer_demo" },
  };
  const res = createMockRes();

  await productController.raiseComplaint(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(order.complaintType, "battery_issue");
  assert.equal(order.complaintReason, "Battery drains abnormally fast.");
  assert.equal(order.refundStatus, "pending_review");
  assert.equal(auditCalls[0].details.complaintType, "battery_issue");
});

test("createAfterSalesRequest stores buyer request for eligible order", async (t) => {
  const originalFindByPkOrder = db.order.findByPk;
  const originalFindOneRequest = db.afterSalesRequest.findOne;
  const originalCreateRequest = db.afterSalesRequest.create;
  const originalFindByPkRequest = db.afterSalesRequest.findByPk;
  const originalRecord = auditService.record;

  let createdPayload = null;
  const auditCalls = [];
  const order = {
    id: 91,
    productId: 14,
    buyerId: 5,
    status: 2,
    product: {
      id: 14,
      sellerId: 8,
    },
  };

  db.order.findByPk = async () => order;
  db.afterSalesRequest.findOne = async () => null;
  db.afterSalesRequest.create = async (payload) => {
    createdPayload = { id: 301, ...payload };
    return createdPayload;
  };
  db.afterSalesRequest.findByPk = async () => ({
    ...createdPayload,
    buyer: { id: 5, username: "buyer_demo", role: "buyer" },
  });
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };

  t.after(() => {
    db.order.findByPk = originalFindByPkOrder;
    db.afterSalesRequest.findOne = originalFindOneRequest;
    db.afterSalesRequest.create = originalCreateRequest;
    db.afterSalesRequest.findByPk = originalFindByPkRequest;
    auditService.record = originalRecord;
  });

  const req = {
    body: {
      orderId: 91,
      type: "repair",
      description: "The camera module keeps disconnecting after delivery.",
      evidenceIpfsHash: "QmAfterSalesRequest",
    },
    userId: 5,
    user: { id: 5, role: "buyer", username: "buyer_demo" },
  };
  const res = createMockRes();

  await productController.createAfterSalesRequest(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createdPayload.type, "repair");
  assert.equal(createdPayload.status, "pending_seller");
  assert.equal(createdPayload.evidenceIpfsHash, "QmAfterSalesRequest");
  assert.equal(auditCalls[0].action, "AFTER_SALES_REQUEST_CREATED");
});

test("respondToAfterSalesRequest stores seller response", async (t) => {
  const originalFindByPkRequest = db.afterSalesRequest.findByPk;
  const originalRecord = auditService.record;
  const auditCalls = [];

  const afterSalesRequest = {
    id: 302,
    orderId: 92,
    status: "pending_seller",
    sellerResponse: null,
    sellerEvidenceIpfsHash: null,
    sellerRespondedAt: null,
    order: {
      id: 92,
      product: {
        sellerId: 8,
      },
    },
    buyer: { id: 6, username: "buyer_two", role: "buyer" },
    async save() {
      return this;
    },
  };

  db.afterSalesRequest.findByPk = async () => afterSalesRequest;
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };

  t.after(() => {
    db.afterSalesRequest.findByPk = originalFindByPkRequest;
    auditService.record = originalRecord;
  });

  const req = {
    body: {
      requestId: 302,
      response: "We will replace the module and provide a prepaid return label.",
      evidenceIpfsHash: "QmSellerAfterSalesReply",
    },
    userId: 8,
    user: { id: 8, role: "seller", username: "seller_demo" },
  };
  const res = createMockRes();

  await productController.respondToAfterSalesRequest(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(afterSalesRequest.status, "seller_responded");
  assert.equal(
    afterSalesRequest.sellerResponse,
    "We will replace the module and provide a prepaid return label."
  );
  assert.equal(afterSalesRequest.sellerEvidenceIpfsHash, "QmSellerAfterSalesReply");
  assert.equal(auditCalls[0].action, "AFTER_SALES_REQUEST_RESPONDED");
});

test("raiseComplaint requires an after-sales request for ordinary issues", async (t) => {
  const originalFindByPkOrder = db.order.findByPk;
  const originalFindByPkUser = db.user.findByPk;
  const originalFindOneRequest = db.afterSalesRequest.findOne;

  db.order.findByPk = async () => ({
    id: 93,
    buyerId: 5,
    status: 2,
  });
  db.user.findByPk = async () => ({ id: 5, ethAddress: "0xbuyer" });
  db.afterSalesRequest.findOne = async () => null;

  t.after(() => {
    db.order.findByPk = originalFindByPkOrder;
    db.user.findByPk = originalFindByPkUser;
    db.afterSalesRequest.findOne = originalFindOneRequest;
  });

  const req = {
    body: {
      orderId: 93,
      complaintType: "performance_issue",
      reason: "The device runs far slower than advertised.",
    },
    userId: 5,
    user: { id: 5, role: "buyer", username: "buyer_demo" },
  };
  const res = createMockRes();

  await productController.raiseComplaint(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /after-sales request/i);
});

test("resolveComplaint records refund details when buyer wins", async (t) => {
  const originalFindByPkOrder = db.order.findByPk;
  const originalFindByPkProduct = db.product.findByPk;
  const originalFindByPkUser = db.user.findByPk;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalResolveComplaintMethod = chainService.contract.methods.resolveComplaint;
  const originalSellerMethod = chainService.contract.methods.sellers;

  const auditCalls = [];
  const order = {
    id: 72,
    productId: 11,
    buyerId: 4,
    onChainId: 172,
    price: 2.25,
    status: 3,
    paymentStatus: "paid",
    refundStatus: "pending_review",
    refundAmount: 0,
    refundedAt: null,
    async save() {
      return this;
    },
  };

  db.order.findByPk = async () => order;
  db.product.findByPk = async () => ({ id: 11, sellerId: 8 });
  db.user.findByPk = async () => ({ id: 8, role: "seller", ethAddress: "0xseller" });
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xresolve" });
  chainService.contract.methods.resolveComplaint = () => ({
    encodeABI: () => "0xresolveComplaint",
  });
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    db.order.findByPk = originalFindByPkOrder;
    db.product.findByPk = originalFindByPkProduct;
    db.user.findByPk = originalFindByPkUser;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.resolveComplaint = originalResolveComplaintMethod;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    body: {
      orderId: 72,
      rulingForBuyer: true,
      rulingDetails: "Refund approved after regulator review.",
    },
    userId: 2,
    user: { id: 2, role: "regulator", username: "regulator_demo" },
  };
  const res = createMockRes();

  await productController.resolveComplaint(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(order.status, 4);
  assert.equal(order.paymentStatus, "refunded");
  assert.equal(order.refundStatus, "refunded");
  assert.equal(order.refundAmount, 2.25);
  assert.ok(order.refundedAt instanceof Date);
  assert.ok(auditCalls.some((call) => call.action === "COMPLAINT_RESOLVED"));
  assert.ok(auditCalls.some((call) => call.action === "ORDER_REFUND_COMPLETED"));
});

test("recordAfterSales stores service history for seller-owned order", async (t) => {
  const originalFindByPkOrder = db.order.findByPk;
  const originalCreateAfterSales = db.afterSalesRecord.create;
  const originalFindByPkAfterSales = db.afterSalesRecord.findByPk;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalRecordProductRepair = chainService.contract.methods.recordProductRepair;

  let createdPayload = null;
  const auditCalls = [];
  const order = {
    id: 81,
    productId: 12,
    product: {
      id: 12,
      onChainId: 112,
      sellerId: 9,
    },
  };

  db.order.findByPk = async () => order;
  db.afterSalesRecord.create = async (payload) => {
    createdPayload = { id: 201, ...payload };
    return createdPayload;
  };
  db.afterSalesRecord.findByPk = async () => ({
    ...createdPayload,
    creator: { id: 9, username: "seller_demo", role: "seller" },
  });
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xrepair" });
  chainService.contract.methods.recordProductRepair = () => ({
    encodeABI: () => "0xrecordRepair",
  });

  t.after(() => {
    db.order.findByPk = originalFindByPkOrder;
    db.afterSalesRecord.create = originalCreateAfterSales;
    db.afterSalesRecord.findByPk = originalFindByPkAfterSales;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.recordProductRepair = originalRecordProductRepair;
  });

  const req = {
    body: {
      orderId: 81,
      type: "repair",
      componentName: "Battery Module",
      description: "Replaced unstable battery module after inspection.",
      serviceResult: "Battery replaced and calibrated",
      evidenceIpfsHash: "QmAfterSales",
    },
    userId: 9,
    user: { id: 9, role: "seller", username: "seller_demo" },
  };
  const res = createMockRes();

  await productController.recordAfterSales(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(createdPayload.type, "repair");
  assert.equal(createdPayload.componentName, "Battery Module");
  assert.equal(createdPayload.serviceResult, "Battery replaced and calibrated");
  assert.equal(auditCalls[0].action, "PRODUCT_REPAIR_RECORDED");
});

test("getAllProducts supports electronic category filtering", async (t) => {
  const originalFindAndCountAll = db.product.findAndCountAll;
  const originalProductCount = db.product.count;
  const originalOrderCount = db.order.count;
  const originalAfterSalesCount = db.afterSalesRecord.count;
  const originalSellerMethod = chainService.contract.methods.sellers;

  const rows = [
    {
      id: 31,
      category: "laptop",
      seller: {
        id: 9,
        isBlacklisted: false,
        ethAddress: "0xseller1",
      },
      dataValues: {},
    },
  ];

  db.product.findAndCountAll = async (query) => {
    assert.equal(query.where.category, "laptop");
    return { count: 1, rows };
  };
  db.product.count = async () => 0;
  db.order.count = async () => 0;
  db.afterSalesRecord.count = async () => 0;
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller1",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    db.product.findAndCountAll = originalFindAndCountAll;
    db.product.count = originalProductCount;
    db.order.count = originalOrderCount;
    db.afterSalesRecord.count = originalAfterSalesCount;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    query: {
      category: "laptop",
      page: "1",
      pageSize: "8",
    },
  };
  const res = createMockRes();

  await productController.getAllProducts(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].dataValues.sellerScore, 60);
});

test("getProductTrace returns electronic product metadata", async (t) => {
  const originalFindByPkProduct = db.product.findByPk;
  const originalFindAllOrders = db.order.findAll;
  const originalFindAllAfterSales = db.afterSalesRecord.findAll;
  const originalAfterSalesCount = db.afterSalesRecord.count;
  const originalOrderCount = db.order.count;
  const originalProductCount = db.product.count;
  const originalFindAllAuditLogs = db.auditLog.findAll;
  const originalSellerMethod = chainService.contract.methods.sellers;
  const originalProductsMethod = chainService.contract.methods.products;

  db.product.findByPk = async () => ({
    id: 88,
    onChainId: 8,
    name: "Gaming Laptop",
    description: "RTX laptop",
    brand: "OpenAI Devices",
    model: "GX-15",
    category: "laptop",
    serialNumber: "SN123456789",
    batchNo: "BATCH-2026-01",
    manufactureDate: new Date("2026-01-01T00:00:00.000Z"),
    warrantyUntil: new Date("2028-01-01T00:00:00.000Z"),
    isUsed: false,
    isRefurbished: true,
    batteryHealth: 91,
    accessoryStatus: "full",
    cccNumber: "CCC-TEST-001",
    energyLevel: "Level 1",
    rohsStatus: "Compliant",
    inspectionAgency: "Lab A",
    inspectionDate: new Date("2026-01-02T00:00:00.000Z"),
    inspectionConclusion: "pass",
    batterySafetyPassed: true,
    chargerSafetyPassed: true,
    appearanceGrade: "A",
    functionalTestPassed: true,
    repairHistoryDeclared: false,
    price: 2.5,
    stock: 5,
    auditStatus: 1,
    auditReason: "Approved",
    ipfsHash: "QmReport",
    qualificationHash: "QmCert",
    txHash: "0xabc",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    auditAt: new Date("2026-01-03T00:00:00.000Z"),
    delistedAt: null,
    delistReason: null,
    auditBy: null,
    seller: {
      id: 7,
      username: "seller-laptop",
      ethAddress: "0xseller2",
      isBlacklisted: false,
      qualificationType: "brand_authorized",
    },
  });
  db.order.findAll = async () => [];
  db.afterSalesRecord.findAll = async () => [
    {
      id: 301,
      orderId: 9901,
      productId: 88,
      type: "repair",
      componentName: "Battery",
      description: "Battery pack replaced by seller.",
      serviceResult: "Restored to stable charging state",
      evidenceIpfsHash: "QmAfterSales",
      createdAt: new Date("2026-01-07T00:00:00.000Z"),
      creator: { id: 7, username: "seller-laptop", role: "seller" },
    },
  ];
  db.afterSalesRecord.count = async () => 1;
  db.order.count = async () => 0;
  db.product.count = async ({ where }) => {
    if (where?.cccNumber === "CCC-TEST-001") {
      return 1;
    }
    if (where?.serialNumber === "SN123456789") {
      return 0;
    }
    return 0;
  };
  db.auditLog.findAll = async () => [];
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller2",
      isBlacklisted: false,
      reputationScore: "73",
    }),
  });
  chainService.contract.methods.products = () => ({
    call: async () => ({
      id: "8",
      isAudited: true,
      isDelisted: false,
      stock: "5",
      seller: "0xseller2",
      brand: "OpenAI Devices",
      model: "GX-15",
      category: "laptop",
      deviceIdHash: "0xdevicehash",
      cccNumberHash: "0xccchash",
      riskLevel: "1",
      recallFlag: false,
      exists: true,
    }),
  });

  t.after(() => {
    db.product.findByPk = originalFindByPkProduct;
    db.order.findAll = originalFindAllOrders;
    db.afterSalesRecord.findAll = originalFindAllAfterSales;
    db.afterSalesRecord.count = originalAfterSalesCount;
    db.order.count = originalOrderCount;
    db.product.count = originalProductCount;
    db.auditLog.findAll = originalFindAllAuditLogs;
    chainService.contract.methods.sellers = originalSellerMethod;
    chainService.contract.methods.products = originalProductsMethod;
  });

  const req = { params: { productId: "88" } };
  const res = createMockRes();

  await productController.getProductTrace(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.brand, "OpenAI Devices");
  assert.equal(res.body.model, "GX-15");
  assert.equal(res.body.category, "laptop");
  assert.equal(res.body.serialNumberMasked, "SN1***789");
  assert.equal(res.body.compliance.inspectionAgency, "Lab A");
  assert.equal(res.body.compliance.batterySafetyPassed, true);
  assert.equal(res.body.chainSummary.deviceIdHash, "0xdevicehash");
  assert.equal(res.body.chainSummary.riskLevel, 1);
  assert.equal(res.body.riskProfile.riskLevel, "medium");
  assert.ok(res.body.riskProfile.riskTags.includes("reused_ccc_number"));
  assert.equal(res.body.afterSalesRecords.length, 1);
  assert.equal(res.body.afterSalesRecords[0].type, "repair");
});

test("auditProduct blocks approval when required electronic fields are missing", async (t) => {
  const originalFindByPkProduct = db.product.findByPk;
  const originalRecord = auditService.record;
  const auditCalls = [];

  db.product.findByPk = async () => ({
    id: 45,
    auditStatus: 0,
    category: "mobile_phone",
    brand: "OpenAI Devices",
    model: null,
    serialNumber: null,
    isUsed: false,
    isRefurbished: false,
  });
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };

  t.after(() => {
    db.product.findByPk = originalFindByPkProduct;
    auditService.record = originalRecord;
  });

  const req = {
    body: {
      productId: 45,
      decision: 1,
      reason: "Approve",
    },
    userId: 1,
    user: { id: 1, role: "regulator", username: "regulator_demo" },
  };
  const res = createMockRes();

  await productController.auditProduct(req, res);

  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /Electronic-device review requirements are incomplete/);
  assert.ok(Array.isArray(res.body.missingItems));
  assert.ok(res.body.missingItems.some((item) => item.includes("Model is required")));
  assert.equal(auditCalls[0].action, "PRODUCT_REVIEW_BLOCKED");
});

test("recallProduct marks product as recalled and delisted", async (t) => {
  const originalFindByPkProduct = db.product.findByPk;
  const originalFindAllOrders = db.order.findAll;
  const originalBulkCreateRecallNotifications = db.recallNotification.bulkCreate;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalDelistMethod = chainService.contract.methods.delistProduct;
  const transaction = mockSequelizeTransaction(t);

  const auditCalls = [];
  let createdNotifications = [];
  const product = {
    id: 52,
    onChainId: 0,
    batchNo: "B-2026-02",
    recallStatus: false,
    recallReason: null,
    recallNoticeAt: null,
    recallBatchNo: null,
    auditStatus: 1,
    stock: 6,
    delistReason: null,
    delistedBy: null,
    delistedAt: null,
    async save(options = {}) {
      assert.equal(options.transaction, transaction);
      return this;
    },
  };

  db.product.findByPk = async (_id, options = {}) => {
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return product;
  };
  db.order.findAll = async (_query) => [
    { id: 901, buyerId: 12 },
    { id: 902, buyerId: 13 },
  ];
  db.recallNotification.bulkCreate = async (payload, options = {}) => {
    assert.equal(options.transaction, transaction);
    createdNotifications = payload;
    return payload;
  };
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xrecall" });
  chainService.contract.methods.delistProduct = () => ({
    encodeABI: () => "0xdelist",
  });

  t.after(() => {
    db.product.findByPk = originalFindByPkProduct;
    db.order.findAll = originalFindAllOrders;
    db.recallNotification.bulkCreate = originalBulkCreateRecallNotifications;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.delistProduct = originalDelistMethod;
  });

  const req = {
    body: {
      productId: 52,
      reason: "Battery overheating risk",
      batchNo: "B-2026-02",
    },
    userId: 1,
    user: { id: 1, role: "regulator", username: "regulator_demo" },
  };
  const res = createMockRes();

  await productController.recallProduct(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(product.recallStatus, true);
  assert.equal(product.auditStatus, 2);
  assert.equal(product.stock, 0);
  assert.equal(product.recallReason, "Battery overheating risk");
  assert.equal(product.recallBatchNo, "B-2026-02");
  assert.equal(res.body.notificationsCreated, 2);
  assert.equal(createdNotifications.length, 2);
  assert.equal(createdNotifications[0].orderId, 901);
  assert.equal(createdNotifications[0].status, "pending");
  assert.equal(auditCalls[0].action, "PRODUCT_RECALL_FLAGGED");
  assert.equal(auditCalls[1].action, "RECALL_NOTIFICATIONS_CREATED");
});

test("updateRecallNotificationStatus acknowledges a buyer recall notice", async (t) => {
  const originalFindByPkRecallNotification = db.recallNotification.findByPk;
  const originalRecord = auditService.record;
  const auditCalls = [];
  const notification = {
    id: 61,
    buyerId: 4,
    productId: 91,
    orderId: 71,
    status: "pending",
    viewedAt: null,
    acknowledgedAt: null,
    product: {
      id: 91,
      name: "Recall Phone",
      recallStatus: true,
      recallReason: "Battery issue",
      recallNoticeAt: new Date("2026-04-15T00:00:00.000Z"),
      recallBatchNo: "B-2026-03",
    },
    order: {
      id: 71,
      status: 1,
      shippingStatus: "delivered",
    },
    async save() {
      return this;
    },
  };

  db.recallNotification.findByPk = async () => notification;
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };

  t.after(() => {
    db.recallNotification.findByPk = originalFindByPkRecallNotification;
    auditService.record = originalRecord;
  });

  const req = {
    params: { notificationId: "61" },
    body: { status: "acknowledged" },
    userId: 4,
    user: { id: 4, role: "buyer", username: "buyer_demo" },
  };
  const res = createMockRes();

  await productController.updateRecallNotificationStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(notification.status, "acknowledged");
  assert.ok(notification.viewedAt instanceof Date);
  assert.ok(notification.acknowledgedAt instanceof Date);
  assert.equal(auditCalls[0].action, "RECALL_NOTIFICATION_UPDATED");
});

test("purchaseProduct decrements stock within a locked transaction", async (t) => {
  const originalFindByPkUser = db.user.findByPk;
  const originalFindByPkProduct = db.product.findByPk;
  const originalOrderCreate = db.order.create;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalPurchaseProductMethod = chainService.contract.methods.purchaseProduct;
  const originalOrderCountMethod = chainService.contract.methods.orderCount;
  const originalSellerMethod = chainService.contract.methods.sellers;
  const transaction = mockSequelizeTransaction(t);

  const auditCalls = [];
  let orderCreateOptions = null;
  let orderCreatePayload = null;
  const product = {
    id: 91,
    sellerId: 8,
    onChainId: 191,
    auditStatus: 1,
    recallStatus: false,
    stock: 2,
    price: 1.5,
    async save(options = {}) {
      assert.equal(options.transaction, transaction);
      return this;
    },
  };

  db.user.findByPk = async (id) => {
    if (id === 4) {
      return { id: 4, ethAddress: "0xbuyer" };
    }

    return { id: 8, role: "seller", ethAddress: "0xseller", isBlacklisted: false };
  };
  db.product.findByPk = async (_id, options = {}) => {
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return product;
  };
  db.order.create = async (payload, options = {}) => {
    orderCreatePayload = payload;
    orderCreateOptions = options;
    return { id: 601, ...payload };
  };
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xpurchase" });
  chainService.contract.methods.purchaseProduct = () => ({
    encodeABI: () => "0xpurchaseProduct",
  });
  chainService.contract.methods.orderCount = () => ({
    call: async () => "9",
  });
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    db.user.findByPk = originalFindByPkUser;
    db.product.findByPk = originalFindByPkProduct;
    db.order.create = originalOrderCreate;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.purchaseProduct = originalPurchaseProductMethod;
    chainService.contract.methods.orderCount = originalOrderCountMethod;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    body: {
      productId: 91,
    },
    userId: 4,
    user: { id: 4, role: "buyer", username: "buyer_demo" },
  };
  const res = createMockRes();

  await productController.purchaseProduct(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Purchase successful");
  assert.equal(product.stock, 1);
  assert.equal(orderCreatePayload.paymentStatus, "paid");
  assert.equal(orderCreatePayload.paymentMethod, "platform_simulated");
  assert.equal(orderCreatePayload.paymentReference, "CHAIN_ORDER_9");
  assert.equal(orderCreatePayload.refundStatus, "none");
  assert.equal(orderCreatePayload.refundAmount, 0);
  assert.ok(orderCreatePayload.paidAt instanceof Date);
  assert.equal(orderCreateOptions.transaction, transaction);
  assert.equal(auditCalls[0].action, "PRODUCT_PURCHASED");
  assert.ok(auditCalls.some((call) => call.action === "ORDER_PAYMENT_RECORDED"));
});

test("purchaseProduct creates an integration job when chain submission fails", async (t) => {
  const originalFindByPkUser = db.user.findByPk;
  const originalFindByPkProduct = db.product.findByPk;
  const originalIntegrationJobCreate = db.integrationJob.create;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalPurchaseProductMethod = chainService.contract.methods.purchaseProduct;
  const originalSellerMethod = chainService.contract.methods.sellers;
  const transaction = mockSequelizeTransaction(t);

  let createdJob = null;
  const product = {
    id: 95,
    sellerId: 8,
    onChainId: 195,
    auditStatus: 1,
    recallStatus: false,
    stock: 3,
    price: 1.6,
  };

  db.user.findByPk = async (id) => {
    if (id === 4) {
      return { id: 4, ethAddress: "0xbuyer" };
    }

    return { id: 8, role: "seller", ethAddress: "0xseller", isBlacklisted: false };
  };
  db.product.findByPk = async (_id, options = {}) => {
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return product;
  };
  db.integrationJob.create = async (payload) => {
    createdJob = { id: 701, ...payload };
    return createdJob;
  };
  auditService.record = async () => {};
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => {
    throw new Error("chain offline");
  };
  chainService.contract.methods.purchaseProduct = () => ({
    encodeABI: () => "0xpurchaseProduct",
  });
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    db.user.findByPk = originalFindByPkUser;
    db.product.findByPk = originalFindByPkProduct;
    db.integrationJob.create = originalIntegrationJobCreate;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.purchaseProduct = originalPurchaseProductMethod;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    body: {
      productId: 95,
    },
    userId: 4,
    user: { id: 4, role: "buyer", username: "buyer_demo" },
  };
  const res = createMockRes();

  await productController.purchaseProduct(req, res);

  assert.equal(res.statusCode, 500);
  assert.match(res.body.message, /chain offline/);
  assert.equal(createdJob.jobType, "purchase_product");
  assert.equal(createdJob.targetType, "ORDER");
  assert.equal(createdJob.status, "pending");
  assert.match(createdJob.payload, /"productId":95/);
  assert.match(createdJob.payload, /"buyerId":4/);
});

test("retryIntegrationJob replays a failed purchase integration job", async (t) => {
  const originalJobFindByPk = db.integrationJob.findByPk;
  const originalProductFindByPk = db.product.findByPk;
  const originalUserFindByPk = db.user.findByPk;
  const originalOrderFindOne = db.order.findOne;
  const originalOrderCreate = db.order.create;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalPurchaseProductMethod = chainService.contract.methods.purchaseProduct;
  const originalOrderCountMethod = chainService.contract.methods.orderCount;
  const originalSellerMethod = chainService.contract.methods.sellers;
  const transaction = mockSequelizeTransaction(t);

  let createdOrder = null;
  const job = {
    id: 801,
    jobType: "purchase_product",
    targetType: "ORDER",
    targetId: "95",
    status: "pending",
    retryCount: 0,
    maxRetries: 5,
    lastError: "chain offline",
    payload: JSON.stringify({
      productId: 95,
      buyerId: 4,
      price: 1.6,
      paidAt: "2026-04-15T00:00:00.000Z",
    }),
    completedAt: null,
    lastAttemptAt: null,
    async save() {
      return this;
    },
  };
  const product = {
    id: 95,
    sellerId: 8,
    onChainId: 195,
    auditStatus: 1,
    recallStatus: false,
    stock: 3,
    price: 1.6,
    async save(options = {}) {
      assert.equal(options.transaction, transaction);
      return this;
    },
  };

  db.integrationJob.findByPk = async () => job;
  db.product.findByPk = async (_id, options = {}) => {
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return product;
  };
  db.user.findByPk = async (id) => {
    if (id === 4) {
      return { id: 4, ethAddress: "0xbuyer" };
    }

    return { id: 8, role: "seller", ethAddress: "0xseller", isBlacklisted: false };
  };
  db.order.findOne = async () => null;
  db.order.create = async (payload, options = {}) => {
    assert.equal(options.transaction, transaction);
    createdOrder = { id: 802, ...payload };
    return createdOrder;
  };
  auditService.record = async () => {};
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xretrypurchase" });
  chainService.contract.methods.purchaseProduct = () => ({
    encodeABI: () => "0xpurchaseProduct",
  });
  chainService.contract.methods.orderCount = () => ({
    call: async () => "14",
  });
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    db.integrationJob.findByPk = originalJobFindByPk;
    db.product.findByPk = originalProductFindByPk;
    db.user.findByPk = originalUserFindByPk;
    db.order.findOne = originalOrderFindOne;
    db.order.create = originalOrderCreate;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.purchaseProduct = originalPurchaseProductMethod;
    chainService.contract.methods.orderCount = originalOrderCountMethod;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    params: { jobId: "801" },
    user: { id: 1, role: "regulator", username: "regulator_demo" },
  };
  const res = createMockRes();

  await productController.retryIntegrationJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Integration job retried successfully");
  assert.equal(job.status, "completed");
  assert.equal(job.retryCount, 1);
  assert.ok(job.completedAt instanceof Date);
  assert.equal(product.stock, 2);
  assert.equal(createdOrder.onChainId, 14);
  assert.equal(createdOrder.paymentReference, "CHAIN_ORDER_14");
});

test("restockProduct updates stock within a locked transaction", async (t) => {
  const originalFindByPkProduct = db.product.findByPk;
  const originalFindByPkUser = db.user.findByPk;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalRestockProductMethod = chainService.contract.methods.restockProduct;
  const originalSellerMethod = chainService.contract.methods.sellers;
  const transaction = mockSequelizeTransaction(t);

  const auditCalls = [];
  const product = {
    id: 71,
    sellerId: 9,
    onChainId: 171,
    auditStatus: 1,
    recallStatus: false,
    stock: 4,
    async save(options = {}) {
      assert.equal(options.transaction, transaction);
      return this;
    },
  };

  db.product.findByPk = async (_id, options = {}) => {
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return product;
  };
  db.user.findByPk = async () => ({
    id: 9,
    role: "seller",
    ethAddress: "0xseller-restock",
    isBlacklisted: false,
  });
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xrestock" });
  chainService.contract.methods.restockProduct = () => ({
    encodeABI: () => "0xrestockProduct",
  });
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller-restock",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    db.product.findByPk = originalFindByPkProduct;
    db.user.findByPk = originalFindByPkUser;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.restockProduct = originalRestockProductMethod;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    body: {
      productId: 71,
      amount: 3,
    },
    user: { id: 9, role: "seller", username: "seller_demo" },
  };
  const res = createMockRes();

  await productController.restockProduct(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(product.stock, 7);
  assert.equal(auditCalls[0].action, "PRODUCT_RESTOCKED");
});

test("delistProduct zeroes stock within a locked transaction", async (t) => {
  const originalFindByPkProduct = db.product.findByPk;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalDelistMethod = chainService.contract.methods.delistProduct;
  const transaction = mockSequelizeTransaction(t);

  const auditCalls = [];
  const product = {
    id: 41,
    sellerId: 6,
    onChainId: 141,
    auditStatus: 1,
    stock: 5,
    delistReason: null,
    delistedBy: null,
    delistedAt: null,
    async save(options = {}) {
      assert.equal(options.transaction, transaction);
      return this;
    },
  };

  db.product.findByPk = async (_id, options = {}) => {
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return product;
  };
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xdelist" });
  chainService.contract.methods.delistProduct = () => ({
    encodeABI: () => "0xdelistProduct",
  });

  t.after(() => {
    db.product.findByPk = originalFindByPkProduct;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.delistProduct = originalDelistMethod;
  });

  const req = {
    body: {
      productId: 41,
      reason: "Manual delist",
    },
    userId: 6,
    user: { id: 6, role: "seller", username: "seller_owner" },
  };
  const res = createMockRes();

  await productController.delistProduct(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(product.stock, 0);
  assert.equal(product.auditStatus, 2);
  assert.equal(auditCalls[0].action, "PRODUCT_DELISTED");
});

test("addProduct degrades AI service failures to manual review", async (t) => {
  const originalAxiosPost = axios.post;
  const originalUserFindByPk = db.user.findByPk;
  const originalProductCreate = db.product.create;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalCreateProductMethod = chainService.contract.methods.createProduct;
  const originalProductCountMethod = chainService.contract.methods.productCount;
  const originalUpdateProductComplianceMethod = chainService.contract.methods.updateProductCompliance;
  const originalSellerMethod = chainService.contract.methods.sellers;

  let createdProduct = null;
  const auditCalls = [];

  axios.post = async () => {
    throw new Error("AI service offline");
  };
  db.user.findByPk = async () => ({
    id: 5,
    role: "seller",
    status: 1,
    ethAddress: "0xseller-create",
    isBlacklisted: false,
  });
  db.product.create = async (payload) => {
    createdProduct = { id: 501, ...payload };
    return createdProduct;
  };
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xcreate-manual" });
  chainService.contract.methods.createProduct = () => ({
    encodeABI: () => "0xcreateProduct",
  });
  chainService.contract.methods.productCount = () => ({
    call: async () => "11",
  });
  chainService.contract.methods.updateProductCompliance = () => ({
    encodeABI: () => "0xupdateCompliance",
  });
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller-create",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    axios.post = originalAxiosPost;
    db.user.findByPk = originalUserFindByPk;
    db.product.create = originalProductCreate;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.createProduct = originalCreateProductMethod;
    chainService.contract.methods.productCount = originalProductCountMethod;
    chainService.contract.methods.updateProductCompliance = originalUpdateProductComplianceMethod;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    body: {
      name: "Manual Review Phone",
      price: "1.88",
      description: "AI should degrade to manual review.",
      ipfsHash: "QmReport",
      qualificationHash: "QmCert",
      stock: "3",
      category: "mobile_phone",
    },
    file: null,
    userId: 5,
    user: { id: 5, role: "seller", username: "seller_create" },
  };
  const res = createMockRes();

  await productController.addProduct(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(
    res.body.message,
    "AI pre-audit is temporarily unavailable. Routed to manual review."
  );
  assert.equal(res.body.aiAssessment.serviceUnavailable, true);
  assert.equal(createdProduct.auditStatus, 0);
  assert.equal(createdProduct.auditReason, "AI service unavailable. Routed to manual review.");
  assert.ok(auditCalls.some((call) => call.action === "PRODUCT_CREATED"));
  assert.ok(
    auditCalls.some((call) => call.action === "PRODUCT_AI_DEGRADED_TO_MANUAL_REVIEW")
  );
});

test("resubmitProduct degrades AI service failures to manual review", async (t) => {
  const originalAxiosPost = axios.post;
  const originalUserFindByPk = db.user.findByPk;
  const originalProductFindByPk = db.product.findByPk;
  const originalRecord = auditService.record;
  const originalGetGasPrice = chainService.web3.eth.getGasPrice;
  const originalGetAccounts = chainService.web3.eth.getAccounts;
  const originalSendTransaction = chainService.web3.eth.sendTransaction;
  const originalCreateProductMethod = chainService.contract.methods.createProduct;
  const originalProductCountMethod = chainService.contract.methods.productCount;
  const originalUpdateProductComplianceMethod = chainService.contract.methods.updateProductCompliance;
  const originalSellerMethod = chainService.contract.methods.sellers;

  const auditCalls = [];
  const product = {
    id: 77,
    sellerId: 7,
    auditStatus: 2,
    recallStatus: false,
    name: "Old Phone",
    description: "Old description",
    price: 1.11,
    stock: 1,
    ipfsHash: "QmOldReport",
    qualificationHash: "QmOldCert",
    category: "mobile_phone",
    brand: "OpenAI Devices",
    model: "PX-1",
    serialNumber: "SN-OLD-001",
    batchNo: "BATCH-OLD",
    async save() {
      return this;
    },
  };

  axios.post = async () => {
    throw new Error("AI service offline");
  };
  db.user.findByPk = async () => ({
    id: 7,
    role: "seller",
    status: 1,
    ethAddress: "0xseller-resubmit",
    isBlacklisted: false,
  });
  db.product.findByPk = async () => product;
  auditService.record = async (payload) => {
    auditCalls.push(payload);
  };
  chainService.web3.eth.getGasPrice = async () => "1";
  chainService.web3.eth.getAccounts = async () => ["0xadmin", "0xregulator", "0xmarket"];
  chainService.web3.eth.sendTransaction = async () => ({ transactionHash: "0xresubmit-manual" });
  chainService.contract.methods.createProduct = () => ({
    encodeABI: () => "0xcreateProduct",
  });
  chainService.contract.methods.productCount = () => ({
    call: async () => "22",
  });
  chainService.contract.methods.updateProductCompliance = () => ({
    encodeABI: () => "0xupdateCompliance",
  });
  chainService.contract.methods.sellers = () => ({
    call: async () => ({
      walletAddress: "0xseller-resubmit",
      isBlacklisted: false,
      reputationScore: "60",
    }),
  });

  t.after(() => {
    axios.post = originalAxiosPost;
    db.user.findByPk = originalUserFindByPk;
    db.product.findByPk = originalProductFindByPk;
    auditService.record = originalRecord;
    chainService.web3.eth.getGasPrice = originalGetGasPrice;
    chainService.web3.eth.getAccounts = originalGetAccounts;
    chainService.web3.eth.sendTransaction = originalSendTransaction;
    chainService.contract.methods.createProduct = originalCreateProductMethod;
    chainService.contract.methods.productCount = originalProductCountMethod;
    chainService.contract.methods.updateProductCompliance = originalUpdateProductComplianceMethod;
    chainService.contract.methods.sellers = originalSellerMethod;
  });

  const req = {
    body: {
      productId: 77,
      name: "Updated Phone",
      description: "Updated description",
      price: "2.50",
      stock: "2",
      ipfsHash: "QmNewReport",
      qualificationHash: "QmNewCert",
      category: "mobile_phone",
      brand: "OpenAI Devices",
      model: "PX-2",
      serialNumber: "SN-NEW-001",
    },
    userId: 7,
    user: { id: 7, role: "seller", username: "seller_resubmit" },
  };
  const res = createMockRes();

  await productController.resubmitProduct(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(
    res.body.message,
    "AI pre-audit is temporarily unavailable. Routed this resubmission to manual review."
  );
  assert.equal(res.body.aiAssessment.serviceUnavailable, true);
  assert.equal(product.auditStatus, 0);
  assert.equal(product.auditReason, "AI service unavailable. Routed to manual review.");
  assert.equal(product.ipfsHash, "QmNewReport");
  assert.equal(product.qualificationHash, "QmNewCert");
  assert.equal(product.onChainId, 22);
  assert.ok(auditCalls.some((call) => call.action === "PRODUCT_RESUBMITTED"));
  assert.ok(
    auditCalls.some((call) => call.action === "PRODUCT_AI_DEGRADED_TO_MANUAL_REVIEW")
  );
});
