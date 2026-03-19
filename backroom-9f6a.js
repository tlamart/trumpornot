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
const STORAGE_KEY = "adminPageKey";
const POSTS_PAGE_SIZE = 25;
const TAB_IDS = ["review", "posts", "generator"];

const adminOverlay = document.getElementById("adminOverlay");
const adminOverlayForm = document.getElementById("adminOverlayForm");
const adminKeyInput = document.getElementById("adminKey");
const saveAdminKeyBtn = document.getElementById("saveAdminKeyBtn");
const changeAdminKeyBtn = document.getElementById("changeAdminKeyBtn");
const adminStatus = document.getElementById("adminStatus");
const dateLabel = document.getElementById("dateLabel");

const reviewTabBtn = document.getElementById("reviewTabBtn");
const postsTabBtn = document.getElementById("postsTabBtn");
const generatorTabBtn = document.getElementById("generatorTabBtn");
const reviewTabPanel = document.getElementById("reviewTabPanel");
const postsTabPanel = document.getElementById("postsTabPanel");
const generatorTabPanel = document.getElementById("generatorTabPanel");

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

const postsSummary = document.getElementById("postsSummary");
const postsTableBody = document.getElementById("postsTableBody");
const refreshPostsBtn = document.getElementById("refreshPostsBtn");
const prevPostsBtn = document.getElementById("prevPostsBtn");
const nextPostsBtn = document.getElementById("nextPostsBtn");

const fakeTopicInput = document.getElementById("fakeTopicInput");
const fakeToneSelect = document.getElementById("fakeToneSelect");
const fakePostInput = document.getElementById("fakePostInput");
const generateFakeBtn = document.getElementById("generateFakeBtn");
const saveFakeBtn = document.getElementById("saveFakeBtn");
const generatorStatus = document.getElementById("generatorStatus");
const generatorText = document.getElementById("generatorText");
const generatorTime = document.getElementById("generatorTime");

const tabs = {
  review: { button: reviewTabBtn, panel: reviewTabPanel, label: "Archive review" },
  posts: { button: postsTabBtn, panel: postsTabPanel, label: "Posts list" },
  generator: { button: generatorTabBtn, panel: generatorTabPanel, label: "Fake generator" },
};

const OPENERS = {
  boast: [
    "The numbers on {topic} are INCREDIBLE.",
    "Just saw the latest on {topic}. TOTAL WIN.",
    "Nobody understands {topic} better than me.",
  ],
  attack: [
    "The Radical Left is lying about {topic} again.",
    "They have totally lost control of {topic}. Sad!",
    "Another disaster on {topic} from the people who never learn.",
  ],
  victory: [
    "We are dominating on {topic} like never before.",
    "Big victory today on {topic}, bigger than anyone expected.",
    "Our movement keeps winning on {topic}.",
  ],
};
const MIDDLES = [
  "The people know the truth.",
  "Every poll I see is stronger than ever.",
  "This is why America is coming back FAST.",
  "It is all happening much sooner than the fake news thought.",
];
const CLOSERS = [
  "MAKE AMERICA GREAT AGAIN!",
  "Thank you!",
  "November cannot come soon enough.",
  "We will never stop fighting for our Country!",
];

let currentPost = null;
let activeTab = "review";
let postsOffset = 0;
let currentListItems = [];

adminOverlayForm.addEventListener("submit", saveAdminKey);
changeAdminKeyBtn.addEventListener("click", () => {
  openAdminOverlay("Update the admin key to continue.", false);
});
nextBtn.addEventListener("click", () => loadReviewPost(true));
realBtn.addEventListener("click", () => submitGuess(true));
fakeBtn.addEventListener("click", () => submitGuess(false));
refreshPostsBtn.addEventListener("click", () => loadPostsList(postsOffset));
prevPostsBtn.addEventListener("click", () => loadPostsList(Math.max(0, postsOffset - POSTS_PAGE_SIZE)));
nextPostsBtn.addEventListener("click", () => loadPostsList(postsOffset + POSTS_PAGE_SIZE));
postsTableBody.addEventListener("click", handlePostsTableAction);
generateFakeBtn.addEventListener("click", generateFakeDraft);
saveFakeBtn.addEventListener("click", saveGeneratedFake);
fakePostInput.addEventListener("input", syncFakeDraftPreview);

