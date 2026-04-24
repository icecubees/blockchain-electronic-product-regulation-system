const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../models");
const authController = require("../controllers/auth.controller");
const auditService = require("../services/audit.service");
const { createMockRes } = require("./test-helpers");

test("register rejects elevated self-registration roles", async (t) => {
  const originalFindOne = db.user.findOne;

  db.user.findOne = async () => null;
  t.after(() => {
    db.user.findOne = originalFindOne;
  });

  const req = {
    body: {
      username: "attacker",
      password: "Passw0rd!",
      role: "regulator",
    },
  };
  const res = createMockRes();

  await authController.register(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "仅支持买家和卖家自行注册");
});

test("register creates seller in pending status with electronics qualification metadata", async (t) => {
  const originalFindOne = db.user.findOne;
  const originalCreate = db.user.create;
  let createdPayload = null;

  db.user.findOne = async () => null;
  db.user.create = async (payload) => {
    createdPayload = payload;
    return payload;
  };

  t.after(() => {
    db.user.findOne = originalFindOne;
    db.user.create = originalCreate;
  });

  const req = {
    body: {
      username: "seller_user",
      password: "Passw0rd!",
      role: "seller",
      qualificationType: "brand_authorized",
      brandAuthorizationHash: "QmBrandAuth",
      repairQualificationHash: "QmRepair",
      usedDeviceQualificationHash: "QmUsedDevice",
      qualificationNotes: "Authorized for premium device sales and repair.",
    },
  };
  const res = createMockRes();

  await authController.register(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "卖家注册已提交，等待监督方审核。");
  assert.equal(createdPayload.role, "seller");
  assert.equal(createdPayload.status, 0);
  assert.equal(createdPayload.qualificationType, "brand_authorized");
  assert.equal(createdPayload.brandAuthorizationHash, "QmBrandAuth");
  assert.equal(createdPayload.repairQualificationHash, "QmRepair");
  assert.equal(createdPayload.usedDeviceQualificationHash, "QmUsedDevice");
  assert.equal(createdPayload.qualificationNotes, "Authorized for premium device sales and repair.");
  assert.ok(createdPayload.ethAddress);
});

test("getUsers returns paginated users within regulator scope", async (t) => {
  const originalFindAll = db.user.findAll;
  const originalCount = db.user.count;
  let capturedQuery = null;

  db.user.findAll = async (query) => {
    capturedQuery = query;
    return [
      {
        id: 11,
        username: "seller_a",
        role: "seller",
        status: 1,
        ethAddress: "0xabc",
        qualificationType: "retailer",
        isBlacklisted: false,
        frozenReason: null,
        frozenAt: null,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-15T00:00:00.000Z"),
      },
    ];
  };
  db.user.count = async () => 1;

  t.after(() => {
    db.user.findAll = originalFindAll;
    db.user.count = originalCount;
  });

  const req = {
    query: {
      q: "seller",
      role: "seller",
      status: "1",
      page: "2",
      pageSize: "5",
    },
    user: {
      id: 99,
      role: "regulator",
    },
  };
  const res = createMockRes();

  await authController.getUsers(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.items.length, 1);
  assert.equal(res.body.items[0].username, "seller_a");
  assert.equal(res.body.items[0].canManage, true);
  assert.deepEqual(res.body.pagination, {
    page: 2,
    pageSize: 5,
    total: 1,
    totalPages: 1,
  });
  assert.equal(capturedQuery.limit, 5);
  assert.equal(capturedQuery.offset, 5);
  assert.equal(capturedQuery.where.role, "seller");
  assert.equal(capturedQuery.where.status, 1);
});

test("updateUserStatus freezes a managed user with audit trail", async (t) => {
  const originalFindByPk = db.user.findByPk;
  const originalAuditRecord = auditService.record;
  let savedPayload = null;
  let capturedAudit = null;

  db.user.findByPk = async () => ({
    id: 15,
    username: "buyer_demo",
    role: "buyer",
    status: 1,
    ethAddress: "0x123",
    save: async function save() {
      savedPayload = {
        status: this.status,
        frozenReason: this.frozenReason,
        frozenAt: this.frozenAt,
      };
      return this;
    },
  });
  auditService.record = async (payload) => {
    capturedAudit = payload;
  };

  t.after(() => {
    db.user.findByPk = originalFindByPk;
    auditService.record = originalAuditRecord;
  });

  const req = {
    params: { userId: "15" },
    body: {
      status: 2,
      reason: "Repeated abusive complaints",
    },
    user: {
      id: 1,
      role: "regulator",
      username: "regulator_demo",
    },
  };
  const res = createMockRes();

  await authController.updateUserStatus(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "用户已冻结");
  assert.equal(savedPayload.status, 2);
  assert.equal(savedPayload.frozenReason, "Repeated abusive complaints");
  assert.ok(savedPayload.frozenAt instanceof Date);
  assert.equal(capturedAudit.action, "USER_FROZEN");
  assert.equal(capturedAudit.targetId, 15);
});

test("updateUserStatus blocks supervisors from managing peer privileged users", async (t) => {
  const originalFindByPk = db.user.findByPk;
  const originalAccessDenied = auditService.recordAccessDenied;
  let accessDeniedCalled = false;

  db.user.findByPk = async () => ({
    id: 2,
    username: "supervisor_root",
    role: "regulator",
    status: 1,
    save: async function save() {
      return this;
    },
  });
  auditService.recordAccessDenied = async () => {
    accessDeniedCalled = true;
  };

  t.after(() => {
    db.user.findByPk = originalFindByPk;
    auditService.recordAccessDenied = originalAccessDenied;
  });

  const req = {
    params: { userId: "2" },
    body: {
      status: 2,
      reason: "not allowed",
    },
    user: {
      id: 9,
      role: "regulator",
      username: "regulator_demo",
    },
  };
  const res = createMockRes();

  await authController.updateUserStatus(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "无权治理该用户");
  assert.equal(accessDeniedCalled, true);
});
