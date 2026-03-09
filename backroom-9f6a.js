const {
  formatPostTime,
  getApiBase,
  isVerifiedHandle,
  renderEmbeddedTweet,
  renderFakeMetrics,
  renderMedia,
  shouldUseEmbeddedTweet,
} = window.TrumpOrNotClient;

const API_BASE = getApiBase();
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
  renderFakeMetrics(
    {
      reply: xCountReply,
      repost: xCountRepost,
      like: xCountLike,
      view: xCountView,
    },
    String(currentPost.id),
    currentPost.text,
  );
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
    await renderEmbeddedTweet(embedContainer, post.source);
    return;
  }

  embedContainer.classList.add("hidden");
  embedContainer.innerHTML = "";
  postText.textContent = currentPost.text;
  postText.classList.toggle("hidden", !currentPost.text);
  renderMedia(postMedia, currentPost.media);
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