TAB_IDS.forEach((tabId) => {
  tabs[tabId].button.addEventListener("click", () => activateTab(tabId));
});

init();

async function init() {
  disableGuessing(true);
  saveFakeBtn.disabled = true;
  generatorTime.textContent = formatPostTime(new Date().toISOString());
  syncFakeDraftPreview();
  const savedKey = sessionStorage.getItem(STORAGE_KEY) || "";
  if (savedKey) {
    adminKeyInput.value = savedKey;
    const unlocked = await unlockAdmin(savedKey);
    if (unlocked) {
      closeAdminOverlay();
      return;
    }
  } else {
    dateLabel.textContent = "Admin tools locked";
  }

  openAdminOverlay("Enter the admin key to unlock admin tools.", true);
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

  const unlocked = await unlockAdmin(key);
  if (unlocked) {
    sessionStorage.setItem(STORAGE_KEY, key);
    closeAdminOverlay();
  }

  saveAdminKeyBtn.disabled = false;
}

async function unlockAdmin(key) {
  const unlocked = await loadReviewPost(false, key);
  if (!unlocked) {
    return false;
  }

  await loadPostsList(0, key);
  setAdminStatus("Unlocked");
  updateDateLabel();
  return true;
}

function activateTab(tabId) {
  activeTab = tabId;
  TAB_IDS.forEach((id) => {
    const isActive = id === tabId;
    tabs[id].button.classList.toggle("is-active", isActive);
    tabs[id].button.setAttribute("aria-selected", String(isActive));
    tabs[id].panel.classList.toggle("hidden", !isActive);
  });
  updateDateLabel();
}

function getAdminKey(overrideKey = null) {
  return overrideKey || sessionStorage.getItem(STORAGE_KEY) || adminKeyInput.value.trim();
}

async function adminFetch(path, options = {}, overrideKey = null) {
  const key = getAdminKey(overrideKey);
  if (!key) {
    setAdminStatus("Admin key required", true);
    return null;
  }

  const headers = {
    "x-admin-key": key,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  }).catch(() => null);
}

async function loadReviewPost(loadNextPost, overrideKey = null) {
  disableGuessing(true);
  result.textContent = "";
  details.textContent = "";
  dateLabel.textContent = "Loading review post...";

  const params = new URLSearchParams();
  if (loadNextPost && currentPost && currentPost.id) {
    params.set("after_id", String(currentPost.id));
  }

  const query = params.toString();
  const response = await adminFetch(`/api/admin/review${query ? `?${query}` : ""}`, {}, overrideKey);

  if (!response) {
    setAdminStatus("Backend request failed", true);
    updateDateLabel("Review unavailable");
    return false;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    setAdminStatus(body.error || `Request failed (${response.status})`, true);
    updateDateLabel("Review unavailable");
    return false;
  }

  const data = await response.json();
  currentPost = {
    id: data.post.id,
    text: data.post.text || "",
    isReal: Boolean(data.answer.is_real),
    source: data.post.url || null,
    media: data.post.media || null,
    handle: getPresentedHandle(data.post.author, Boolean(data.answer.is_real)),
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

  updateDateLabel(`Review post #${currentPost.id}`);
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
    xDisplayName.textContent = post.displayName;
    xHandle.textContent = post.handle;
    xTime.textContent = formatPostTime(post.createdAt);
    xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
    await renderEmbeddedTweet(embedContainer, post.source);
    return;
  }

  embedContainer.classList.add("hidden");
  embedContainer.innerHTML = "";
  postText.textContent = post.text;
  postText.classList.toggle("hidden", !post.text);
  renderMedia(postMedia, post.media);
  xDisplayName.textContent = post.displayName;
  xHandle.textContent = post.handle;
  xTime.textContent = formatPostTime(post.createdAt);
  xVerified.classList.toggle("hidden", !isVerifiedHandle(xHandle.textContent));
}

