(function initTrumpOrNotExtensionShared(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.TrumpOrNotExtension = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  const X_HOSTS = new Set(["x.com", "www.x.com"]);
  const TRUTH_SOCIAL_HOSTS = new Set(["truthsocial.com", "www.truthsocial.com"]);

  function normalizeApiBase(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    return value.trim().replace(/\/+$/, "");
  }

  function safeUrl(value) {
    try {
      return new URL(value);
    } catch (_error) {
      return null;
    }
  }

  function isSupportedApiUrl(value) {
    const url = value instanceof URL ? value : safeUrl(value);
    if (!url) {
      return false;
    }

    if (url.protocol === "https:") {
      return true;
    }

    return url.protocol === "http:" && LOCALHOST_HOSTS.has(url.hostname);
  }

  function getApiOriginPermissionPattern(value) {
    const url = value instanceof URL ? value : safeUrl(value);
    if (!isSupportedApiUrl(url)) {
      return null;
    }

    return `${url.protocol}//${url.hostname}/*`;
  }

  function getFetchErrorMessage(error, apiBase) {
    const url = safeUrl(apiBase);
    if (!url) {
      return "Bad API URL";
    }

    if (!isSupportedApiUrl(url)) {
      return "Use HTTPS or localhost over HTTP";
    }

    const message = error && typeof error.message === "string" ? error.message : "";
    if (/NetworkError|Failed to fetch|fetch/i.test(message)) {
      return "Request blocked or failed";
    }

    return "Request failed";
  }

  function normalizeVideoUrl(value) {
    const url = safeUrl(value);
    if (!url || url.protocol !== "https:") {
      return null;
    }

    const trimmed = url.toString();
    if (!trimmed || trimmed.startsWith("blob:")) {
      return null;
    }

    if (!/\.(mp4|webm|ogg)(\?|#|$)/i.test(trimmed)) {
      return null;
    }

    return trimmed;
  }

  function normalizeHttpsUrl(value) {
    const url = safeUrl(value);
    if (!url || url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  }

  function dedupeBy(items, getKey) {
    const seen = new Set();
    return items.filter((item) => {
      const key = getKey(item);
      if (!key || seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  function getSiteKind(hostname = globalThis.location && globalThis.location.hostname) {
    const normalized = typeof hostname === "string" ? hostname.trim().toLowerCase() : "";
    if (X_HOSTS.has(normalized)) {
      return "x";
    }

    if (TRUTH_SOCIAL_HOSTS.has(normalized)) {
      return "truthsocial";
    }

    return null;
  }

  function extractMedia(article) {
    const images = Array.from(article.querySelectorAll('img[src*="pbs.twimg.com/media"]'))
      .map((img) => img.getAttribute("src"))
      .filter(Boolean)
      .map((url) => ({ url }));

    const uniqueImages = dedupeBy(images, (item) => item.url);

    const videoEl = article.querySelector("video");
    const video = videoEl
      ? {
          url: normalizeVideoUrl(videoEl.currentSrc || videoEl.getAttribute("src") || null),
          posterUrl: videoEl.getAttribute("poster") || null,
        }
      : null;

    if (!uniqueImages.length && !video) {
      return null;
    }

    return {
      images: uniqueImages,
      video,
    };
  }

  function extractXPost(article) {
    const link = article.querySelector('a[href*="/status/"]');
    const href = link ? link.getAttribute("href") : "";
    const statusMatch = href ? href.match(/^\/([^/]+)\/status\/(\d+)/) : null;

    const textNode = article.querySelector('[data-testid="tweetText"]');
    const text = textNode ? textNode.innerText.trim() : "";
    const media = extractMedia(article);

    if (!statusMatch || (!text && !media)) {
      return null;
    }

    const author = statusMatch[1];
    const postId = statusMatch[2];
    const timeNode = article.querySelector("time");
    const createdAt = timeNode ? timeNode.getAttribute("datetime") : null;

    return {
      id: postId,
      author,
      text,
      url: `https://x.com/${author}/status/${postId}`,
      media,
      createdAt,
    };
  }

  function parseTruthSocialPostUrl(value) {
    const url = safeUrl(value);
    if (!url || !TRUTH_SOCIAL_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }

    const match = url.pathname.match(/^\/@([A-Za-z0-9_]{1,30})\/posts\/(\d+)(?:\/)?$/);
    if (!match) {
      return null;
    }

    return {
      author: match[1],
      id: match[2],
      url: `https://truthsocial.com/@${match[1]}/posts/${match[2]}`,
      apiUrl: `${url.origin}/api/v1/statuses/${match[2]}`,
    };
  }

  function htmlToPlainText(value) {
    if (!value || typeof value !== "string") {
      return "";
    }

    if (typeof DOMParser === "undefined") {
      return value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(value, "text/html");
    const text = doc.body ? doc.body.textContent || "" : "";
    return text
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  function normalizeTruthSocialMedia(mediaAttachments) {
    if (!Array.isArray(mediaAttachments) || !mediaAttachments.length) {
      return null;
    }

    const images = mediaAttachments
      .filter((item) => item && item.type === "image")
      .map((item) => normalizeHttpsUrl(item.url || item.preview_url || null))
      .filter(Boolean)
      .map((url) => ({ url }));

    const videoAttachment = mediaAttachments.find((item) => item && (item.type === "video" || item.type === "gifv"));
    const video = videoAttachment
      ? {
          url: normalizeVideoUrl(videoAttachment.url) || normalizeVideoUrl(videoAttachment.remote_url),
          posterUrl: videoAttachment.preview_url || null,
        }
      : null;

    if (!images.length && !video) {
      return null;
    }

    return {
      images: dedupeBy(images, (item) => item.url),
      video,
    };
  }

  function findTruthSocialPostUrl(article, locationObj = globalThis.location) {
    if (typeof article === "string") {
      return parseTruthSocialPostUrl(article);
    }

    if (article && typeof article.postUrl === "string") {
      return parseTruthSocialPostUrl(article.postUrl);
    }

    if (article && article.dataset && typeof article.dataset.trumpornotPostUrl === "string") {
      return parseTruthSocialPostUrl(article.dataset.trumpornotPostUrl);
    }

    if (article && article.querySelector) {
      const link = article.querySelector('a[href*="/posts/"]');
      const href = link ? link.getAttribute("href") : "";
      if (href) {
        const parsed = parseTruthSocialPostUrl(new URL(href, locationObj && locationObj.href ? locationObj.href : "https://truthsocial.com").toString());
        if (parsed) {
          return parsed;
        }
      }
    }

    return parseTruthSocialPostUrl(locationObj && locationObj.href);
  }

  async function extractTruthSocialPost(article, options = {}) {
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const locationObj = options.locationObj || globalThis.location;
    const parsed = findTruthSocialPostUrl(article, locationObj);
    if (!parsed || typeof fetchImpl !== "function") {
      return null;
    }

    const response = await fetchImpl(parsed.apiUrl, {
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
    });

    if (!response.ok) {
      throw new Error(`Truth Social lookup failed (${response.status})`);
    }

    const status = await response.json();
    const author = status && status.account && typeof status.account.acct === "string"
      ? status.account.acct.replace(/^@/, "").trim()
      : parsed.author;
    const text = htmlToPlainText(status && status.content);
    const media = normalizeTruthSocialMedia(status && status.media_attachments);

    if (!text && !media) {
      return null;
    }

    return {
      id: parsed.id,
      author,
      text,
      url: parsed.url,
      media,
      createdAt: status && typeof status.created_at === "string" ? status.created_at : null,
    };
  }

  async function extractPost(article, options = {}) {
    const locationObj = options.locationObj || globalThis.location;
    const siteKind = options.siteKind || getSiteKind(locationObj && locationObj.hostname);

    if (siteKind === "truthsocial") {
      return extractTruthSocialPost(article, options);
    }

    if (siteKind === "x") {
      return extractXPost(article);
    }

    return null;
  }

  async function getSettings(storage) {
    const settings = await storage.local.get(["apiBase", "apiKey"]);
    return {
      apiBase: normalizeApiBase(settings.apiBase),
      apiKey: (settings.apiKey || "").trim(),
    };
  }

  async function savePost(fetchImpl, apiBase, apiKey, payload) {
    return fetchImpl(`${apiBase}/api/posts`, {
      cache: "no-store",
      credentials: "omit",
      method: "POST",
      mode: "cors",
      referrerPolicy: "no-referrer",
      headers: {
        "Content-Type": "application/json",
        "x-extension-key": apiKey,
      },
      body: JSON.stringify(payload),
    });
  }

  return {
    dedupeBy,
    extractMedia,
    extractPost,
    extractTruthSocialPost,
    extractXPost,
    getSiteKind,
    getFetchErrorMessage,
    getApiOriginPermissionPattern,
    getSettings,
    isSupportedApiUrl,
    parseTruthSocialPostUrl,
    normalizeApiBase,
    normalizeTruthSocialMedia,
    normalizeVideoUrl,
    safeUrl,
    savePost,
  };
});
