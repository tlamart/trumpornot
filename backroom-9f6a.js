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

const adminOverlay = document.getElementById("adminOverlay");
const adminOverlayForm = document.getElementById("adminOverlayForm");
const adminKeyInput = document.getElementById("adminKey");
const saveAdminKeyBtn = document.getElementById("saveAdminKeyBtn");
const changeAdminKeyBtn = document.getElementById("changeAdminKeyBtn");
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

adminOverlayForm.addEventListener("submit", saveAdminKey);
changeAdminKeyBtn.addEventListener("click", () => {
  openAdminOverlay("Update the admin key to continue.", false);
});
nextBtn.addEventListener("click", () => loadReviewPost(true));
realBtn.addEventListener("click", () => submitGuess(true));
fakeBtn.addEventListener("click", () => submitGuess(false));

init();

async function init() {
  disableGuessing(true);
  const savedKey = localStorage.getItem(STORAGE_KEY) || "";
  if (savedKey) {
    adminKeyInput.value = savedKey;
    const unlocked = await loadReviewPost(false, savedKey);
    if (unlocked) {
      closeAdminOverlay();
      setAdminStatus("Unlocked");
      return;
    }
  } else {
    dateLabel.textContent = "Random review locked";
  }

  openAdminOverlay("Enter the admin key to unlock random review.", true);
}

async function saveAdminKey(event) {
  event.preventDefault();
  const key = adminKeyInput.value.trim();
  if (!key) {
    setAdminStatus("Admin key required", true);
    return;
  }

  saveAdminKeyBtn.disabled = true;
  setAdminStatus("Unlocking...", false);

  const unlocked = await loadReviewPost(false, key);
  if (!unlocked) {
    saveAdminKeyBtn.disabled = false;
    return;
  }

  localStorage.setItem(STORAGE_KEY, key);
  setAdminStatus("Unlocked");
  closeAdminOverlay();
  saveAdminKeyBtn.disabled = false;
}

async function loadReviewPost(loadNextPost, overrideKey = null) {
  const key = overrideKey || localStorage.getItem(STORAGE_KEY) || adminKeyInput.value.trim();
  if (!key) {
    setAdminStatus("Admin key required", true);
    return false;
  }

  disableGuessing(true);
  result.textContent = "";
  details.textContent = "";
  dateLabel.textContent = "Loading review post...";

  const params = new URLSearchParams();
  if (loadNextPost && currentPost && currentPost.id) {
    params.set("after_id", String(currentPost.id));
  }

  const query = params.toString();
  const response = await fetch(`${API_BASE}/api/admin/review${query ? `?${query}` : ""}`, {
    headers: {
      "x-admin-key": key,
    },
  }).catch(() => null);

  if (!response) {
    setAdminStatus("Backend request failed", true);
    dateLabel.textContent = "Review unavailable";
    return false;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    setAdminStatus(body.error || `Request failed (${response.status})`, true);
    dateLabel.textContent = "Review unavailable";
    return false;
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
    detail: "Review mode. Posts are shown in archive order, one at a time.",
    displayName: "Donald J. Trump",
  };

  await renderCurrentPost();
  disableGuessing(false);
  setAdminStatus("Unlocked");
  return true;
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
  nextBtn.disabled = disabled;
}

function setAdminStatus(message, isError = false) {
  adminStatus.textContent = message;
  adminStatus.classList.toggle("error", isError);
}

function openAdminOverlay(message, isError = false) {
  adminOverlay.classList.remove("hidden");
  adminKeyInput.focus();
  adminKeyInput.select();
  setAdminStatus(message, isError);
}

function closeAdminOverlay() {
  adminOverlay.classList.add("hidden");
}
