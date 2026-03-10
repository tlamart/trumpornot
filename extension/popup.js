const {
  getApiOriginPermissionPattern,
  getSettings,
  isSupportedApiUrl,
  normalizeApiBase,
} = globalThis.TrumpOrNotExtension;

const apiBaseInput = document.getElementById("apiBase");
const apiKeyInput = document.getElementById("apiKey");
const saveSettingsBtn = document.getElementById("saveSettings");
const statusEl = document.getElementById("status");

init();

async function init() {
  const settings = await getSettings(browser.storage);
  if (settings.apiBase) apiBaseInput.value = settings.apiBase;
  if (settings.apiKey) apiKeyInput.value = settings.apiKey;

  saveSettingsBtn.addEventListener("click", saveSettings);
}

async function saveSettings() {
  const apiBase = normalizeApiBase(apiBaseInput.value);
  const apiKey = apiKeyInput.value.trim();

  if (!apiBase || !apiKey) {
    setStatus("API base and API key are required", true);
    return;
  }

  if (!isSupportedApiUrl(apiBase)) {
    setStatus("Use HTTPS or localhost over HTTP", true);
    return;
  }

  const permissionPattern = getApiOriginPermissionPattern(apiBase);
  if (!permissionPattern) {
    setStatus("Backend permission pattern is invalid", true);
    return;
  }

  const hasPermission = await browser.permissions.contains({
    origins: [permissionPattern],
  });

  const granted = hasPermission || await browser.permissions.request({
    origins: [permissionPattern],
  });

  if (!granted) {
    setStatus(`Access to ${new URL(apiBase).origin} was not granted`, true);
    return;
  }

  await browser.storage.local.set({ apiBase, apiKey });
  apiKeyInput.value = "";
  apiBaseInput.value = apiBase;
  setStatus("Settings saved");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#8c2d2d" : "#0a7b5a";
}
