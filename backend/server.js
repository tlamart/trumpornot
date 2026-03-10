import express from "express";
import path from "path";
import { timingSafeEqual } from "crypto";
import { fileURLToPath } from "url";
import db from "./db.js";
import {
  getUtcDayKey,
  normalizeAuthor,
  hashToIndex,
  normalizeMedia,
  normalizePostId,
  normalizePostUrl,
  normalizeSource,
  normalizeStatus,
  normalizeTimestamp,
  parseMedia,
  serializePost,
} from "./server-utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
const projectRoot = path.join(__dirname, "..");
const extensionApiKey = requireApiKey("EXTENSION_API_KEY", process.env.EXTENSION_API_KEY);
const adminPageKey = process.env.ADMIN_PAGE_KEY
  ? requireApiKey("ADMIN_PAGE_KEY", process.env.ADMIN_PAGE_KEY)
  : extensionApiKey;
const betaPageKey = process.env.BETA_PAGE_KEY
  ? requireApiKey("BETA_PAGE_KEY", process.env.BETA_PAGE_KEY)
  : adminPageKey;
const allowedOrigins = getAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);
const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "img-src 'self' data: https:",
    "media-src 'self' https:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "script-src 'self' https://platform.twitter.com https://syndication.twitter.com https://cdn.syndication.twimg.com",
    "frame-src https://platform.twitter.com https://syndication.twitter.com",
    "connect-src 'self' https://platform.twitter.com https://syndication.twitter.com https://cdn.syndication.twimg.com",
  ].join("; "),
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Referrer-Policy": "same-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

app.disable("x-powered-by");

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
    res.setHeader(header, value);
  });

  const origin = req.header("origin");
  if (!origin) {
    return next();
  }

  if (!isAllowedOrigin(origin, req.header("host"))) {
    return res.status(403).json({ error: "Origin not allowed" });
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, x-extension-key, x-admin-key, x-beta-key",
  );
  res.setHeader("Access-Control-Max-Age", "600");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});

const STATIC_ASSET_ROUTES = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/beta", "beta.html"],
  ["/beta.html", "beta.html"],
  ["/backroom-9f6a.html", "backroom-9f6a.html"],
  ["/styles.css", "styles.css"],
  ["/client-common.js", "client-common.js"],
  ["/app.js", "app.js"],
  ["/beta.js", "beta.js"],
  ["/backroom-9f6a.js", "backroom-9f6a.js"],
  ["/trump.jpg", "trump.jpg"],
]);

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return next();
  }

  const asset = STATIC_ASSET_ROUTES.get(req.path);
  if (!asset) {
    return next();
  }

  return res.sendFile(path.join(projectRoot, asset));
});

function todayKey() {
  return getUtcDayKey();
}

function requireApiKey(name, value) {
  if (typeof value !== "string") {
    throw new Error(`${name} must be set`);
  }

  const normalized = value.trim();
  if (normalized.length < 16 || normalized.toLowerCase() === "change-me") {
    throw new Error(`${name} must be at least 16 characters and not use the default placeholder`);
  }

  return normalized;
}

function getAllowedOrigins(value) {
  const defaults = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "https://x.com",
    "https://www.x.com",
  ];
  const configured = typeof value === "string"
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];

  return new Set((configured.length ? configured : defaults).map(normalizeOrigin).filter(Boolean));
}

function normalizeOrigin(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return `${url.protocol}//${url.host}`;
  } catch (_error) {
    return null;
  }
}

function isAllowedOrigin(origin, requestHost) {
  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  const originUrl = new URL(normalizedOrigin);
  const sameHost = typeof requestHost === "string"
    && originUrl.host.toLowerCase() === requestHost.toLowerCase();

  return sameHost || allowedOrigins.has(normalizedOrigin);
}

