const test = require("node:test");
const assert = require("node:assert/strict");

const {
  dedupeBy,
  extractMedia,
  extractPost,
  getSiteKind,
  getFetchErrorMessage,
  getApiOriginPermissionPattern,
  parseTruthSocialPostUrl,
  isSupportedApiUrl,
  normalizeApiBase,
  normalizeTruthSocialMedia,
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

test("extractPost returns normalized x post payload", async () => {
  const post = await extractPost(createMockArticle({
    text: "HELLO",
    imageUrls: ["https://pbs.twimg.com/media/a.jpg"],
  }), { siteKind: "x" });

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

test("getSiteKind detects supported hosts", () => {
  assert.equal(getSiteKind("x.com"), "x");
  assert.equal(getSiteKind("truthsocial.com"), "truthsocial");
  assert.equal(getSiteKind("example.com"), null);
});

test("parseTruthSocialPostUrl parses truthsocial permalinks", () => {
  assert.deepEqual(
    parseTruthSocialPostUrl("https://truthsocial.com/@realDonaldTrump/posts/1234567890"),
    {
      author: "realDonaldTrump",
      id: "1234567890",
      url: "https://truthsocial.com/@realDonaldTrump/posts/1234567890",
      apiUrl: "https://truthsocial.com/api/v1/statuses/1234567890",
    },
  );
  assert.equal(parseTruthSocialPostUrl("https://truthsocial.com/explore"), null);
});

test("normalizeTruthSocialMedia keeps image and video attachments", () => {
  assert.deepEqual(
    normalizeTruthSocialMedia([
      { type: "image", url: "https://files.truthsocial.com/a.jpg" },
      { type: "video", url: "https://files.truthsocial.com/b.mp4", preview_url: "https://files.truthsocial.com/b.jpg" },
    ]),
    {
      images: [{ url: "https://files.truthsocial.com/a.jpg" }],
      video: {
        url: "https://files.truthsocial.com/b.mp4",
        posterUrl: "https://files.truthsocial.com/b.jpg",
      },
    },
  );
});

test("extractPost fetches truth social post details from the status api", async () => {
  const fetchCalls = [];
  const post = await extractPost(null, {
    siteKind: "truthsocial",
    locationObj: { href: "https://truthsocial.com/@realDonaldTrump/posts/555", hostname: "truthsocial.com" },
    fetchImpl: async (url) => {
      fetchCalls.push(url);
      return {
        ok: true,
        async json() {
          return {
            content: "<p>Hello <strong>world</strong></p>",
            created_at: "2026-03-09T12:00:00.000Z",
            account: { acct: "realDonaldTrump" },
            media_attachments: [
              { type: "image", url: "https://files.truthsocial.com/a.jpg" },
            ],
          };
        },
      };
    },
  });

  assert.deepEqual(fetchCalls, ["https://truthsocial.com/api/v1/statuses/555"]);
  assert.deepEqual(post, {
    id: "555",
    author: "realDonaldTrump",
    text: "Hello world",
    url: "https://truthsocial.com/@realDonaldTrump/posts/555",
    media: {
      images: [{ url: "https://files.truthsocial.com/a.jpg" }],
      video: null,
    },
    createdAt: "2026-03-09T12:00:00.000Z",
  });
});

test("extractPost accepts a direct truth social post url override", async () => {
  const fetchCalls = [];
  const post = await extractPost({ postUrl: "https://truthsocial.com/@realDonaldTrump/posts/777" }, {
    siteKind: "truthsocial",
    locationObj: { href: "https://truthsocial.com/@realDonaldTrump", hostname: "truthsocial.com" },
    fetchImpl: async (url) => {
      fetchCalls.push(url);
      return {
        ok: true,
        async json() {
          return {
            content: "<p>Direct url</p>",
            created_at: "2026-03-09T12:00:00.000Z",
            account: { acct: "realDonaldTrump" },
            media_attachments: [],
          };
        },
      };
    },
  });

  assert.deepEqual(fetchCalls, ["https://truthsocial.com/api/v1/statuses/777"]);
  assert.equal(post.url, "https://truthsocial.com/@realDonaldTrump/posts/777");
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
