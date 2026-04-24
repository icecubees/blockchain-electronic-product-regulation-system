const axios = require("axios");
const FormData = require("form-data");

const PINATA_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";
const PINATA_AUTH_TEST_URL = "https://api.pinata.cloud/data/testAuthentication";

function getPinataHeaders() {
  const apiKey = process.env.PINATA_API_KEY;
  const secretApiKey = process.env.PINATA_SECRET_API_KEY;

  if (!apiKey || !secretApiKey) {
    throw new Error("Missing Pinata credentials");
  }

  return {
    pinata_api_key: apiKey,
    pinata_secret_api_key: secretApiKey,
  };
}

async function uploadBufferToIpfs({
  buffer,
  filename,
  contentType,
  metadataName,
}) {
  const form = new FormData();
  form.append("file", buffer, {
    filename: filename || "upload.bin",
    contentType: contentType || "application/octet-stream",
  });
  form.append(
    "pinataMetadata",
    JSON.stringify({ name: metadataName || filename || "PlatformUpload" })
  );
  form.append("pinataOptions", JSON.stringify({ cidVersion: 0 }));

  const response = await axios.post(PINATA_URL, form, {
    headers: {
      ...form.getHeaders(),
      ...getPinataHeaders(),
    },
    maxBodyLength: Infinity,
  });

  return response.data.IpfsHash;
}

async function getPinataHealth() {
  if (!process.env.PINATA_API_KEY || !process.env.PINATA_SECRET_API_KEY) {
    return {
      status: "not_configured",
      message: "未配置 Pinata 凭据，文件上传将进入人工补偿流程",
    };
  }

  try {
    await axios.get(PINATA_AUTH_TEST_URL, {
      headers: getPinataHeaders(),
      timeout: 3000,
    });

    return {
      status: "online",
      message: "Pinata/IPFS 上传凭据可用",
    };
  } catch (error) {
    return {
      status: "offline",
      message: error.message,
    };
  }
}

module.exports = {
  uploadBufferToIpfs,
  getPinataHealth,
};