function matchesSecret(candidate, secret) {
  if (typeof candidate !== "string") {
    return false;
  }

  const left = Buffer.from(candidate.trim());
  const right = Buffer.from(secret);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

function assertExtensionAuth(req, res, next) {
  const key = req.header("x-extension-key");
  if (!matchesSecret(key, extensionApiKey)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function assertAdminAuth(req, res, next) {
  const key = req.header("x-admin-key");
  if (!matchesSecret(key, adminPageKey)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function assertBetaAuth(req, res, next) {
  const key = req.header("x-beta-key");
  if (!matchesSecret(key, betaPageKey)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  return next();
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return fallback;
  }

  return Math.min(parsed, max);
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/beta", (_req, res) => {
  res.sendFile(path.join(projectRoot, "beta.html"));
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
  const normalizedSource = normalizeSource(source);
  const normalizedPostId = normalizePostId(post_id);
  const normalizedAuthor = normalizeAuthor(author);
  const normalizedUrl = normalizePostUrl(url);
  const normalizedCreatedAt = normalizeTimestamp(created_at);
  const normalizedMedia = normalizeMedia(media);
  const normalizedStatus = normalizeStatus(status);

  if (!normalizedSource) {
    return res.status(400).json({ error: "Unsupported source" });
  }

  if (!normalizedPostId) {
    return res.status(400).json({ error: "post_id must be a numeric string" });
  }

  if (author != null && !normalizedAuthor) {
    return res.status(400).json({ error: "author must be a valid handle" });
  }

  if (url != null && !normalizedUrl) {
    return res.status(400).json({ error: "url must be a valid https x.com status URL" });
  }

  if (created_at != null && !normalizedCreatedAt) {
    return res.status(400).json({ error: "created_at must be a valid timestamp" });
  }

  if (!normalizedStatus) {
    return res.status(400).json({ error: "Unsupported status" });
  }

  if (!normalizedText && !normalizedMedia) {
    return res.status(400).json({ error: "text or media is required" });
  }

  if (normalizedText.length > 5000) {
    return res.status(400).json({ error: "text is too long" });
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
    source: normalizedSource,
    post_id: normalizedPostId,
    text: normalizedText,
    url: normalizedUrl,
    author: normalizedAuthor,
    media_json: normalizedMedia ? JSON.stringify(normalizedMedia) : null,
    is_real: is_real ? 1 : 0,
    created_at: normalizedCreatedAt,
    captured_at: capturedAt,
    status: normalizedStatus,
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

app.get("/api/beta/next", assertBetaAuth, (req, res) => {
  const excludedId = Number.parseInt(req.query.exclude_id, 10);
  const hasExcludedId = Number.isInteger(excludedId) && excludedId > 0;

  const randomPost = hasExcludedId
    ? db
        .prepare(
          `
          SELECT id, text, url, author, media_json, is_real, created_at
          FROM posts
          WHERE status = 'approved' AND id != ?
          ORDER BY RANDOM()
          LIMIT 1
        `,
        )
        .get(excludedId)
    : null;

  const fallback = randomPost || db
    .prepare(
      `
      SELECT id, text, url, author, media_json, is_real, created_at
      FROM posts
      WHERE status = 'approved'
      ORDER BY RANDOM()
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

app.get("/api/admin/posts", assertAdminAuth, (req, res) => {
  const limit = Math.max(1, parsePositiveInt(req.query.limit, 25, 100));
  const offset = parsePositiveInt(req.query.offset, 0, 100000);

  const rows = db
    .prepare(
      `
      SELECT id, source, post_id, text, url, author, media_json, is_real, created_at, captured_at, status
      FROM posts
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `,
    )
    .all(limit, offset);

  const total = db.prepare("SELECT COUNT(*) AS count FROM posts").get().count;

  return res.json({
    items: rows.map((row) => ({
      ...serializePost(row),
      source: row.source,
      post_id: row.post_id,
      is_real: Boolean(row.is_real),
      status: row.status,
      captured_at: normalizeTimestamp(row.captured_at),
    })),
    pagination: {
      total,
      limit,
      offset,
      has_more: offset + rows.length < total,
    },
  });
});

app.post("/api/admin/fakes", assertAdminAuth, (req, res) => {
  const {
    text,
    author = "realDonaldTrump",
    created_at = new Date().toISOString(),
    status = "approved",
  } = req.body || {};

  const normalizedText = typeof text === "string" ? text.trim() : "";
  const normalizedAuthor = normalizeAuthor(author);
  const normalizedCreatedAt = normalizeTimestamp(created_at);
  const normalizedStatus = normalizeStatus(status);

  if (!normalizedText) {
    return res.status(400).json({ error: "text is required" });
  }

  if (normalizedText.length > 5000) {
    return res.status(400).json({ error: "text is too long" });
  }

  if (!normalizedAuthor) {
    return res.status(400).json({ error: "author must be a valid handle" });
  }

  if (!normalizedCreatedAt) {
    return res.status(400).json({ error: "created_at must be a valid timestamp" });
  }

  if (!normalizedStatus) {
    return res.status(400).json({ error: "Unsupported status" });
  }

  const capturedAt = new Date().toISOString();
  const info = db
    .prepare(
      `
      INSERT INTO posts (source, post_id, text, url, author, media_json, is_real, created_at, captured_at, status)
      VALUES (@source, NULL, @text, NULL, @author, NULL, 0, @created_at, @captured_at, @status)
    `,
    )
    .run({
      source: "x",
      text: normalizedText,
      author: normalizedAuthor,
      created_at: normalizedCreatedAt,
      captured_at: capturedAt,
      status: normalizedStatus,
    });

  const inserted = db
    .prepare(
      `
      SELECT id, source, post_id, text, url, author, media_json, is_real, created_at, captured_at, status
      FROM posts
      WHERE id = ?
    `,
    )
    .get(info.lastInsertRowid);

  return res.status(201).json({
    ok: true,
    post: {
      ...serializePost(inserted),
      source: inserted.source,
      post_id: inserted.post_id,
      is_real: Boolean(inserted.is_real),
      status: inserted.status,
      captured_at: normalizeTimestamp(inserted.captured_at),
    },
  });
});

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

export default app;
