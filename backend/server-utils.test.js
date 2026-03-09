import test from "node:test";
import assert from "node:assert/strict";

import {
  getUtcDayKey,
  hashToIndex,
  normalizeMedia,
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

test("parseMedia returns null for invalid json", () => {
  assert.equal(parseMedia("{broken"), null);
});

test("serializePost parses media_json into the API shape", () => {
  const row = {
    id: 42,
    text: "hello",
    url: "https://example.com/post/42",
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
    url: "https://example.com/post/42",
    author: "realDonaldTrump",
    media: {
      images: [{ url: "https://example.com/a.jpg" }],
      video: null,
    },
    created_at: "2026-03-09T12:00:00.000Z",
  });
});
