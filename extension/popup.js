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
const STATIC_API_ORIGINS = new Set(["https://trumpornot.tlam.art"]);
let storedApiKey = "";

init();

async function init() {
  const settings = await getSettings(browser.storage);
  if (settings.apiBase) apiBaseInput.value = settings.apiBase;
  storedApiKey = settings.apiKey || "";
  if (storedApiKey) {
    apiKeyInput.placeholder = "Stored key loaded";
  }

  saveSettingsBtn.addEventListener("click", saveSettings);
}

async function saveSettings() {
  const apiBase = normalizeApiBase(apiBaseInput.value);
  const apiKey = apiKeyInput.value.trim() || storedApiKey;

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

  const apiOrigin = new URL(apiBase).origin;
  try {
    if (!STATIC_API_ORIGINS.has(apiOrigin)
      && browser.permissions
      && browser.permissions.contains
      && browser.permissions.request) {
      const hasPermission = await browser.permissions.contains({
        origins: [permissionPattern],
      });

      const granted = hasPermission || await browser.permissions.request({
        origins: [permissionPattern],
      });

      if (!granted) {
        setStatus(`Access to ${apiOrigin} was not granted`, true);
        return;
      }
    }
  } catch (error) {
    console.error("[TrumpOrNot] Permission request failed", error);
    setStatus("Could not request backend permission", true);
    return;
  }

  await browser.storage.local.set({ apiBase, apiKey });
  storedApiKey = apiKey;
  apiKeyInput.value = "";
  apiBaseInput.value = apiBase;
  apiKeyInput.placeholder = "Stored key loaded";
  setStatus("Settings saved");
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#8c2d2d" : "#0a7b5a";
}
