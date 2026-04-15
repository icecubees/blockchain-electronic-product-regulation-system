const test = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const db = require("../models");
const auditService = require("../services/audit.service");
const fileController = require("../controllers/file.controller");
const { createMockRes } = require("./test-helpers");

test("uploadProductReport creates a manual integration job when IPFS upload fails", async (t) => {
  const originalAxiosPost = axios.post;
  const originalIntegrationJobCreate = db.integrationJob.create;
  const originalRecord = auditService.record;
  const originalPinataApiKey = process.env.PINATA_API_KEY;
  const originalPinataSecretApiKey = process.env.PINATA_SECRET_API_KEY;

  let createdJob = null;

  process.env.PINATA_API_KEY = "test-key";
  process.env.PINATA_SECRET_API_KEY = "test-secret";
  axios.post = async () => {
    throw new Error("pinata unavailable");
  };
  db.integrationJob.create = async (payload) => {
    createdJob = { id: 901, ...payload };
    return createdJob;
  };
  auditService.record = async () => {};

  t.after(() => {
    axios.post = originalAxiosPost;
    db.integrationJob.create = originalIntegrationJobCreate;
    auditService.record = originalRecord;
    process.env.PINATA_API_KEY = originalPinataApiKey;
    process.env.PINATA_SECRET_API_KEY = originalPinataSecretApiKey;
  });

  const req = {
    body: {
      targetId: "12",
    },
    file: {
      buffer: Buffer.from("pdf"),
      originalname: "report.pdf",
      mimetype: "application/pdf",
      size: 3,
    },
    user: {
      id: 7,
      role: "seller",
      username: "seller_demo",
    },
  };
  const res = createMockRes();

  await fileController.uploadProductReport(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "pinata unavailable");
  assert.equal(createdJob.jobType, "file_upload_failure");
  assert.equal(createdJob.targetType, "PRODUCT_REPORT");
  assert.equal(createdJob.status, "manual_review");
  assert.match(createdJob.payload, /"filename":"report\.pdf"/);
});
