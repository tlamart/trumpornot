(() => {
  const VERIFIED_HANDLES = new Set([
    "@realDonaldTrump",
    "@POTUS",
    "@WhiteHouse",
  ]);
  const HTTPS_PROTOCOLS = new Set(["https:"]);
  const SAFE_POST_HOSTS = new Set([
    "x.com",
    "www.x.com",
    "twitter.com",
    "www.twitter.com",
    "mobile.twitter.com",
  ]);

  function getApiBase() {
    const configuredBase =
      globalThis.TRUMPORNOT_API_BASE ||
      document.documentElement.dataset.apiBase ||
      null;

    if (configuredBase) {
      return configuredBase.replace(/\/$/, "");
    }

    const { protocol, hostname, port, origin } = window.location;
    const isLocalStaticDev =
      hostname === "localhost" &&
      (port === "8000" || port === "8080" || port === "4173" || port === "5173");

    if (isLocalStaticDev) {
      return `${protocol}//${hostname}:3000`;
    }

    return origin.replace(/\/$/, "");
  }

  function getUtcDayKey(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function hashToIndex(str, mod) {
    let hash = 0;
    for (let i = 0; i < str.length; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    }
    return hash % mod;
  }

  function formatPostTime(createdAt) {
    if (!createdAt) return "today";
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "today";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function isVerifiedHandle(handle) {
    if (!handle) return false;
    return VERIFIED_HANDLES.has(handle.trim());
  }

  function rangedNumber(seed, min, max) {
    return min + hashToIndex(seed, max - min + 1);
  }

  function formatCount(value) {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1).replace(".0", "")}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1).replace(".0", "")}K`;
    }
    return String(value);
  }

  function renderFakeMetrics(metricElements, seedKey, postTextValue) {
    const seed = `${seedKey}|${postTextValue}`;
    metricElements.reply.textContent = formatCount(rangedNumber(`${seed}:r`, 180, 9800));
    metricElements.repost.textContent = formatCount(rangedNumber(`${seed}:rp`, 90, 6200));
    metricElements.like.textContent = formatCount(rangedNumber(`${seed}:l`, 1200, 98000));
    metricElements.view.textContent = formatCount(rangedNumber(`${seed}:v`, 22000, 2400000));
  }

  function canRenderVideoUrl(url) {
    const normalized = normalizeHttpsUrl(url);
    if (!normalized) {
      return false;
    }

    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(normalized);
  }

  function safeUrl(value) {
    if (!value || typeof value !== "string") {
      return null;
    }

    try {
      return new URL(value.trim());
    } catch (_error) {
      return null;
    }
  }

  function normalizeHttpsUrl(value) {
    const url = safeUrl(value);
    if (!url || !HTTPS_PROTOCOLS.has(url.protocol)) {
      return null;
    }

    return url.toString();
  }

  function normalizePostSourceUrl(value) {
    const normalized = normalizeHttpsUrl(value);
    if (!normalized) {
      return null;
    }

    const url = new URL(normalized);
    if (!SAFE_POST_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }

    return /^\/[^/]+\/status\/\d+(?:\/)?$/i.test(url.pathname) ? normalized : null;
  }

  function normalizeRenderableMedia(media) {
    if (!media || typeof media !== "object") {
      return null;
    }

    const images = Array.isArray(media.images)
      ? media.images
          .map((image) => {
            const url = normalizeHttpsUrl(image && image.url);
            return url ? { url } : null;
          })
          .filter(Boolean)
      : [];

    const video = media.video && typeof media.video === "object"
      ? {
          url: normalizeHttpsUrl(media.video.url),
          posterUrl: normalizeHttpsUrl(media.video.posterUrl),
        }
      : null;
    const normalizedVideo = video && (video.url || video.posterUrl) ? video : null;

    if (!images.length && !normalizedVideo) {
      return null;
    }

    return {
      images,
      video: normalizedVideo,
    };
  }

  function renderMedia(postMedia, media) {
    const normalizedMedia = normalizeRenderableMedia(media);
    postMedia.innerHTML = "";
    postMedia.classList.toggle("hidden", !normalizedMedia);

    if (!normalizedMedia) {
      return;
    }

    if (Array.isArray(normalizedMedia.images)) {
      normalizedMedia.images.forEach((image) => {
        if (!image || !image.url) {
          return;
        }

        const img = document.createElement("img");
        img.className = "x-media-image";
        img.src = image.url;
        img.alt = "Post image";
        img.loading = "lazy";
        postMedia.appendChild(img);
      });
    }

    if (normalizedMedia.video && (normalizedMedia.video.url || normalizedMedia.video.posterUrl)) {
      if (canRenderVideoUrl(normalizedMedia.video.url)) {
        const video = document.createElement("video");
        video.className = "x-media-video";
        video.src = normalizedMedia.video.url;
        if (normalizedMedia.video.posterUrl) {
          video.poster = normalizedMedia.video.posterUrl;
        }
        video.controls = true;
        video.preload = "metadata";
        postMedia.appendChild(video);
      } else if (normalizedMedia.video.posterUrl) {
        const wrapper = document.createElement("div");
        wrapper.className = "x-media-video-poster";

        const poster = document.createElement("img");
        poster.className = "x-media-image";
        poster.src = normalizedMedia.video.posterUrl;
        poster.alt = "Video preview";
        wrapper.appendChild(poster);

        const badge = document.createElement("span");
        badge.className = "x-media-video-badge";
        badge.textContent = "Video";
        wrapper.appendChild(badge);

        postMedia.appendChild(wrapper);
      }
    }

    postMedia.classList.toggle("hidden", !postMedia.childElementCount);
  }

  function shouldUseEmbeddedTweet(post) {
    return Boolean(post && normalizePostSourceUrl(post.source) && post.media && post.media.video);
  }

  async function renderEmbeddedTweet(embedContainer, sourceUrl) {
    const normalizedSourceUrl = normalizePostSourceUrl(sourceUrl);
    embedContainer.innerHTML = "";
    embedContainer.classList.toggle("hidden", !normalizedSourceUrl);

    if (!normalizedSourceUrl) {
      return;
    }

    const blockquote = document.createElement("blockquote");
    blockquote.className = "twitter-tweet";
    blockquote.setAttribute("data-media-max-width", "560");

    const link = document.createElement("a");
    link.href = toTwitterStatusUrl(normalizedSourceUrl);
    blockquote.appendChild(link);
    embedContainer.appendChild(blockquote);

    const twttr = await ensureTwitterWidgets();
    if (twttr && twttr.widgets && typeof twttr.widgets.load === "function") {
      twttr.widgets.load(embedContainer);
    }
  }

  function toTwitterStatusUrl(url) {
    const normalized = normalizePostSourceUrl(url);
    if (!normalized) {
      return null;
    }

    const parsed = new URL(normalized);
    parsed.hostname = "twitter.com";
    return parsed.toString();
  }

  function renderPostDetails(container, detailText, sourceUrl, trailingText = "") {
    const normalizedSourceUrl = normalizePostSourceUrl(sourceUrl);
    container.textContent = "";

    const safeDetail = typeof detailText === "string" ? detailText.trim() : "";
    if (safeDetail) {
      container.append(document.createTextNode(safeDetail));
    }

    if (normalizedSourceUrl) {
      if (safeDetail) {
        container.append(document.createTextNode(" "));
      }

      const link = document.createElement("a");
      link.href = normalizedSourceUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Source";
      container.append(link);
      container.append(document.createTextNode("."));
    }

    if (trailingText) {
      if (container.childNodes.length) {
        container.append(document.createTextNode(" "));
      }
      container.append(document.createTextNode(trailingText));
    }
  }

  async function ensureTwitterWidgets() {
    if (window.twttr && window.twttr.widgets) {
      return window.twttr;
    }

    const existing = document.getElementById("twitter-wjs");
    if (existing) {
      return waitForTwitterWidgets();
    }

    const script = document.createElement("script");
    script.id = "twitter-wjs";
    script.async = true;
    script.src = "https://platform.twitter.com/widgets.js";
    document.body.appendChild(script);

    return waitForTwitterWidgets();
  }

  function waitForTwitterWidgets() {
    return new Promise((resolve) => {
      let attempts = 0;
      const timer = window.setInterval(() => {
        if (window.twttr && window.twttr.widgets) {
          window.clearInterval(timer);
          resolve(window.twttr);
          return;
        }

        attempts += 1;
        if (attempts > 100) {
          window.clearInterval(timer);
          resolve(null);
        }
      }, 100);
    });
  }

  window.TrumpOrNotClient = {
    formatPostTime,
    getApiBase,
    getUtcDayKey,
    hashToIndex,
    isVerifiedHandle,
    normalizePostSourceUrl,
    renderEmbeddedTweet,
    renderPostDetails,
    renderFakeMetrics,
    renderMedia,
    shouldUseEmbeddedTweet,
  };
})();
