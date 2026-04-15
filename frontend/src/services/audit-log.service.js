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

const getAuditLogs = (limit = 50) =>
  axios.get(`${API_URL}?limit=${limit}`, {
    headers: authHeader(),
  });

const getAuditStats = (days = 7) =>
  axios.get(`${API_URL}stats?days=${days}`, {
    headers: authHeader(),
  });

const AuditLogService = {
  getAuditLogs,
  getAuditStats,
};

export default AuditLogService;
