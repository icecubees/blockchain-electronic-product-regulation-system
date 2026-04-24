import axios from "axios";
import AuthService from "./auth.service";
import API_BASE_URL from "./api.config";

const API_URL = `${API_BASE_URL}/api/system-settings/`;

const authHeader = () => {
  const user = AuthService.getCurrentUser();
  if (user && user.accessToken) {
    return { "x-access-token": user.accessToken };
  }
  return {};
};

const getAiAuditSetting = () =>
  axios.get(`${API_URL}ai-audit`, {
    headers: authHeader(),
  });

const updateAiAuditSetting = (enabled) =>
  axios.patch(
    `${API_URL}ai-audit`,
    { enabled },
    {
      headers: authHeader(),
    }
  );

const getSystemHealth = () =>
  axios.get(`${API_URL}health`, {
    headers: authHeader(),
  });

const SystemSettingService = {
  getAiAuditSetting,
  updateAiAuditSetting,
  getSystemHealth,
};

export default SystemSettingService;
