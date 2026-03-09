const API_BASE = "http://localhost:3000";
const STORAGE_KEY = "adminPageKey";

const adminKeyInput = document.getElementById("adminKey");
const saveAdminKeyBtn = document.getElementById("saveAdminKeyBtn");
const adminStatus = document.getElementById("adminStatus");
const dateLabel = document.getElementById("dateLabel");
const postCard = document.getElementById("postCard");
const embedContainer = document.getElementById("embedContainer");
const postText = document.getElementById("postText");
const postMedia = document.getElementById("postMedia");
const xDisplayName = document.getElementById("xDisplayName");
const xVerified = document.getElementById("xVerified");
const xHandle = document.getElementById("xHandle");
const xTime = document.getElementById("xTime");
const xCountReply = document.getElementById("xCountReply");
const xCountRepost = document.getElementById("xCountRepost");
const xCountLike = document.getElementById("xCountLike");
const xCountView = document.getElementById("xCountView");
const result = document.getElementById("result");
const details = document.getElementById("details");
const realBtn = document.getElementById("realBtn");
const fakeBtn = document.getElementById("fakeBtn");
const nextBtn = document.getElementById("nextBtn");

let currentPost = null;

saveAdminKeyBtn.addEventListener("click", saveAdminKey);
nextBtn.addEventListener("click", () => loadRandomPost(true));
realBtn.addEventListener("click", () => submitGuess(true));
fakeBtn.addEventListener("click", () => submitGuess(false));

init();

async function init() {
  const savedKey = localStorage.getItem(STORAGE_KEY) || "";
  if (savedKey) {
    adminKeyInput.value = savedKey;
    setAdminStatus("Key loaded");
    await loadRandomPost(false);
  } else {
    setAdminStatus("Enter the admin key to unlock random review", true);
  }
}

function saveAdminKey() {
  const key = adminKeyInput.value.trim();
  if (!key) {
    setAdminStatus("Admin key required", true);
    return;
  }

  localStorage.setItem(STORAGE_KEY, key);
  setAdminStatus("Key saved");
  loadRandomPost(false);
}

async function loadRandomPost(forceNewPost) {
  const key = localStorage.getItem(STORAGE_KEY) || adminKeyInput.value.trim();
  if (!key) {
    setAdminStatus("Admin key required", true);
    return;
  }

  disableGuessing(true);
  result.textContent = "";
  details.textContent = "";
  dateLabel.textContent = "Loading random review...";

  const params = new URLSearchParams();
  if (forceNewPost && currentPost && currentPost.id) {
    params.set("exclude_id", String(currentPost.id));
  }

  const query = params.toString();
  const response = await fetch(`${API_BASE}/api/admin/random${query ? `?${query}` : ""}`, {
    headers: {
      "x-admin-key": key,
    },
  }).catch(() => null);

  if (!response) {
    setAdminStatus("Backend request failed", true);
    dateLabel.textContent = "Random review unavailable";
    return;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    setAdminStatus(body.error || `Request failed (${response.status})`, true);
    dateLabel.textContent = "Random review unavailable";
    return;
  }

  const data = await response.json();
  currentPost = {
    id: data.post.id,
    text: data.post.text || "",
    isReal: Boolean(data.answer.is_real),
    source: data.post.url || null,
    media: data.post.media || null,
    handle: data.post.author ? `@${data.post.author}` : "@realDonaldTrump",
    createdAt: data.post.created_at || null,
    detail: "Review mode. Unlimited guesses, one post at a time.",
    displayName: "Donald J. Trump",
  };

  await renderCurrentPost();
  disableGuessing(false);
  setAdminStatus("Unlocked");
}

async function renderCurrentPost() {
  if (!currentPost) {
    return;
  }

  dateLabel.textContent = `Review post #${currentPost.id}`;
  await renderPostPresentation(currentPost);
  renderFakeMetrics(String(currentPost.id), currentPost.text);
}

async function renderPostPresentation(post) {
  if (shouldUseEmbeddedTweet(post)) {
    postText.textContent = post.text;
    postText.classList.toggle("hidden", !post.text);
    postMedia.classList.add("hidden");
    postMedia.innerHTML = "";
    xDisplayName.textContent = currentPost.displayName;
    xHandle.textContent = currentPost.handle;
    xTime.textContent = formatPostTime(currentPost.createdAt);
    xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
    await renderEmbeddedTweet(post.source);
    return;
  }

  embedContainer.classList.add("hidden");
  embedContainer.innerHTML = "";
  postText.textContent = currentPost.text;
  postText.classList.toggle("hidden", !currentPost.text);
  renderMedia(currentPost.media);
  xDisplayName.textContent = currentPost.displayName;
  xHandle.textContent = currentPost.handle;
  xTime.textContent = formatPostTime(currentPost.createdAt);
  xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
}

function submitGuess(userSaysReal) {
  if (!currentPost) {
    return;
  }

  const correct = userSaysReal === currentPost.isReal;
  result.textContent = correct ? "Correct." : "Nope.";
  result.style.color = correct ? "var(--real)" : "var(--fake)";

  if (currentPost.source) {
    details.innerHTML = `${currentPost.detail} <a href="${currentPost.source}" target="_blank" rel="noreferrer">Source</a>.`;
  } else {
    details.textContent = currentPost.detail;
  }

  disableGuessing(true);
}

function disableGuessing(disabled) {
  realBtn.disabled = disabled;
  fakeBtn.disabled = disabled;
}

function setAdminStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("error", isError);
}

function formatPostTime(createdAt) {
  if (!createdAt) return "today";
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "today";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isVerifiedHandle(handle) {
  if (!handle) return false;
  const verifiedHandles = new Set(["@realDonaldTrump", "@POTUS", "@WhiteHouse"]);
  return verifiedHandles.has(handle.trim());
}

function renderFakeMetrics(seedKey, postTextValue) {
  const seed = `${seedKey}|${postTextValue}`;
  xCountReply.textContent = formatCount(rangedNumber(`${seed}:r`, 180, 9800));
  xCountRepost.textContent = formatCount(rangedNumber(`${seed}:rp`, 90, 6200));
  xCountLike.textContent = formatCount(rangedNumber(`${seed}:l`, 1200, 98000));
  xCountView.textContent = formatCount(rangedNumber(`${seed}:v`, 22000, 2400000));
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
      video.poster = media.video.posterUrl || "";
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
  return min + (hashToIndex(seed, max - min + 1));
}

function hashToIndex(str, mod) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
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
