const db = require("../models");

const AI_AUDIT_ENABLED_KEY = "ai_audit_enabled";

async function getSetting(key, defaultValue = null) {
  const setting = await db.systemSetting.findByPk(key);
  return setting ? setting.value : defaultValue;
}

async function setSetting(key, value, description = null) {
  const normalizedValue = typeof value === "string" ? value : JSON.stringify(value);
  const [setting] = await db.systemSetting.findOrCreate({
    where: { key },
    defaults: {
      key,
      value: normalizedValue,
      description,
    },
  });

  if (setting.value !== normalizedValue || setting.description !== description) {
    setting.value = normalizedValue;
    setting.description = description;
    await setting.save();
  }

  return setting;
}

async function isAiAuditEnabled() {
  try {
    const value = await getSetting(AI_AUDIT_ENABLED_KEY, "true");
    return String(value).toLowerCase() !== "false";
  } catch (error) {
    return true;
  }
}

async function setAiAuditEnabled(enabled) {
  const setting = await setSetting(
    AI_AUDIT_ENABLED_KEY,
    enabled ? "true" : "false",
    "Controls whether seller product submissions call the AI pre-audit service."
  );

  return String(setting.value).toLowerCase() !== "false";
}

module.exports = {
  AI_AUDIT_ENABLED_KEY,
  getSetting,
  setSetting,
  isAiAuditEnabled,
  setAiAuditEnabled,
};
