const BUTTON_CLASS = "trumpornot-save-real-btn";
const STYLE_ID = "trumpornot-inline-style";
const TOAST_ID = "trumpornot-inline-toast";
const ARTICLE_SELECTOR = 'article[data-testid="tweet"]';
const ENHANCED_ATTR = "trumpornotEnhanced";
const {
  extractPost,
  getFetchErrorMessage,
  getSettings,
  savePost,
} = globalThis.TrumpOrNotExtension;

injectStyles();
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

function injectStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${BUTTON_CLASS} {
      border: 0;
      border-radius: 999px;
      padding: 6px 12px;
      background: #0a7b5a;
      color: #fff;
      font: 600 13px/1.2 sans-serif;
      cursor: pointer;
      margin-left: 8px;
    }

    .${BUTTON_CLASS}:hover {
      background: #08664b;
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

async function saveArticle(button, article) {
  showToast("Saving post...");
  const post = extractPost(article);
  if (!post) {
    flashButton(button, "No text or media", true);
    showToast("No text or media found on this post", true);
    return;
  }

  const { apiBase, apiKey } = await getSettings(browser.storage);

  if (!apiBase || !apiKey) {
    flashButton(button, "Setup required", true);
    showToast("Set API URL and key in the extension first", true);
    return;
  }

  const payload = {
    source: "x",
    post_id: post.id,
    text: post.text,
    url: post.url,
    author: post.author,
    media: post.media,
    created_at: post.createdAt,
    is_real: true,
    status: "approved",
  };

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Saving...";
  console.info("[TrumpOrNot] Saving post", { postId: post.id, apiBase });

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
  showToast("Post saved");
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
  restoreButton(button, "Save as Real", text, isError);
}

function enhanceArticle(article) {
  if (article.dataset[ENHANCED_ATTR] === "true") {
    return;
  }

  const actionBar = findActionBar(article);
  if (!actionBar) {
    return;
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = BUTTON_CLASS;
  button.textContent = "Save as Real";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    saveArticle(button, article);
  });

  actionBar.appendChild(button);
  article.dataset[ENHANCED_ATTR] = "true";
}

function findActionBar(article) {
  const candidates = article.querySelectorAll('div[role="group"]');
  return candidates[candidates.length - 1] || null;
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
