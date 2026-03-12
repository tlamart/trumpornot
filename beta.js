const {
  formatPostTime,
  getApiBase,
  getPresentedHandle,
  isVerifiedHandle,
  renderEmbeddedTweet,
  renderFakeMetrics,
  renderMedia,
  renderPostDetails,
  shouldUseEmbeddedTweet,
} = window.TrumpOrNotClient;

const API_BASE = getApiBase();
const STORAGE_KEY = "betaPageKey";
const STREAK_STORAGE_KEY = "betaGoodAnswerStreak";

const betaOverlay = document.getElementById("betaOverlay");
const betaOverlayForm = document.getElementById("betaOverlayForm");
const betaKeyInput = document.getElementById("betaKey");
const saveBetaKeyBtn = document.getElementById("saveBetaKeyBtn");
const changeBetaKeyBtn = document.getElementById("changeBetaKeyBtn");
const betaStatus = document.getElementById("betaStatus");
const dateLabel = document.getElementById("dateLabel");
const streakValue = document.getElementById("streakValue");
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
const nextBtn = document.getElementById("nextBtn");

let currentPost = null;

betaOverlayForm.addEventListener("submit", saveBetaKey);
changeBetaKeyBtn.addEventListener("click", () => {
  openBetaOverlay("Update the beta key to continue.", false);
});
nextBtn.addEventListener("click", () => loadPost(true));
realBtn.addEventListener("click", () => submitGuess(true));
fakeBtn.addEventListener("click", () => submitGuess(false));

init();

async function init() {
  disableControls(true);
  updateStreakDisplay(getStreak());
  const savedKey = sessionStorage.getItem(STORAGE_KEY) || "";
  if (savedKey) {
    betaKeyInput.value = savedKey;
    const unlocked = await loadPost(false, savedKey);
    if (unlocked) {
      closeBetaOverlay();
      setBetaStatus("Unlocked");
      return;
    }
  } else {
    dateLabel.textContent = "Unlimited play locked";
  }

  openBetaOverlay("Enter the beta key to unlock unlimited play.", true);
}

async function saveBetaKey(event) {
  event.preventDefault();
  const key = betaKeyInput.value.trim();
  if (!key) {
    setBetaStatus("Beta key required", true);
    return;
  }

  saveBetaKeyBtn.disabled = true;
  setBetaStatus("Unlocking...", false);

  const unlocked = await loadPost(false, key);
  if (!unlocked) {
    saveBetaKeyBtn.disabled = false;
    return;
  }

  sessionStorage.setItem(STORAGE_KEY, key);
  setBetaStatus("Unlocked");
  closeBetaOverlay();
  saveBetaKeyBtn.disabled = false;
}

async function loadPost(forceNext, overrideKey = null) {
  const key = overrideKey || sessionStorage.getItem(STORAGE_KEY) || betaKeyInput.value.trim();
  if (!key) {
    setBetaStatus("Beta key required", true);
    return false;
  }

  disableControls(true);
  result.textContent = "";
  details.textContent = "";
  dateLabel.textContent = "Loading beta round...";

  const params = new URLSearchParams();
  if (forceNext && currentPost && currentPost.id) {
    params.set("exclude_id", String(currentPost.id));
  }

  const query = params.toString();
  const response = await fetch(`${API_BASE}/api/beta/next${query ? `?${query}` : ""}`, {
    headers: {
      "x-beta-key": key,
    },
  }).catch(() => null);

  if (!response) {
    setBetaStatus("Backend request failed", true);
    dateLabel.textContent = "Beta unavailable";
    return false;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    setBetaStatus(body.error || `Request failed (${response.status})`, true);
    dateLabel.textContent = response.status === 401 ? "Beta locked" : "Beta unavailable";
    return false;
  }

  const data = await response.json();
  currentPost = {
    id: data.post.id,
    text: data.post.text || "",
    isReal: Boolean(data.answer.is_real),
    detail: "Beta mode. Unlimited rounds.",
    source: data.post.url || null,
    media: data.post.media || null,
    displayName: "Donald J. Trump",
    handle: getPresentedHandle(data.post.author, Boolean(data.answer.is_real)),
    createdAt: data.post.created_at || null,
  };

  dateLabel.textContent = `Beta round · post #${currentPost.id}`;
  await renderPostPresentation(currentPost);
  disableControls(false);
  setBetaStatus("Unlocked");
  return true;
}

function submitGuess(userSaysReal) {
  if (!currentPost) {
    return;
  }

  const correct = userSaysReal === currentPost.isReal;
  const nextStreak = correct ? getStreak() + 1 : 0;
  setStreak(nextStreak);
  result.textContent = correct ? "Correct." : "Nope. Streak reset to 0.";
  result.style.color = correct ? "var(--real)" : "var(--fake)";

  renderPostDetails(details, currentPost.detail, currentPost.source);

  realBtn.disabled = true;
  fakeBtn.disabled = true;
}

async function renderPostPresentation(post) {
  if (shouldUseEmbeddedTweet(post)) {
    postText.textContent = post.text;
    postText.classList.toggle("hidden", !post.text);
    postMedia.classList.add("hidden");
    postMedia.innerHTML = "";
    xDisplayName.textContent = post.displayName || "Donald J. Trump";
    xHandle.textContent = post.handle || "@realDonaldTrump";
    xTime.textContent = formatPostTime(post.createdAt);
    xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
    await renderEmbeddedTweet(embedContainer, post.source);
    renderMetrics(post);
    return;
  }

  embedContainer.classList.add("hidden");
  embedContainer.innerHTML = "";
  postText.textContent = post.text;
  postText.classList.toggle("hidden", !post.text);
  renderMedia(postMedia, post.media);
  xDisplayName.textContent = post.displayName || "Donald J. Trump";
  xHandle.textContent = post.handle || "@realDonaldTrump";
  xTime.textContent = formatPostTime(post.createdAt);
  xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
  renderMetrics(post);
}

function renderMetrics(post) {
  renderFakeMetrics(
    {
      reply: xCountReply,
      repost: xCountRepost,
      like: xCountLike,
      view: xCountView,
    },
    String(post.id),
    post.text,
  );
}

function disableControls(disabled) {
  realBtn.disabled = disabled;
  fakeBtn.disabled = disabled;
  nextBtn.disabled = disabled;
}

function setBetaStatus(message, isError = false) {
  betaStatus.textContent = message;
  betaStatus.classList.toggle("error", isError);
}

function getStreak() {
  const rawValue = Number.parseInt(localStorage.getItem(STREAK_STORAGE_KEY) || "0", 10);
  return Number.isNaN(rawValue) || rawValue < 0 ? 0 : rawValue;
}

function setStreak(value) {
  const normalizedValue = Math.max(0, value);
  localStorage.setItem(STREAK_STORAGE_KEY, String(normalizedValue));
  updateStreakDisplay(normalizedValue);
}

function updateStreakDisplay(streak) {
  streakValue.textContent = String(Math.max(0, streak));
}

function openBetaOverlay(message, isError = false) {
  betaOverlay.classList.remove("hidden");
  betaKeyInput.focus();
  betaKeyInput.select();
  setBetaStatus(message, isError);
}

function closeBetaOverlay() {
  betaOverlay.classList.add("hidden");
}
