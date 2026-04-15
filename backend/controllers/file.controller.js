const auditService = require("../services/audit.service");
const integrationJobService = require("../services/integration-job.service");
const { uploadBufferToIpfs } = require("../services/pinata.service");

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function ensureFile(req, res) {
  if (!req.file) {
    res.status(400).send({ message: "No file uploaded" });
    return false;
  }

  if (req.file.size > MAX_FILE_SIZE) {
    res.status(400).send({ message: "File is too large" });
    return false;
  }

  return true;
}

function ensureMime(req, res, allowedMimeTypes) {
  if (!allowedMimeTypes.includes(req.file.mimetype)) {
    res.status(400).send({ message: "Unsupported file type" });
    return false;
  }

  return true;
}

async function handleUpload(req, res, options) {
  try {
    if (!ensureFile(req, res)) return;
    if (!ensureMime(req, res, options.allowedMimeTypes)) return;

    const ipfsHash = await uploadBufferToIpfs({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      contentType: req.file.mimetype,
      metadataName: options.metadataName,
    });

    await auditService.record({
      operator: req.user,
      action: "FILE_UPLOADED",
      targetType: options.targetType,
      targetId: req.body.targetId || null,
      result: "SUCCESS",
      details: {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      req,
      ipfsHash,
    });

    res.send({ ipfsHash });
  } catch (error) {
    await integrationJobService.createJob({
      jobType: integrationJobService.JOB_TYPE.FILE_UPLOAD_FAILURE,
      targetType: options.targetType,
      targetId: req.body.targetId || null,
      status: integrationJobService.JOB_STATUS.MANUAL_REVIEW,
      payload: {
        targetId: req.body.targetId || null,
        filename: req.file?.originalname || null,
        mimeType: req.file?.mimetype || null,
        size: req.file?.size || null,
        metadataName: options.metadataName,
        reason: "File payload is not persisted server-side, manual re-upload is required.",
      },
      error,
      operator: req.user,
      req,
    });
    res.status(500).send({ message: error.message });
  }
}

exports.uploadProductReport = (req, res) =>
  handleUpload(req, res, {
    allowedMimeTypes: ["application/pdf"],
    metadataName: "ProductReport",
    targetType: "PRODUCT_REPORT",
  });

exports.uploadProductCertificate = (req, res) =>
  handleUpload(req, res, {
    allowedMimeTypes: ["application/pdf"],
    metadataName: "ProductCertificate",
    targetType: "PRODUCT_CERTIFICATE",
  });

exports.uploadComplaintEvidence = (req, res) =>
  handleUpload(req, res, {
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    metadataName: "ComplaintEvidence",
    targetType: "COMPLAINT_EVIDENCE",
  });

exports.uploadSellerComplaintEvidence = (req, res) =>
  handleUpload(req, res, {
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    metadataName: "SellerComplaintEvidence",
    targetType: "SELLER_COMPLAINT_EVIDENCE",
  });

exports.uploadAfterSalesEvidence = (req, res) =>
  handleUpload(req, res, {
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    metadataName: "AfterSalesEvidence",
    targetType: "AFTER_SALES_EVIDENCE",
  });

exports.uploadPublicSellerQualification = (req, res) =>
  handleUpload(req, res, {
    allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg"],
    metadataName: `SellerQualification-${String(req.body.qualificationKind || "generic")}`,
    targetType: "SELLER_QUALIFICATION_FILE",
  });
