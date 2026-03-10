export function getUtcDayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const HTTPS_PROTOCOLS = new Set(["https:"]);
const SUPPORTED_POST_SOURCES = new Set(["x", "truthsocial"]);
const SUPPORTED_POST_STATUSES = new Set(["approved", "pending", "rejected"]);
const SUPPORTED_POST_HOSTS = new Set([
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "mobile.twitter.com",
  "truthsocial.com",
  "www.truthsocial.com",
]);
const MAX_MEDIA_ITEMS = 8;

function safeUrl(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  try {
    return new URL(value.trim());
  } catch (_error) {
    return null;
  }
}

export function hashToIndex(str, mod) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

export function normalizeSource(source) {
  if (typeof source !== "string") {
    return null;
  }

  const normalized = source.trim().toLowerCase();
  return SUPPORTED_POST_SOURCES.has(normalized) ? normalized : null;
}

export function normalizeStatus(status) {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.trim().toLowerCase();
  return SUPPORTED_POST_STATUSES.has(normalized) ? normalized : null;
}

export function normalizePostId(postId) {
  if (postId == null) {
    return null;
  }

  const normalized = String(postId).trim();
  return /^\d{1,32}$/.test(normalized) ? normalized : null;
}

export function normalizeAuthor(author) {
  if (author == null) {
    return null;
  }

  const normalized = String(author).trim();
  return /^[A-Za-z0-9_]{1,30}$/.test(normalized) ? normalized : null;
}

export function normalizeTimestamp(value) {
  if (value == null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function normalizeHttpsUrl(value) {
  const url = safeUrl(value);
  if (!url || !HTTPS_PROTOCOLS.has(url.protocol)) {
    return null;
  }

  return url.toString();
}

export function normalizePostUrl(value) {
  const normalized = normalizeHttpsUrl(value);
  if (!normalized) {
    return null;
  }

  const url = new URL(normalized);
  if (!SUPPORTED_POST_HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }

  if (/^\/[^/]+\/status\/\d+(?:\/)?$/i.test(url.pathname)) {
    return normalized;
  }

  return /^\/@[A-Za-z0-9_]{1,30}\/posts\/\d+(?:\/)?$/i.test(url.pathname) ? normalized : null;
}

export function normalizeMedia(media) {
  if (!media || typeof media !== "object") {
    return null;
  }

  const images = Array.isArray(media.images)
    ? media.images
        .map((item) => {
          const url = normalizeHttpsUrl(item && item.url);
          return url ? { url } : null;
        })
        .filter(Boolean)
        .slice(0, MAX_MEDIA_ITEMS)
    : [];

  const video = media.video && typeof media.video === "object" ? media.video : null;
  const normalizedVideo = video && (
    typeof video.posterUrl === "string" || typeof video.url === "string"
  )
    ? {
        url: normalizeHttpsUrl(video.url),
        posterUrl: normalizeHttpsUrl(video.posterUrl),
      }
    : null;

  const hasVideo = normalizedVideo && (normalizedVideo.posterUrl || normalizedVideo.url);

  if (!images.length && !hasVideo) {
    return null;
  }

  return {
    images,
    video: hasVideo ? normalizedVideo : null,
  };
}

export function parseMedia(mediaJson) {
  if (!mediaJson) {
    return null;
  }

  try {
    return normalizeMedia(JSON.parse(mediaJson));
  } catch (_error) {
    return null;
  }
}

export function serializePost(row) {
  return {
    id: row.id,
    text: row.text,
    url: normalizePostUrl(row.url),
    author: normalizeAuthor(row.author),
    media: parseMedia(row.media_json),
    created_at: normalizeTimestamp(row.created_at),
  };
}
