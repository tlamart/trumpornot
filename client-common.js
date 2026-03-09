(() => {
  const VERIFIED_HANDLES = new Set([
    "@realDonaldTrump",
    "@POTUS",
    "@WhiteHouse",
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
    if (!url || typeof url !== "string") {
      return false;
    }

    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith("blob:")) {
      return false;
    }

    return /\.(mp4|webm|ogg)(\?|#|$)/i.test(trimmed);
  }

  function renderMedia(postMedia, media) {
    postMedia.innerHTML = "";
    postMedia.classList.toggle("hidden", !media);

    if (!media) {
      return;
    }

    if (Array.isArray(media.images)) {
      media.images.forEach((image) => {
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

    if (media.video && (media.video.url || media.video.posterUrl)) {
      if (canRenderVideoUrl(media.video.url)) {
        const video = document.createElement("video");
        video.className = "x-media-video";
        video.src = media.video.url;
        if (media.video.posterUrl) {
          video.poster = media.video.posterUrl;
        }
        video.controls = true;
        video.preload = "metadata";
        postMedia.appendChild(video);
      } else if (media.video.posterUrl) {
        const wrapper = document.createElement("div");
        wrapper.className = "x-media-video-poster";

        const poster = document.createElement("img");
        poster.className = "x-media-image";
        poster.src = media.video.posterUrl;
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
    return Boolean(post && post.source && post.media && post.media.video);
  }

  async function renderEmbeddedTweet(embedContainer, sourceUrl) {
    embedContainer.innerHTML = "";
    embedContainer.classList.remove("hidden");

    const blockquote = document.createElement("blockquote");
    blockquote.className = "twitter-tweet";
    blockquote.setAttribute("data-media-max-width", "560");

    const link = document.createElement("a");
    link.href = toTwitterStatusUrl(sourceUrl);
    blockquote.appendChild(link);
    embedContainer.appendChild(blockquote);

    const twttr = await ensureTwitterWidgets();
    if (twttr && twttr.widgets && typeof twttr.widgets.load === "function") {
      twttr.widgets.load(embedContainer);
    }
  }

  function toTwitterStatusUrl(url) {
    return url.replace("https://x.com/", "https://twitter.com/");
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
    hashToIndex,
    isVerifiedHandle,
    renderEmbeddedTweet,
    renderFakeMetrics,
    renderMedia,
    shouldUseEmbeddedTweet,
  };
})();
