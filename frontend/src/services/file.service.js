import axios from "axios";
import AuthService from "./auth.service";
import API_BASE_URL from "./api.config";

const API_URL = `${API_BASE_URL}/api/files/`;

const authHeader = () => {
  const user = AuthService.getCurrentUser();
  if (user && user.accessToken) {
    return { "x-access-token": user.accessToken };
  }
  return {};
};

const upload = (endpoint, file) => {
  const formData = new FormData();
  formData.append("file", file);

  return axios.post(API_URL + endpoint, formData, {
    headers: {
      ...authHeader(),
      "Content-Type": "multipart/form-data",
    },
  });
};

const uploadProductReport = (file) => upload("product-report", file);
const uploadProductCertificate = (file) => upload("product-certificate", file);
const uploadComplaintEvidence = (file) => upload("complaint-evidence", file);
const uploadSellerComplaintEvidence = (file) => upload("seller-complaint-evidence", file);
const uploadAfterSalesEvidence = (file) => upload("after-sales-evidence", file);

const uploadPublicSellerQualification = (file, qualificationKind) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("qualificationKind", qualificationKind);

  return axios.post(API_URL + "public/seller-qualification", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
};

const FileService = {
  uploadProductReport,
  uploadProductCertificate,
  uploadComplaintEvidence,
  uploadSellerComplaintEvidence,
  uploadAfterSalesEvidence,
  uploadPublicSellerQualification,
};

export default FileService;
