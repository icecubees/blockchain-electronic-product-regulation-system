import axios from "axios";
import AuthService from "./auth.service";
import API_BASE_URL from "./api.config";

const API_URL = `${API_BASE_URL}/api/audit-logs/`;

const authHeader = () => {
  const user = AuthService.getCurrentUser();
  if (user && user.accessToken) {
    return { "x-access-token": user.accessToken };
  }
  return {};
};

const getAuditLogs = (paramsOrLimit = { limit: 50 }) => {
  const params =
    typeof paramsOrLimit === "number" ? { limit: paramsOrLimit } : { ...paramsOrLimit };

  return axios.get(API_URL, {
    headers: authHeader(),
    params,
  });
};

const getAuditStats = (daysOrParams = 7) => {
  const params =
    typeof daysOrParams === "number" ? { days: daysOrParams } : { ...daysOrParams };

  return axios.get(`${API_URL}stats`, {
    headers: authHeader(),
    params,
  });
};

const AuditLogService = {
  getAuditLogs,
  getAuditStats,
};

export default AuditLogService;
