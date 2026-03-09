const posts = [
  {
    text: "MAKE AMERICA GREAT AGAIN!",
    isReal: true,
    detail: "Real: from Donald J. Trump on X (campaign slogan post).",
    source: "https://x.com/realDonaldTrump",
  },
  {
    text: "WE WILL SECURE THE BORDER, LOWER PRICES, AND BRING BACK THE AMERICAN DREAM!",
    isReal: true,
    detail: "Real: posted by Donald J. Trump on X during campaign messaging.",
    source: "https://x.com/realDonaldTrump",
  },
  {
    text: "Everyone says my golf game is too powerful for Europe. Probably true!",
    isReal: false,
    detail: "Fake: generated parody text.",
  },
  {
    text: "BREAKING: I just renamed Monday to WINNINGDAY. You're welcome!",
    isReal: false,
    detail: "Fake: generated parody text.",
  },
  {
    text: "I WILL NEVER SURRENDER TO THE DEEP STATE!",
    isReal: true,
    detail: "Real: language used in Trump campaign-era X posts.",
    source: "https://x.com/realDonaldTrump",
  },
  {
    text: "My enemies fear two things: tariffs and my dance moves.",
    isReal: false,
    detail: "Fake: generated parody text.",
  },
  {
    text: "TOGETHER, WE WILL MAKE 2025 THE GREATEST YEAR IN AMERICAN HISTORY!",
    isReal: false,
    detail: "Fake: plausible style mimic, but not an actual post.",
  },
  {
    text: "Thank you to everyone at the rally tonight. Incredible crowd, incredible energy!",
    isReal: true,
    detail: "Real: common rally thank-you language from Trump's X posts.",
    source: "https://x.com/realDonaldTrump",
  },
];

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

const API_BASE = getApiBase();

const dateLabel = document.getElementById("dateLabel");
const postCard = document.getElementById("postCard");
const embedContainer = document.getElementById("embedContainer");
const postText = document.getElementById("postText");
const xDisplayName = document.getElementById("xDisplayName");
const xVerified = document.getElementById("xVerified");
const xHandle = document.getElementById("xHandle");
const xTime = document.getElementById("xTime");
const postMedia = document.getElementById("postMedia");
const xCountReply = document.getElementById("xCountReply");
const xCountRepost = document.getElementById("xCountRepost");
const xCountLike = document.getElementById("xCountLike");
const xCountView = document.getElementById("xCountView");
const result = document.getElementById("result");
const details = document.getElementById("details");
const realBtn = document.getElementById("realBtn");
const fakeBtn = document.getElementById("fakeBtn");

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashToIndex(str, mod) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

async function render() {
  const todayKey = getTodayKey();
  const todayPost = await getDailyPost(todayKey);
  const storedGuess = localStorage.getItem(`guess:${todayKey}`);

  const date = new Date();
  dateLabel.textContent = `Date: ${date.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}`;
  await renderPostPresentation(todayPost, todayKey);

  if (storedGuess) {
    showResult(storedGuess === "real", todayPost, true);
  } else {
    realBtn.disabled = false;
    fakeBtn.disabled = false;
    result.textContent = "";
    details.textContent = "";
  }

  realBtn.onclick = () => submitGuess(true, todayPost, todayKey);
  fakeBtn.onclick = () => submitGuess(false, todayPost, todayKey);
}

function submitGuess(userSaysReal, post, todayKey) {
  localStorage.setItem(`guess:${todayKey}`, userSaysReal ? "real" : "fake");
  showResult(userSaysReal, post, false);
}

function showResult(userSaysReal, post, fromStorage) {
  const correct = userSaysReal === post.isReal;
  result.textContent = correct ? "Correct." : "Nope.";
  result.style.color = correct ? "var(--real)" : "var(--fake)";

  if (post.source) {
    details.innerHTML = `${post.detail} <a href="${post.source}" target="_blank" rel="noreferrer">Source</a>.`;
  } else {
    details.textContent = post.detail;
  }

  if (fromStorage) {
    details.textContent += " You already guessed today.";
  }

  realBtn.disabled = true;
  fakeBtn.disabled = true;
}

render();

async function getDailyPost(todayKey) {
  try {
    const response = await fetch(`${API_BASE}/api/daily`);
    if (!response.ok) {
      throw new Error("Daily endpoint unavailable");
    }

    const data = await response.json();
    return {
      text: data.post.text,
      isReal: Boolean(data.answer.is_real),
      detail: data.post.url
        ? "From your curated database."
        : "From your curated database.",
      source: data.post.url || null,
      media: data.post.media || null,
      displayName: "Donald J. Trump",
      handle: data.post.author ? `@${data.post.author}` : "@realDonaldTrump",
      createdAt: data.post.created_at || null,
    };
  } catch (_error) {
    const index = hashToIndex(todayKey, posts.length);
    return {
      ...posts[index],
      media: null,
      displayName: "Donald J. Trump",
      handle: "@realDonaldTrump",
      createdAt: null,
    };
  }
}

async function renderPostPresentation(post, metricSeed) {
  if (shouldUseEmbeddedTweet(post)) {
    postText.textContent = post.text;
    postText.classList.toggle("hidden", !post.text);
    postMedia.classList.add("hidden");
    postMedia.innerHTML = "";
    xDisplayName.textContent = post.displayName || "Donald J. Trump";
    xHandle.textContent = post.handle || "@realDonaldTrump";
    xTime.textContent = formatPostTime(post.createdAt);
    xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
    await renderEmbeddedTweet(post.source);
    renderFakeMetrics(metricSeed, post.text);
    return;
  }

  embedContainer.classList.add("hidden");
  embedContainer.innerHTML = "";
  postText.textContent = post.text;
  postText.classList.toggle("hidden", !post.text);
  renderMedia(post.media);
  xDisplayName.textContent = post.displayName || "Donald J. Trump";
  xHandle.textContent = post.handle || "@realDonaldTrump";
  xTime.textContent = formatPostTime(post.createdAt);
  xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
  renderFakeMetrics(metricSeed, post.text);
}

function formatPostTime(createdAt) {
  if (!createdAt) return "today";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isVerifiedHandle(handle) {
  if (!handle) return false;
  const verifiedHandles = new Set([
    "@realDonaldTrump",
    "@POTUS",
    "@WhiteHouse",
  ]);
  return verifiedHandles.has(handle.trim());
}

function renderFakeMetrics(dayKey, postTextValue) {
  const seed = `${dayKey}|${postTextValue}`;
  const reply = rangedNumber(`${seed}:r`, 180, 9800);
  const repost = rangedNumber(`${seed}:rp`, 90, 6200);
  const like = rangedNumber(`${seed}:l`, 1200, 98000);
  const view = rangedNumber(`${seed}:v`, 22000, 2400000);

  xCountReply.textContent = formatCount(reply);
  xCountRepost.textContent = formatCount(repost);
  xCountLike.textContent = formatCount(like);
  xCountView.textContent = formatCount(view);
}

function renderMedia(media) {
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

function shouldUseEmbeddedTweet(post) {
  return Boolean(post && post.source && post.media && post.media.video);
}

async function renderEmbeddedTweet(sourceUrl) {
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

function rangedNumber(seed, min, max) {
  const n = hashToIndex(seed, max - min + 1);
  return min + n;
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
