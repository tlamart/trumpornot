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

const dateLabel = document.getElementById("dateLabel");
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

nextBtn.addEventListener("click", () => loadPost(true));
realBtn.addEventListener("click", () => submitGuess(true));
fakeBtn.addEventListener("click", () => submitGuess(false));

loadPost(false);

async function loadPost(forceNext) {
  disableGuessing(true);
  result.textContent = "";
  details.textContent = "";
  dateLabel.textContent = "Loading beta round...";

  const params = new URLSearchParams();
  if (forceNext && currentPost && currentPost.id) {
    params.set("exclude_id", String(currentPost.id));
  }

  const query = params.toString();
  const response = await fetch(`${API_BASE}/api/beta/next${query ? `?${query}` : ""}`).catch(() => null);

  if (!response) {
    dateLabel.textContent = "Beta unavailable";
    details.textContent = "The beta route is protected or unreachable.";
    return;
  }

  if (!response.ok) {
    dateLabel.textContent = response.status === 401 ? "Beta locked" : "Beta unavailable";
    details.textContent = response.status === 401
      ? "Authentication failed for beta mode."
      : `Unable to load beta post (${response.status}).`;
    return;
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
    handle: data.post.author ? `@${data.post.author}` : "@realDonaldTrump",
    createdAt: data.post.created_at || null,
  };

  dateLabel.textContent = `Beta round · post #${currentPost.id}`;
  await renderPostPresentation(currentPost);
  disableGuessing(false);
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

function disableGuessing(disabled) {
  realBtn.disabled = disabled;
  fakeBtn.disabled = disabled;
}
