import axios from "axios";
import API_BASE_URL from "./api.config";

const API_URL = `${API_BASE_URL}/api/auth/`;

const authHeader = () => {
  const user = JSON.parse(localStorage.getItem("user"));
  if (user && user.accessToken) {
    return { "x-access-token": user.accessToken };
  }
  return {};
};

const register = (username, password, role, metadata = {}) => {
  return axios.post(API_URL + "register", {
    username,
    password,
    role,
    ...metadata,
  });
};

const login = (username, password) => {
  return axios
    .post(API_URL + "login", {
      username,
      password,
    })
    .then((response) => {
      if (response.data.accessToken) {
        localStorage.setItem("user", JSON.stringify(response.data));
      }
      return response.data;
    });
};

const logout = () => {
  localStorage.removeItem("user");
};

const getCurrentUser = () => {
  return JSON.parse(localStorage.getItem("user"));
};

const getPendingSellers = () => {
  return axios.get(API_URL + "pending-sellers", { headers: authHeader() });
};

const getBlacklistedSellers = () => {
  return axios.get(API_URL + "blacklisted-sellers", { headers: authHeader() });
};

const approveSeller = (sellerId, action, reason) => {
  return axios.post(API_URL + "approve", { sellerId, action, reason }, { headers: authHeader() });
};

const unblacklistSeller = (sellerId, reason, restoredScore) => {
  return axios.post(
    API_URL + "unblacklist",
    { sellerId, reason, restoredScore },
    { headers: authHeader() }
  );
};

const AuthService = {
  register,
  login,
  logout,
  getCurrentUser,
  getPendingSellers,
  getBlacklistedSellers,
  approveSeller,
  unblacklistSeller,
};

export default AuthService;
