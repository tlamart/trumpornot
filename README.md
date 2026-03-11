# TrumpOrNot

Daily game: user sees one post and guesses if it is real or fake.

## Project structure

- `index.html`, `styles.css`, `app.js`: website
- `backend/`: Express + SQLite API
- `extension/`: Firefox extension to curate posts from x.com and truthsocial.com

## Local Development

### Option 1: Node.js + HTTP Server

#### 1) Run backend

```bash
cd backend
npm install
EXTENSION_API_KEY=replace-with-a-long-random-secret npm start
```

Backend runs on `http://localhost:3000`.

#### 2) Run website

From project root:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

When the frontend is served from a local static dev server on `localhost`, it tries `GET http://localhost:3000/api/daily`.
When it is served by the backend itself or through your reverse proxy, it uses the same origin as the page.
If the backend has no posts yet or is offline, it falls back to local sample posts.

### Option 2: Docker (Local or VPS)

#### Build the image locally:

```bash
docker build -t thibaldocker/trumpornot:latest .
```

#### Run with Docker Compose:

```bash
# Update environment variables in docker-compose.yml first
docker-compose up -d
```

Frontend and API available at `http://localhost:8080`.

#### Deploy to VPS:

1. Push to Docker Hub:
   ```bash
   docker push thibaldocker/trumpornot:latest
   ```

2. On VPS, pull and run:
   ```bash
   docker pull thibaldocker/trumpornot:latest
   docker-compose up -d
   ```

App runs on port 8080 (configurable in `docker-compose.yml`).

## Firefox Extension

### 1) Install (temporary)

1. Open Firefox.
2. Go to `about:debugging` -> `This Firefox`.
3. Click `Load Temporary Add-on...`.
4. Select `extension/manifest.json`.

### 2) Use extension

1. Click extension icon.
2. On first use, set:
   - API Base URL: `https://trumpornot.tlam.art` by default, or `http://localhost:3000` for local development
   - Extension API Key: same as `EXTENSION_API_KEY`
3. Click `Save Settings` and approve access to that backend origin when Firefox asks.
4. Open X or Truth Social.
5. Click `Save as Real` on any post you want to store.

After that, each X post gets an inline `Save as Real` button. On Truth Social post pages (`/@handle/posts/<id>`), the extension adds a floating `Save as Real` button and fetches the post payload from Truth Social's status API before saving it. The page buttons reuse the saved API base URL and API key.

Saved post is inserted/upserted into SQLite (`/app/backend/data/data.db` in Docker, `backend/data.db` locally by default).
Posts can now include text-only, image, or video content. Media-only posts are accepted too.

## API

- `GET /api/health`
- `POST /api/posts` (requires header `x-extension-key`)
- `GET /api/daily`
- `GET /beta`
- `GET /api/beta/next` (requires header `x-beta-key`)
- `GET /api/admin/review` (requires header `x-admin-key`)
- `GET /api/admin/posts` (requires header `x-admin-key`)
- `POST /api/admin/fakes` (requires header `x-admin-key`)

## Configuration

- `EXTENSION_API_KEY`: API key for the Firefox extension (required for POST requests)
- `CORS_ALLOWED_ORIGINS`: optional comma-separated allowlist for browser origins that may call the API
- `ADMIN_PAGE_KEY`: API key for admin endpoints (defaults to `EXTENSION_API_KEY`)
- `BETA_PAGE_KEY`: API key for beta endpoints (defaults to `ADMIN_PAGE_KEY`)
- `PORT`: Backend port (default: 3000, Docker: 8080)
- `DB_DIR`: optional directory for SQLite files (`data.db`, `data.db-wal`, `data.db-shm`)

For production, set these securely via environment variables or in `docker-compose.yml`.

## Notes

- `EXTENSION_API_KEY` is required and must not use the old `change-me` placeholder.
- The extension now only accepts `https://` API URLs, except for `http://localhost` and `http://127.0.0.1` during local development.
- The extension requests host access at runtime only for the specific backend origin you configure.
- Beta and admin page keys are kept in `sessionStorage`, not persisted across browser restarts.
- Current extension extraction targets single-post pages and may need updates if X DOM changes.
- For VPS deployment, consider using Nginx as a reverse proxy or enabling HTTPS on port 8080.
- SQLite database files are persisted in Docker via the `sqlite-data` volume and should be backed up regularly.