function submitGuess(userSaysReal) {
  if (!currentPost) {
    return;
  }

  const correct = userSaysReal === currentPost.isReal;
  void reportGuess({
    mode: "admin",
    postId: currentPost.id,
    guessIsReal: userSaysReal,
    answerIsReal: currentPost.isReal,
  });
  result.textContent = correct ? "Correct." : "Nope.";
  result.style.color = correct ? "var(--real)" : "var(--fake)";
  renderPostDetails(details, currentPost.detail, currentPost.source);
  disableGuessing(true);
}

async function reportGuess({
  mode,
  postId = null,
  guessIsReal,
  answerIsReal,
}) {
  try {
    await fetch(`${API_BASE}/api/guesses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({
        mode,
        post_id: postId,
        guess_is_real: guessIsReal,
        answer_is_real: answerIsReal,
      }),
    });
  } catch (_error) {
    // Guess reporting should not block the review UI.
  }
}

async function loadPostsList(offset, overrideKey = null) {
  postsSummary.textContent = "Loading posts...";
  postsTableBody.innerHTML = `
    <tr>
      <td colspan="5" class="admin-table-empty">Loading...</td>
    </tr>
  `;

  const response = await adminFetch(
    `/api/admin/posts?limit=${POSTS_PAGE_SIZE}&offset=${offset}`,
    {},
    overrideKey,
  );

  if (!response) {
    postsSummary.textContent = "Posts unavailable";
    prevPostsBtn.disabled = true;
    nextPostsBtn.disabled = true;
    currentListItems = [];
    postsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="admin-table-empty">Backend request failed.</td>
      </tr>
    `;
    return false;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    setAdminStatus(body.error || `Request failed (${response.status})`, true);
    postsSummary.textContent = "Posts unavailable";
    prevPostsBtn.disabled = true;
    nextPostsBtn.disabled = true;
    currentListItems = [];
    postsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="admin-table-empty">Unable to load posts.</td>
      </tr>
    `;
    return false;
  }

  const data = await response.json();
  currentListItems = data.items;
  postsOffset = data.pagination.offset;
  postsSummary.textContent = `Showing ${postsOffset + 1}-${postsOffset + data.items.length} of ${data.pagination.total} posts`;
  prevPostsBtn.disabled = postsOffset === 0;
  nextPostsBtn.disabled = !data.pagination.has_more;

  if (!data.items.length) {
    postsSummary.textContent = "No posts in archive yet.";
    postsTableBody.innerHTML = `
      <tr>
        <td colspan="6" class="admin-table-empty">No posts in archive yet.</td>
      </tr>
    `;
    return true;
  }

  postsTableBody.innerHTML = data.items.map((item) => `
    <tr>
      <td>#${item.id}</td>
      <td>${item.is_real ? "Real" : "Fake"}</td>
      <td>${escapeHtml(item.status)}</td>
      <td>${escapeHtml(formatListDate(item.created_at || item.captured_at))}</td>
      <td class="admin-table-text">${escapeHtml(truncate(item.text || "[media-only]", 140))}</td>
      <td>
        <div class="admin-row-actions">
          <button class="btn admin-ghost-btn admin-inline-btn" type="button" data-action="review-post" data-post-id="${item.id}">Review</button>
          <button class="btn admin-ghost-btn admin-inline-btn" type="button" data-action="set-status" data-status="approved" data-post-id="${item.id}" ${item.status === "approved" ? "disabled" : ""}>Approve</button>
          <button class="btn admin-ghost-btn admin-inline-btn" type="button" data-action="set-status" data-status="rejected" data-post-id="${item.id}" ${item.status === "rejected" ? "disabled" : ""}>Reject</button>
        </div>
      </td>
    </tr>
  `).join("");

  return true;
}

async function handlePostsTableAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const postId = Number.parseInt(button.dataset.postId, 10);
  if (!Number.isInteger(postId)) {
    return;
  }

  if (button.dataset.action === "review-post") {
    reviewPostFromList(postId);
    return;
  }

  if (button.dataset.action === "set-status") {
    await updatePostStatus(postId, button.dataset.status, button);
  }
}

function reviewPostFromList(postId) {
  const item = currentListItems.find((entry) => entry.id === postId);
  if (!item) {
    setAdminStatus("Post not found in current list.", true);
    return;
  }

  currentPost = {
    id: item.id,
    text: item.text || "",
    isReal: Boolean(item.is_real),
    source: item.url || null,
    media: item.media || null,
    handle: getPresentedHandle(item.author, Boolean(item.is_real)),
    createdAt: item.created_at || item.captured_at || null,
    detail: `List review. Status: ${item.status}. Source: ${item.source}.`,
    displayName: "Donald J. Trump",
  };

  result.textContent = "";
  details.textContent = "";
  renderCurrentPost();
  activateTab("review");
}

async function updatePostStatus(postId, status, button) {
  if (!status) {
    return;
  }

  button.disabled = true;
  setAdminStatus(`Updating post #${postId}...`, false);

  const response = await adminFetch(`/api/admin/posts/${postId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });

  if (!response) {
    setAdminStatus("Backend request failed", true);
    button.disabled = false;
    return;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    setAdminStatus(body.error || `Request failed (${response.status})`, true);
    button.disabled = false;
    return;
  }

  const data = await response.json();
  currentListItems = currentListItems.map((item) => item.id === postId ? { ...item, status: data.post.status } : item);
  if (currentPost && currentPost.id === postId) {
    currentPost.detail = `List review. Status: ${data.post.status}. Source: ${data.post.source}.`;
  }
  setAdminStatus(`Post #${postId} marked ${data.post.status}.`, false);
  await loadPostsList(postsOffset);
}

function generateFakeDraft() {
  const topic = (fakeTopicInput.value.trim() || "America").replace(/\s+/g, " ");
  const tone = fakeToneSelect.value in OPENERS ? fakeToneSelect.value : "boast";
  const opener = pickRandom(OPENERS[tone]).replaceAll("{topic}", topic.toUpperCase());
  const middle = pickRandom(MIDDLES);
  const closer = pickRandom(CLOSERS);
  fakePostInput.value = `${opener} ${middle} ${closer}`.trim();
  syncFakeDraftPreview();
  setGeneratorStatus("Draft generated.", false);
}

async function saveGeneratedFake() {
  const fakeText = fakePostInput.value.trim();

  if (!fakeText) {
    setGeneratorStatus("Write a post first.", true);
    return;
  }

  saveFakeBtn.disabled = true;
  setGeneratorStatus("Saving fake post...", false);

  const response = await adminFetch("/api/admin/fakes", {
    method: "POST",
    body: JSON.stringify({
      text: fakeText,
      author: "realDonaldTrump",
      created_at: new Date().toISOString(),
      status: "approved",
    }),
  });

  if (!response) {
    setGeneratorStatus("Backend request failed.", true);
    saveFakeBtn.disabled = false;
    return;
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    setGeneratorStatus(body.error || `Request failed (${response.status})`, true);
    saveFakeBtn.disabled = false;
    return;
  }

  const data = await response.json();
  setGeneratorStatus(`Saved fake post #${data.post.id}.`, false);
  await loadPostsList(0);
  syncFakeDraftPreview();
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

function setGeneratorStatus(message, isError = false) {
  generatorStatus.textContent = message;
  generatorStatus.classList.toggle("error", isError);
}

function syncFakeDraftPreview() {
  const value = fakePostInput.value.trim();
  generatorText.textContent = value || "Write a fake post draft here.";
  generatorTime.textContent = formatPostTime(new Date().toISOString());
  saveFakeBtn.disabled = !value;
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

function updateDateLabel(override = null) {
  dateLabel.textContent = override || tabs[activeTab].label;
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

function formatListDate(value) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
