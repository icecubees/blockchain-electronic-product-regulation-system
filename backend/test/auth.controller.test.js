const test = require("node:test");
const assert = require("node:assert/strict");

const db = require("../models");
const authController = require("../controllers/auth.controller");
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
      role: "admin",
    },
  };
  const res = createMockRes();

  await authController.register(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, "Only buyer and seller accounts can be self-registered");
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
  assert.equal(res.body.message, "Seller registration submitted, waiting for approval.");
  assert.equal(createdPayload.role, "seller");
  assert.equal(createdPayload.status, 0);
  assert.equal(createdPayload.qualificationType, "brand_authorized");
  assert.equal(createdPayload.brandAuthorizationHash, "QmBrandAuth");
  assert.equal(createdPayload.repairQualificationHash, "QmRepair");
  assert.equal(createdPayload.usedDeviceQualificationHash, "QmUsedDevice");
  assert.equal(createdPayload.qualificationNotes, "Authorized for premium device sales and repair.");
  assert.ok(createdPayload.ethAddress);
});
