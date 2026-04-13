const axios = require("axios");
const FormData = require("form-data");

const PINATA_URL = "https://api.pinata.cloud/pinning/pinFileToIPFS";

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

module.exports = {
  uploadBufferToIpfs,
};
