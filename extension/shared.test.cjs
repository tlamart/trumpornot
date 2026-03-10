const test = require("node:test");
const assert = require("node:assert/strict");

const {
  dedupeBy,
  extractMedia,
  extractPost,
  getFetchErrorMessage,
  getApiOriginPermissionPattern,
  isSupportedApiUrl,
  normalizeApiBase,
  normalizeVideoUrl,
} = require("./shared.js");

function createMockArticle({
  href = "/realDonaldTrump/status/123",
  text = "Test post",
  imageUrls = [],
  video = null,
  datetime = "2026-03-09T12:00:00.000Z",
} = {}) {
  return {
    querySelector(selector) {
      if (selector === 'a[href*="/status/"]') {
        return href ? { getAttribute: () => href } : null;
      }
      if (selector === '[data-testid="tweetText"]') {
        return text ? { innerText: text } : null;
      }
      if (selector === "time") {
        return datetime ? { getAttribute: () => datetime } : null;
      }
      if (selector === "video") {
        return video
          ? {
              currentSrc: video.currentSrc || "",
              getAttribute(name) {
                return video[name] || null;
              },
            }
          : null;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === 'img[src*="pbs.twimg.com/media"]') {
        return imageUrls.map((url) => ({
          getAttribute(name) {
            return name === "src" ? url : null;
          },
        }));
      }
      return [];
    },
  };
}

test("normalizeApiBase trims whitespace and trailing slashes", () => {
  assert.equal(normalizeApiBase(" https://api.example.com/// "), "https://api.example.com");
});

test("isSupportedApiUrl accepts deployed https urls", () => {
  assert.equal(isSupportedApiUrl("https://trumpornot.tlam.art"), true);
  assert.equal(isSupportedApiUrl("http://localhost:3000"), true);
  assert.equal(isSupportedApiUrl("http://127.0.0.1:3000"), true);
  assert.equal(isSupportedApiUrl("http://example.com"), false);
  assert.equal(isSupportedApiUrl("ftp://example.com"), false);
});

test("getApiOriginPermissionPattern narrows to the configured origin", () => {
  assert.equal(
    getApiOriginPermissionPattern("https://trumpornot.tlam.art/api"),
    "https://trumpornot.tlam.art/*",
  );
  assert.equal(
    getApiOriginPermissionPattern("http://localhost:3000"),
    "http://localhost/*",
  );
  assert.equal(getApiOriginPermissionPattern("http://example.com"), null);
});

test("normalizeVideoUrl keeps direct media files and rejects blob urls", () => {
  assert.equal(normalizeVideoUrl("https://video.example.com/test.mp4"), "https://video.example.com/test.mp4");
  assert.equal(normalizeVideoUrl("blob:https://x.com/123"), null);
});

test("dedupeBy removes duplicate keys", () => {
  const result = dedupeBy(
    [{ url: "a" }, { url: "a" }, { url: "b" }],
    (item) => item.url,
  );
  assert.deepEqual(result, [{ url: "a" }, { url: "b" }]);
});

test("extractMedia keeps unique images and normalized video data", () => {
  const media = extractMedia(createMockArticle({
    imageUrls: [
      "https://pbs.twimg.com/media/a.jpg",
      "https://pbs.twimg.com/media/a.jpg",
      "https://pbs.twimg.com/media/b.jpg",
    ],
    video: {
      currentSrc: "https://video.example.com/video.mp4",
      poster: "https://video.example.com/poster.jpg",
    },
  }));

  assert.deepEqual(media, {
    images: [
      { url: "https://pbs.twimg.com/media/a.jpg" },
      { url: "https://pbs.twimg.com/media/b.jpg" },
    ],
    video: {
      url: "https://video.example.com/video.mp4",
      posterUrl: "https://video.example.com/poster.jpg",
    },
  });
});

test("extractPost returns normalized post payload", () => {
  const post = extractPost(createMockArticle({
    text: "HELLO",
    imageUrls: ["https://pbs.twimg.com/media/a.jpg"],
  }));

  assert.deepEqual(post, {
    id: "123",
    author: "realDonaldTrump",
    text: "HELLO",
    url: "https://x.com/realDonaldTrump/status/123",
    media: {
      images: [{ url: "https://pbs.twimg.com/media/a.jpg" }],
      video: null,
    },
    createdAt: "2026-03-09T12:00:00.000Z",
  });
});

test("getFetchErrorMessage explains invalid and failed requests", () => {
  assert.equal(getFetchErrorMessage(new Error("Failed to fetch"), "bad-url"), "Bad API URL");
  assert.equal(
    getFetchErrorMessage(new Error("Failed to fetch"), "http://example.com"),
    "Use HTTPS or localhost over HTTP",
  );
  assert.equal(
    getFetchErrorMessage(new Error("Failed to fetch"), "https://api.example.com"),
    "Request blocked or failed",
  );
});
