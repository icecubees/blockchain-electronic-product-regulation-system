const express = require("express");
const multer = require("multer");

const controller = require("../controllers/file.controller");
const { verifyToken, requireRoles } = require("../middleware/authJwt");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post(
  "/product-report",
  [verifyToken, requireRoles("seller"), upload.single("file")],
  controller.uploadProductReport
);

router.post(
  "/product-certificate",
  [verifyToken, requireRoles("seller"), upload.single("file")],
  controller.uploadProductCertificate
);

router.post(
  "/complaint-evidence",
  [verifyToken, requireRoles("buyer"), upload.single("file")],
  controller.uploadComplaintEvidence
);

module.exports = (app) => {
  app.use("/api/files", router);
};
