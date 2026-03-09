import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import db from "./db.js";
import {
  getUtcDayKey,
  hashToIndex,
  normalizeMedia,
  parseMedia,
  serializePost,
} from "./server-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const extensionApiKey = process.env.EXTENSION_API_KEY || "change-me";
const adminPageKey = process.env.ADMIN_PAGE_KEY || extensionApiKey;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Serve static files from the parent directory (frontend)
app.use(express.static(path.join(__dirname, "..")));

function todayKey() {
  return getUtcDayKey();
}

function assertExtensionAuth(req, res, next) {
  const key = req.header("x-extension-key");
  if (!key || key !== extensionApiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function assertAdminAuth(req, res, next) {
  const key = req.header("x-admin-key");
  if (!key || key !== adminPageKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/posts", assertExtensionAuth, (req, res) => {
  const {
    source = "x",
    post_id = null,
    text,
    url = null,
    author = null,
    media = null,
    is_real,
    created_at = null,
    status = "approved",
  } = req.body || {};

  const normalizedText = typeof text === "string" ? text.trim() : "";
  const normalizedMedia = normalizeMedia(media);

  if (!normalizedText && !normalizedMedia) {
    return res.status(400).json({ error: "text or media is required" });
  }

  if (typeof is_real !== "boolean") {
    return res.status(400).json({ error: "is_real must be boolean" });
  }

  const insert = db.prepare(`
    INSERT INTO posts (source, post_id, text, url, author, media_json, is_real, created_at, captured_at, status)
    VALUES (@source, @post_id, @text, @url, @author, @media_json, @is_real, @created_at, @captured_at, @status)
    ON CONFLICT(source, post_id) DO UPDATE SET
      text=excluded.text,
      url=excluded.url,
      author=excluded.author,
      media_json=excluded.media_json,
      is_real=excluded.is_real,
      created_at=excluded.created_at,
      captured_at=excluded.captured_at,
      status=excluded.status
  `);

  const capturedAt = new Date().toISOString();

  const info = insert.run({
    source,
    post_id,
    text: normalizedText,
    url,
    author,
    media_json: normalizedMedia ? JSON.stringify(normalizedMedia) : null,
    is_real: is_real ? 1 : 0,
    created_at,
    captured_at: capturedAt,
    status,
  });

  if (!info.changes) {
    return res.status(500).json({ error: "Unable to save post" });
  }

  return res.json({ ok: true });
});

app.get("/api/daily", (_req, res) => {
  const day = todayKey();

  const existing = db
    .prepare(
      `
      SELECT p.id, p.text, p.url, p.author, p.media_json, p.is_real, p.created_at
      FROM daily_posts d
      JOIN posts p ON p.id = d.post_db_id
      WHERE d.day = ?
    `,
    )
    .get(day);

  if (existing) {
    return res.json({
      day,
      post: {
        id: existing.id,
        text: existing.text,
        url: existing.url,
        author: existing.author,
        media: parseMedia(existing.media_json),
        created_at: existing.created_at,
      },
      answer: {
        is_real: Boolean(existing.is_real),
      },
    });
  }

  const all = db
    .prepare(
      `
      SELECT id, text, url, author, media_json, is_real, created_at
      FROM posts
      WHERE status = 'approved'
      ORDER BY id ASC
    `,
    )
    .all();

  if (!all.length) {
    return res.status(404).json({ error: "No approved posts in DB yet" });
  }

  const index = hashToIndex(day, all.length);
  const chosen = all[index];

  db.prepare(
    `INSERT INTO daily_posts (day, post_db_id, assigned_at) VALUES (?, ?, ?)`,
  ).run(day, chosen.id, new Date().toISOString());

  return res.json({
    day,
    post: serializePost(chosen),
    answer: {
      is_real: Boolean(chosen.is_real),
    },
  });
});

app.get("/api/admin/review", assertAdminAuth, (req, res) => {
  const afterId = Number.parseInt(req.query.after_id, 10);
  const hasAfterId = Number.isInteger(afterId) && afterId > 0;

  const nextPost = hasAfterId
    ? db
        .prepare(
          `
          SELECT id, text, url, author, media_json, is_real, created_at
          FROM posts
          WHERE status = 'approved' AND id > ?
          ORDER BY id ASC
          LIMIT 1
        `,
        )
        .get(afterId)
    : null;

  const fallback = nextPost || db
    .prepare(
      `
      SELECT id, text, url, author, media_json, is_real, created_at
      FROM posts
      WHERE status = 'approved'
      ORDER BY id ASC
      LIMIT 1
    `,
    )
    .get();

  if (!fallback) {
    return res.status(404).json({ error: "No approved posts in DB yet" });
  }

  return res.json({
    post: serializePost(fallback),
    answer: {
      is_real: Boolean(fallback.is_real),
    },
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${port}`);
});
