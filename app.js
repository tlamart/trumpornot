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

const {
  formatPostTime,
  getApiBase,
  getUtcDayKey,
  hashToIndex,
  isVerifiedHandle,
  renderEmbeddedTweet,
  renderFakeMetrics,
  renderMedia,
  renderPostDetails,
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

async function render() {
  const fallbackDayKey = getUtcDayKey();
  const daily = await getDailyPost(fallbackDayKey);
  const todayKey = daily.day;
  const todayPost = daily.post;
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

  renderPostDetails(
    details,
    post.detail,
    post.source,
    fromStorage ? "You already guessed today." : "",
  );

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
      day: data.day || todayKey,
      post: {
        text: data.post.text,
        isReal: Boolean(data.answer.is_real),
        detail: "From your curated database.",
        source: data.post.url || null,
        media: data.post.media || null,
        displayName: "Donald J. Trump",
        handle: data.post.author ? `@${data.post.author}` : "@realDonaldTrump",
        createdAt: data.post.created_at || null,
      },
    };
  } catch (_error) {
    const index = hashToIndex(todayKey, posts.length);
    return {
      day: todayKey,
      post: {
        ...posts[index],
        media: null,
        displayName: "Donald J. Trump",
        handle: "@realDonaldTrump",
        createdAt: null,
      },
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
    await renderEmbeddedTweet(embedContainer, post.source);
    renderFakeMetrics(
      {
        reply: xCountReply,
        repost: xCountRepost,
        like: xCountLike,
        view: xCountView,
      },
      metricSeed,
      post.text,
    );
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
  renderFakeMetrics(
    {
      reply: xCountReply,
      repost: xCountRepost,
      like: xCountLike,
      view: xCountView,
    },
    metricSeed,
    post.text,
  );
}
