export function getUtcDayKey(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function hashToIndex(str, mod) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash % mod;
}

export function normalizeMedia(media) {
  if (!media || typeof media !== "object") {
    return null;
  }

  const images = Array.isArray(media.images)
    ? media.images.filter((item) => item && typeof item.url === "string")
    : [];

  const video = media.video && typeof media.video === "object" ? media.video : null;
  const normalizedVideo = video && (
    typeof video.posterUrl === "string" || typeof video.url === "string"
  )
    ? {
        url: typeof video.url === "string" ? video.url : null,
        posterUrl: typeof video.posterUrl === "string" ? video.posterUrl : null,
      }
    : null;

  if (!images.length && !normalizedVideo) {
    return null;
  }

  return {
    images,
    video: normalizedVideo,
  };
}

export function parseMedia(mediaJson) {
  if (!mediaJson) {
    return null;
  }

  try {
    return JSON.parse(mediaJson);
  } catch (_error) {
    return null;
  }
}

export function serializePost(row) {
  return {
    id: row.id,
    text: row.text,
    url: row.url,
    author: row.author,
    media: parseMedia(row.media_json),
    created_at: row.created_at,
  };
}
