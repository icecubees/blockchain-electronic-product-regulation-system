const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../models");
const auditController = require("../controllers/audit.controller");
const { createMockRes } = require("./test-helpers");

test("getAuditStats returns electronics-specific summary metrics", async (t) => {
  const originalAuditFindAll = db.auditLog.findAll;
  const originalProductCount = db.product.count;
  const originalOrderCount = db.order.count;
  const originalOrderFindAll = db.order.findAll;
  const originalUserCount = db.user.count;
  const originalProductFindAll = db.product.findAll;

  let productCountCall = 0;
  let orderCountCall = 0;

  db.auditLog.findAll = async () => [
    { action: "PRODUCT_RECALL_FLAGGED", createdAt: "2026-04-15T08:00:00.000Z" },
    { action: "PRODUCT_REVIEW_BLOCKED", createdAt: "2026-04-15T09:00:00.000Z" },
    { action: "ORDER_SHIPPED", createdAt: "2026-04-15T10:00:00.000Z" },
  ];
  db.product.count = async () => {
    productCountCall += 1;
    return [12, 3, 2, 5, 1, 4][productCountCall - 1] ?? 0;
  };
  db.order.count = async () => {
    orderCountCall += 1;
    return [1, 4, 2][orderCountCall - 1] ?? 0;
  };
  db.order.findAll = async () => [
    { complaintType: "battery_issue", get: () => "3" },
    { complaintType: "performance_issue", get: () => "1" },
  ];
  db.user.count = async () => 6;
  db.product.findAll = async () => [{ sellerId: 11 }, { sellerId: 12 }];

  t.after(() => {
    db.auditLog.findAll = originalAuditFindAll;
    db.product.count = originalProductCount;
    db.order.count = originalOrderCount;
    db.order.findAll = originalOrderFindAll;
    db.user.count = originalUserCount;
    db.product.findAll = originalProductFindAll;
  });

  const req = {
    query: {
      days: "7",
    },
  };
  const res = createMockRes();

  await auditController.getAuditStats(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary.recalledProducts, 2);
  assert.equal(res.body.summary.usedOrRefurbishedActiveProducts, 5);
  assert.equal(res.body.summary.productsMissingCcc, 1);
  assert.equal(res.body.summary.batteryComplaintCount, 2);
  assert.equal(res.body.summary.riskySellersCount, 6);
  assert.equal(res.body.summary.productsWithHighRiskTags, 4);
  assert.equal(res.body.complaintTypeBreakdown[0].complaintType, "battery_issue");
  assert.equal(res.body.complaintTypeBreakdown[0].count, 3);
  assert.ok(res.body.trends.some((bucket) => bucket.recalls >= 0));
  assert.ok(res.body.trends.some((bucket) => bucket.reviewBlocks >= 0));
});

test("getAuditLogs supports advanced filters and pagination", async (t) => {
  const originalAuditFindAll = db.auditLog.findAll;
  const originalAuditCount = db.auditLog.count;

  let capturedFindAllQuery = null;
  let capturedCountQuery = null;

  db.auditLog.findAll = async (query) => {
    capturedFindAllQuery = query;
    return [
      {
        id: 2001,
        action: "ORDER_REFUND_COMPLETED",
        targetType: "ORDER",
        targetId: "33",
      },
    ];
  };
  db.auditLog.count = async (query) => {
    capturedCountQuery = query;
    return 21;
  };

  t.after(() => {
    db.auditLog.findAll = originalAuditFindAll;
    db.auditLog.count = originalAuditCount;
  });

  const req = {
    query: {
      keyword: "refund",
      operatorKeyword: "regulator_demo",
      targetId: "33",
      action: "ORDER_REFUND_COMPLETED",
      result: "SUCCESS",
      targetType: "ORDER",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-15",
      page: "2",
      pageSize: "5",
    },
  };
  const res = createMockRes();

  await auditController.getAuditLogs(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 1);
  assert.deepEqual(res.body.pagination, {
    page: 2,
    pageSize: 5,
    total: 21,
    totalPages: 5,
  });
  assert.equal(capturedFindAllQuery.limit, 5);
  assert.equal(capturedFindAllQuery.offset, 5);
  assert.equal(capturedFindAllQuery.where.action, "ORDER_REFUND_COMPLETED");
  assert.equal(capturedFindAllQuery.where.result, "SUCCESS");
  assert.equal(capturedFindAllQuery.where.targetType, "ORDER");
  assert.equal(capturedFindAllQuery.where.targetId, "33");
  assert.equal(
    capturedFindAllQuery.where.createdAt[db.Sequelize.Op.gte].toISOString(),
    "2026-04-01T00:00:00.000Z"
  );
  assert.equal(
    capturedFindAllQuery.where.createdAt[db.Sequelize.Op.lte].toISOString(),
    "2026-04-15T23:59:59.999Z"
  );
  assert.equal(capturedFindAllQuery.where[db.Sequelize.Op.and].length, 2);
  assert.deepEqual(capturedCountQuery, { where: capturedFindAllQuery.where });
});
