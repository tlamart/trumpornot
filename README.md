# TrumpOrNot

Daily game: user sees one post and guesses if it is real or fake.

## Project structure

- `index.html`, `styles.css`, `app.js`: website
- `backend/`: Express + SQLite API
- `extension/`: Firefox extension to curate posts from x.com

## 1) Run backend

```bash
cd backend
npm install
EXTENSION_API_KEY=change-me npm start
```

Backend runs on `http://localhost:3000`.

## 2) Run website

From project root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

The website tries `GET http://localhost:3000/api/daily` first.
If backend has no posts yet or is offline, it falls back to local sample posts.

## 3) Install Firefox extension (temporary)

1. Open Firefox.
2. Go to `about:debugging` -> `This Firefox`.
3. Click `Load Temporary Add-on...`.
4. Select `extension/manifest.json`.

## 4) Use extension

1. Click extension icon.
2. On first use, set:
   - API Base URL: `http://localhost:3000`
   - Extension API Key: same as `EXTENSION_API_KEY`
3. Click `Save Settings`.
4. Open X and wait for posts to render.
5. Click `Save as Real` on any post you want to store.

After that, each X post gets an inline `Save as Real` button. The page buttons reuse the saved API base URL and API key.

Saved post is inserted/upserted into SQLite (`backend/data.db`).
Posts can now include text-only, image, or video content. Media-only posts are accepted too.

## API

- `GET /api/health`
- `POST /api/posts` (requires header `x-extension-key`)
- `GET /api/daily`

## Notes

- Keep `EXTENSION_API_KEY` non-default in real usage.
- Current extension extraction targets single-post pages and may need updates if X DOM changes.
