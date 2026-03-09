import db from "./db.js";

const rawLimit = Number.parseInt(process.argv[2] || "10", 10);
const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 10;

const rows = db.prepare(`
  SELECT
    id,
    post_id,
    author,
    substr(text, 1, 100) AS text_preview,
    media_json,
    created_at,
    captured_at
  FROM posts
  ORDER BY id DESC
  LIMIT ?
`).all(limit);

const output = rows.map((row) => ({
  id: row.id,
  post_id: row.post_id,
  author: row.author,
  text_preview: row.text_preview,
  has_media: Boolean(row.media_json),
  created_at: row.created_at,
  captured_at: row.captured_at,
}));

console.log(JSON.stringify(output, null, 2));
