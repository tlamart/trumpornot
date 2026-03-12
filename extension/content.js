const BUTTON_CLASS = "trumpornot-save-btn";
const BUTTON_ROW_CLASS = "trumpornot-save-row";
const STYLE_ID = "trumpornot-inline-style";
const TOAST_ID = "trumpornot-inline-toast";
const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const ENHANCED_ATTR = "trumpornotEnhanced";
const {
  extractPost,
  getFetchErrorMessage,
  getSettings,
  getSiteKind,
  savePost,
} = globalThis.TrumpOrNotExtension;

const siteKind = getSiteKind(window.location.hostname);

injectStyles();

if (siteKind === "x") {
  initXPage();
} else if (siteKind === "truthsocial") {
  initTruthSocialPage();
}

function initXPage() {
  scanPosts(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        if (node.matches && node.matches(ARTICLE_SELECTOR)) {
          enhanceArticle(node);
        }

        scanPosts(node);
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function initTruthSocialPage() {
  scanTruthSocialPosts(document);

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) {
          return;
        }

        scanTruthSocialPosts(node);
      });
    });
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  let lastHref = window.location.href;
  window.setInterval(() => {
    if (window.location.href === lastHref) {
      return;
    }

    lastHref = window.location.href;
    scanTruthSocialPosts(document);
  }, 500);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${BUTTON_ROW_CLASS} {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .${BUTTON_CLASS} {
      border: 0;
      border-radius: 999px;
      padding: 6px 12px;
      color: #fff;
      font: 600 13px/1.2 sans-serif;
      cursor: pointer;
    }

    .${BUTTON_CLASS}[data-variant="real"] {
      background: #0a7b5a;
    }

    .${BUTTON_CLASS}[data-variant="real"]:hover {
      background: #08664b;
    }

    .${BUTTON_CLASS}[data-variant="fake"] {
      background: #8c2d2d;
    }

    .${BUTTON_CLASS}[data-variant="fake"]:hover {
      background: #6f2323;
    }

    .${BUTTON_CLASS}[disabled] {
      opacity: 0.7;
      cursor: default;
    }

    #${TOAST_ID} {
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 2147483647;
      max-width: min(360px, calc(100vw - 32px));
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(15, 20, 25, 0.95);
      color: #fff;
      font: 600 13px/1.35 sans-serif;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.28);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 140ms ease, transform 140ms ease;
      pointer-events: none;
    }

    #${TOAST_ID}.visible {
      opacity: 1;
      transform: translateY(0);
    }

    #${TOAST_ID}.error {
      background: rgba(140, 45, 45, 0.96);
    }
  `;

  document.head.appendChild(style);
}

function scanPosts(rootNode) {
  const articles = rootNode.querySelectorAll
    ? rootNode.querySelectorAll(ARTICLE_SELECTOR)
    : [];
  articles.forEach((article) => {
    enhanceArticle(article);
  });
}

async function saveArticle(button, article, isReal) {
  showToast("Saving post...");

  let post;
  try {
    post = await extractPost(article);
  } catch (error) {
    console.error("[TrumpOrNot] Extraction failed", error);
    showToast(error && error.message ? error.message : "Unable to read post", true);
    restoreButton(button, getButtonLabel(isReal), "Try again", true);
    return;
  }

  if (!post) {
    flashButton(button, "No text or media", true);
    showToast("No text or media found on this post", true);
    return;
  }

  await saveArticlePayload(button, post, isReal);
}

async function saveTruthSocialPage(button, article, isReal) {
  showToast("Saving post...");

  let post;
  try {
    post = await extractPost(article, {
      fetchImpl: fetch,
      locationObj: window.location,
      postUrl: article && article.dataset ? article.dataset.trumpornotPostUrl : null,
    });
  } catch (error) {
    console.error("[TrumpOrNot] Truth Social extraction failed", error);
    showToast(error && error.message ? error.message : "Unable to load post", true);
    restoreButton(button, getButtonLabel(isReal), "Try again", true);
    return;
  }

  if (!post) {
    flashButton(button, "Unsupported post", true);
    showToast("Unable to locate that Truth Social post", true);
    return;
  }

  await saveArticlePayload(button, post, isReal);
}

async function saveArticlePayload(button, post, isReal) {
  const { apiBase, apiKey } = await getSettings(browser.storage);

  if (!apiBase || !apiKey) {
    flashButton(button, "Setup required", true);
    showToast("Set API URL and key in the extension first", true);
    return;
  }

  const payload = buildSavePayload(post, siteKind, isReal);

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Saving...";
  console.info("[TrumpOrNot] Saving post", { source: siteKind, postId: post.id, apiBase });

  let result;
  try {
    result = await savePost(fetch, apiBase, apiKey, payload);
  } catch (error) {
    console.error("[TrumpOrNot] Request failed", error);
    showToast(getFetchErrorMessage(error, apiBase), true);
    restoreButton(button, originalText, getFetchErrorMessage(error, apiBase), true);
    return;
  }

  if (!result.ok) {
    const body = await result.json().catch(() => ({}));
    console.error("[TrumpOrNot] Save rejected", { status: result.status, body });
    showToast(body.error || `Save failed (${result.status})`, true);
    restoreButton(button, originalText, body.error || `Error ${result.status}`, true);
    return;
  }

  button.textContent = "Saved";
  button.disabled = true;
  showToast(`Post saved as ${isReal ? "real" : "fake"}`);
}

function buildSavePayload(post, source, isReal) {
  return {
    source,
    post_id: post.id,
    text: post.text,
    url: post.url,
    author: post.author,
    media: post.media,
    created_at: post.createdAt,
    is_real: isReal,
    status: "approved",
  };
}

function restoreButton(button, originalText, nextText, isError) {
  button.textContent = nextText;
  button.disabled = true;

  window.setTimeout(() => {
    button.textContent = originalText;
    button.disabled = false;
    if (isError) {
      button.blur();
    }
  }, 1800);
}

function flashButton(button, text, isError) {
  const isReal = button.dataset.variant !== "fake";
  restoreButton(button, getButtonLabel(isReal), text, isError);
}

function enhanceArticle(article) {
  if (article.dataset[ENHANCED_ATTR] === "true") {
    return;
  }

  const actionBar = findActionBar(article);
  if (!actionBar) {
    return;
  }

  actionBar.appendChild(createSaveButtonRow((button, isReal) => saveArticle(button, article, isReal)));
  article.dataset[ENHANCED_ATTR] = "true";
}

function scanTruthSocialPosts(rootNode) {
  const containers = collectTruthSocialPostContainers(rootNode);
  containers.forEach((container) => {
    enhanceTruthSocialPost(container);
  });
}

function enhanceTruthSocialPost(container) {
  if (!container || container.dataset[ENHANCED_ATTR] === "true") {
    return;
  }

  const postUrl = getTruthSocialPostUrl(container);
  if (!postUrl) {
    return;
  }

  const mount = findTruthSocialActionBar(container);
  if (!mount) {
    return;
  }

  container.dataset.trumpornotPostUrl = postUrl;
  mount.appendChild(createSaveButtonRow((button, isReal) => saveTruthSocialPage(button, container, isReal)));
  container.dataset[ENHANCED_ATTR] = "true";
}

function createSaveButtonRow(onSave) {
  const row = document.createElement("div");
  row.className = BUTTON_ROW_CLASS;

  row.appendChild(createSaveButton("real", true, onSave));
  row.appendChild(createSaveButton("fake", false, onSave));

  return row;
}

function createSaveButton(variant, isReal, onSave) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.dataset.variant = variant;
  button.textContent = getButtonLabel(isReal);
  bindSaveButton(button, () => onSave(button, isReal));
  return button;
}

function getButtonLabel(isReal) {
  return isReal ? "Save as Real" : "Save as Fake";
}

function bindSaveButton(button, onSave) {
  const stopEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
  };

  ["pointerdown", "mousedown"].forEach((eventName) => {
    button.addEventListener(eventName, stopEvent, true);
  });

  button.addEventListener("click", (event) => {
    stopEvent(event);
    onSave();
  }, true);
}

function findActionBar(article) {
  const candidates = article.querySelectorAll('div[role="group"]');
  return candidates[candidates.length - 1] || null;
}

function collectTruthSocialPostContainers(rootNode) {
  const scope = rootNode && rootNode.querySelectorAll ? rootNode : document;
  const anchors = [];
  if (scope instanceof Element && scope.matches('a[href*="/posts/"]')) {
    anchors.push(scope);
  }
  anchors.push(...scope.querySelectorAll('a[href*="/posts/"]'));
  const containers = [];
  const seen = new Set();

  anchors.forEach((anchor) => {
    const href = anchor.getAttribute("href");
    if (!href || !isTruthSocialPostHref(href)) {
      return;
    }

    const container = (
      anchor.closest("article")
      || anchor.closest('[data-id]')
      || anchor.closest('[data-testid="status"]')
      || anchor.closest('[class*="status"]')
      || anchor.closest("div")
    );

    if (!container || seen.has(container)) {
      return;
    }

    seen.add(container);
    containers.push(container);
  });

  return containers;
}

function isTruthSocialPostHref(href) {
  try {
    const url = new URL(href, window.location.href);
    return /^\/@[A-Za-z0-9_]{1,30}\/posts\/\d+(?:\/)?$/.test(url.pathname);
  } catch (_error) {
    return false;
  }
}

function getTruthSocialPostUrl(container) {
  if (!container || !container.querySelectorAll) {
    return null;
  }

  const anchors = Array.from(container.querySelectorAll('a[href*="/posts/"]'));
  const match = anchors.find((anchor) => {
    const href = anchor.getAttribute("href");
    return href && isTruthSocialPostHref(href);
  });

  if (!match) {
    return null;
  }

  return new URL(match.getAttribute("href"), window.location.href).toString();
}

function findTruthSocialActionBar(container) {
  const candidates = [
    '[role="group"]',
    '[data-testid*="action"]',
    '[class*="status__action"]',
    '[class*="actions"]',
    'footer',
  ];

  for (const selector of candidates) {
    const match = container.querySelector(selector);
    if (match) {
      return match;
    }
  }

  return null;
}

let toastTimeoutId = null;

function showToast(message, isError = false) {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");

  if (toastTimeoutId) {
    window.clearTimeout(toastTimeoutId);
  }

  toastTimeoutId = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, isError ? 3200 : 1800);
}
