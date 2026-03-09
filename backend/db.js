import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, "data.db");
const db = new Database(dbPath);

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL DEFAULT 'x',
    post_id TEXT,
    text TEXT NOT NULL,
    url TEXT,
    author TEXT,
    media_json TEXT,
    is_real INTEGER NOT NULL CHECK (is_real IN (0,1)),
    created_at TEXT,
    captured_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'approved',
    UNIQUE(source, post_id)
  );

  CREATE TABLE IF NOT EXISTS daily_posts (
    day TEXT PRIMARY KEY,
    post_db_id INTEGER NOT NULL,
    assigned_at TEXT NOT NULL,
    FOREIGN KEY (post_db_id) REFERENCES posts(id)
  );

  CREATE INDEX IF NOT EXISTS idx_posts_real ON posts(is_real);
`);

const postColumns = db.prepare("PRAGMA table_info(posts)").all();
if (!postColumns.some((column) => column.name === "media_json")) {
  db.exec("ALTER TABLE posts ADD COLUMN media_json TEXT");
}

export default db;
