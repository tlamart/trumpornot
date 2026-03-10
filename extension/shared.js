(function initTrumpOrNotExtensionShared(root, factory) {
  const api = factory();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }

  root.TrumpOrNotExtension = api;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

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

  function extractPost(article) {
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
    getFetchErrorMessage,
    getApiOriginPermissionPattern,
    getSettings,
    isSupportedApiUrl,
    normalizeApiBase,
    normalizeVideoUrl,
    safeUrl,
    savePost,
  };
});
