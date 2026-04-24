import axios from "axios";
import AuthService from "./auth.service";
import API_BASE_URL from "./api.config";

const API_URL = `${API_BASE_URL}/api/products/`;

const authHeader = () => {
  const user = AuthService.getCurrentUser();
  if (user && user.accessToken) {
    return { "x-access-token": user.accessToken };
  }
  return {};
};

const getAllProducts = (params = {}) => axios.get(API_URL, { params });
const getProductTrace = (productId) => axios.get(`${API_URL}${productId}/trace`);
const getPendingProducts = (params = {}) =>
  axios.get(API_URL + "pending", { headers: authHeader(), params });
const getMyProducts = () => axios.get(API_URL + "my-products", { headers: authHeader() });

const addProduct = (payload, rawFile) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    formData.append(key, value);
  });

  if (rawFile) {
    formData.append("reportFile", rawFile);
  }

  return axios.post(API_URL + "add", formData, {
    headers: {
      ...authHeader(),
      "Content-Type": "multipart/form-data",
    },
  });
};

const auditProduct = (productId, decision, reason, reasonCodes = []) =>
  axios.post(
    API_URL + "audit",
    { productId, decision, reason, reasonCodes },
    { headers: authHeader() }
  );

const delistProduct = (productId, reason) =>
  axios.post(API_URL + "delist", { productId, reason }, { headers: authHeader() });
const recallProduct = (productId, reason, batchNo) =>
  axios.post(API_URL + "recall", { productId, reason, batchNo }, { headers: authHeader() });
const restockProduct = (productId, amount) =>
  axios.post(API_URL + "restock", { productId, amount }, { headers: authHeader() });
const resubmitProduct = (payload) =>
  axios.post(API_URL + "resubmit", payload, { headers: authHeader() });

const purchaseProduct = (productId) =>
  axios.post(API_URL + "purchase", { productId }, { headers: authHeader() });
const prepareWalletPurchase = (productId) =>
  axios.get(`${API_URL}${productId}/purchase-transaction`, { headers: authHeader() });
const finalizeWalletPurchase = (productId, txHash) =>
  axios.post(
    API_URL + "wallet-purchase/finalize",
    { productId, txHash },
    { headers: authHeader() }
  );

const getMyOrders = () => axios.get(API_URL + "orders", { headers: authHeader() });
const getRecallNotifications = (params = {}) =>
  axios.get(API_URL + "recall-notifications", { headers: authHeader(), params });
const updateRecallNotificationStatus = (notificationId, status) =>
  axios.post(
    `${API_URL}recall-notifications/${notificationId}/status`,
    { status },
    { headers: authHeader() }
  );
const getRecallNotificationSummary = (params = {}) =>
  axios.get(API_URL + "recall-notifications/summary", { headers: authHeader(), params });
const getProductAfterSales = (productId) => axios.get(`${API_URL}${productId}/after-sales`);
const createAfterSalesRequest = (payload) =>
  axios.post(API_URL + "after-sales-request", payload, { headers: authHeader() });
const respondToAfterSalesRequest = (requestId, response, evidenceIpfsHash) =>
  axios.post(
    API_URL + "respond-after-sales-request",
    { requestId, response, evidenceIpfsHash },
    { headers: authHeader() }
  );
const recordAfterSales = (payload) =>
  axios.post(API_URL + "after-sales", payload, { headers: authHeader() });
const shipOrder = (orderId, trackingNumber, shippingCarrier) =>
  axios.post(
    API_URL + "ship",
    { orderId, trackingNumber, shippingCarrier },
    { headers: authHeader() }
  );
const confirmReceipt = (orderId) =>
  axios.post(API_URL + "confirm", { orderId }, { headers: authHeader() });
const prepareWalletConfirmReceipt = (orderId) =>
  axios.get(`${API_URL}orders/${orderId}/confirm-transaction`, { headers: authHeader() });
const finalizeWalletConfirmReceipt = (orderId, txHash) =>
  axios.post(
    API_URL + "wallet-confirm/finalize",
    { orderId, txHash },
    { headers: authHeader() }
  );

const rateOrder = (orderId, rating, comment) =>
  axios.post(API_URL + "rate", { orderId, rating, comment }, { headers: authHeader() });

const raiseComplaint = (orderId, reason, evidenceIpfsHash, complaintType) =>
  axios.post(
    API_URL + "complain",
    { orderId, reason, evidenceIpfsHash, complaintType },
    { headers: authHeader() }
  );
const respondToComplaint = (orderId, response, evidenceIpfsHash) =>
  axios.post(
    API_URL + "respond-complaint",
    { orderId, response, evidenceIpfsHash },
    { headers: authHeader() }
  );

const resolveComplaint = (orderId, rulingForBuyer, rulingDetails) =>
  axios.post(
    API_URL + "resolve",
    { orderId, rulingForBuyer, rulingDetails },
    { headers: authHeader() }
  );

const getAllComplaints = (params = {}) =>
  axios.get(API_URL + "complaints", { headers: authHeader(), params });

const ProductService = {
  getAllProducts,
  getProductTrace,
  getPendingProducts,
  getMyProducts,
  addProduct,
  auditProduct,
  delistProduct,
  recallProduct,
  restockProduct,
  resubmitProduct,
  purchaseProduct,
  prepareWalletPurchase,
  finalizeWalletPurchase,
  getMyOrders,
  getRecallNotifications,
  updateRecallNotificationStatus,
  getRecallNotificationSummary,
  getProductAfterSales,
  createAfterSalesRequest,
  respondToAfterSalesRequest,
  recordAfterSales,
  shipOrder,
  confirmReceipt,
  prepareWalletConfirmReceipt,
  finalizeWalletConfirmReceipt,
  getAllComplaints,
  rateOrder,
  raiseComplaint,
  respondToComplaint,
  resolveComplaint,
};

export default ProductService;
