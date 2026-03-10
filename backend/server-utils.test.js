import test from "node:test";
import assert from "node:assert/strict";

import {
  getUtcDayKey,
  hashToIndex,
  normalizeAuthor,
  normalizeMedia,
  normalizePostId,
  normalizePostUrl,
  normalizeSource,
  normalizeStatus,
  normalizeTimestamp,
  parseMedia,
  serializePost,
} from "./server-utils.js";

test("getUtcDayKey uses UTC rather than local timezone", () => {
  const date = new Date("2026-03-09T23:30:00-08:00");
  assert.equal(getUtcDayKey(date), "2026-03-10");
});

test("hashToIndex is deterministic and stays within bounds", () => {
  const first = hashToIndex("2026-03-09", 8);
  const second = hashToIndex("2026-03-09", 8);

  assert.equal(first, second);
  assert.ok(first >= 0);
  assert.ok(first < 8);
});

test("normalizeMedia drops invalid entries and keeps valid media", () => {
  const media = normalizeMedia({
    images: [
      { url: "https://example.com/a.jpg" },
      null,
      { foo: "bar" },
    ],
    video: {
      url: "https://example.com/video.mp4",
      posterUrl: "https://example.com/poster.jpg",
    },
  });

  assert.deepEqual(media, {
    images: [{ url: "https://example.com/a.jpg" }],
    video: {
      url: "https://example.com/video.mp4",
      posterUrl: "https://example.com/poster.jpg",
    },
  });
});

test("normalizeMedia returns null when nothing usable is present", () => {
  assert.equal(normalizeMedia(null), null);
  assert.equal(normalizeMedia({ images: [{ foo: "bar" }] }), null);
  assert.equal(normalizeMedia({ video: {} }), null);
});

test("normalizers reject unsupported sources and unsafe urls", () => {
  assert.equal(normalizeSource("x"), "x");
  assert.equal(normalizeSource("truthsocial"), "truthsocial");
  assert.equal(normalizeSource("rss"), null);
  assert.equal(normalizeStatus("approved"), "approved");
  assert.equal(normalizeStatus("deleted"), null);
  assert.equal(normalizePostId("123456"), "123456");
  assert.equal(normalizePostId("abc"), null);
  assert.equal(normalizeAuthor("realDonaldTrump"), "realDonaldTrump");
  assert.equal(normalizeAuthor("bad handle"), null);
  assert.equal(
    normalizePostUrl("https://x.com/realDonaldTrump/status/1234567890"),
    "https://x.com/realDonaldTrump/status/1234567890",
  );
  assert.equal(
    normalizePostUrl("https://truthsocial.com/@realDonaldTrump/posts/1234567890"),
    "https://truthsocial.com/@realDonaldTrump/posts/1234567890",
  );
  assert.equal(normalizePostUrl("javascript:alert(1)"), null);
  assert.equal(normalizeTimestamp("2026-03-09T12:00:00.000Z"), "2026-03-09T12:00:00.000Z");
  assert.equal(normalizeTimestamp("not-a-date"), null);
});

test("parseMedia returns null for invalid json", () => {
  assert.equal(parseMedia("{broken"), null);
});

test("parseMedia strips unsafe media urls from stored json", () => {
  assert.deepEqual(
    parseMedia(JSON.stringify({
      images: [{ url: "javascript:alert(1)" }, { url: "https://example.com/a.jpg" }],
      video: {
        url: "https://example.com/video.mp4",
        posterUrl: "data:text/html,boom",
      },
    })),
    {
      images: [{ url: "https://example.com/a.jpg" }],
      video: {
        url: "https://example.com/video.mp4",
        posterUrl: null,
      },
    },
  );
});

test("serializePost parses media_json into the API shape", () => {
  const row = {
    id: 42,
    text: "hello",
    url: "https://x.com/realDonaldTrump/status/42",
    author: "realDonaldTrump",
    media_json: JSON.stringify({
      images: [{ url: "https://example.com/a.jpg" }],
      video: null,
    }),
    created_at: "2026-03-09T12:00:00.000Z",
  };

  assert.deepEqual(serializePost(row), {
    id: 42,
    text: "hello",
    url: "https://x.com/realDonaldTrump/status/42",
    author: "realDonaldTrump",
    media: {
      images: [{ url: "https://example.com/a.jpg" }],
      video: null,
    },
    created_at: "2026-03-09T12:00:00.000Z",
  });
});

test("serializePost preserves supported truth social post urls", () => {
  const row = {
    id: 88,
    text: "hello",
    url: "https://truthsocial.com/@realDonaldTrump/posts/88",
    author: "realDonaldTrump",
    media_json: null,
    created_at: "2026-03-09T12:00:00.000Z",
  };

  assert.deepEqual(serializePost(row), {
    id: 88,
    text: "hello",
    url: "https://truthsocial.com/@realDonaldTrump/posts/88",
    author: "realDonaldTrump",
    media: null,
    created_at: "2026-03-09T12:00:00.000Z",
  });
});

test("serializePost drops unsafe legacy row values", () => {
  const row = {
    id: 7,
    text: "legacy",
    url: "javascript:alert(1)",
    author: "bad handle",
    media_json: JSON.stringify({
      images: [{ url: "https://example.com/a.jpg" }, { url: "javascript:alert(1)" }],
    }),
    created_at: "not-a-date",
  };

  assert.deepEqual(serializePost(row), {
    id: 7,
    text: "legacy",
    url: null,
    author: null,
    media: {
      images: [{ url: "https://example.com/a.jpg" }],
      video: null,
    },
    created_at: null,
  });
});
