/** Video-embed URL detection for Classroom lessons — pure functions, no
 * React, no server-only (used client-side by VideoEmbed AND by the admin
 * lesson editor's live preview). No package/SDK dependency by design: the
 * product explicitly wants "pegar una URL", not a heavy provider player SDK
 * — which is also why resume-position tracking (src/lib/classroom/progress)
 * only works for direct MP4 (the only case with a real cross-origin-free
 * `timeupdate` event). */

export type VideoEmbed =
  | { provider: "youtube"; embedUrl: string }
  | { provider: "vimeo"; embedUrl: string }
  | { provider: "bunny"; embedUrl: string }
  | { provider: "cloudflare"; embedUrl: string }
  | { provider: "mux"; embedUrl: string }
  | { provider: "mp4"; src: string }
  | { provider: "unknown"; originalUrl: string };

function tryUrl(raw: string): URL | null {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function detectYoutube(raw: string, url: URL | null): VideoEmbed | null {
  if (url && (url.hostname === "youtu.be" || url.hostname.endsWith("youtube.com") || url.hostname.endsWith("youtube-nocookie.com"))) {
    let id: string | null = null;
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (url.pathname.startsWith("/embed/")) id = url.pathname.replace("/embed/", "");
    else id = url.searchParams.get("v");
    id = id?.split("/")[0]?.split("?")[0] ?? null;
    if (id && /^[\w-]{11}$/.test(id)) return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  return null;
}

function detectVimeo(raw: string, url: URL | null): VideoEmbed | null {
  if (!url || !url.hostname.endsWith("vimeo.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  // player.vimeo.com/video/{id}[/{hash}] or vimeo.com/{id}[/{hash}]
  const videoIdx = parts[0] === "video" ? 1 : 0;
  const id = parts[videoIdx];
  const hash = parts[videoIdx + 1];
  if (id && /^\d+$/.test(id)) {
    const params = new URLSearchParams({ title: "0", byline: "0", portrait: "0" });
    if (hash) params.set("h", hash);
    return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}?${params.toString()}` };
  }
  return null;
}

function detectBunny(raw: string, url: URL | null): VideoEmbed | null {
  if (!url || !(url.hostname.endsWith("mediadelivery.net") || url.hostname.endsWith("b-cdn.net"))) return null;
  if (url.pathname.includes("/embed/")) return { provider: "bunny", embedUrl: raw };
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length >= 2) return { provider: "bunny", embedUrl: `https://iframe.mediadelivery.net/embed/${parts[0]}/${parts[1]}` };
  return null;
}

function detectCloudflare(raw: string, url: URL | null): VideoEmbed | null {
  if (!url || !url.hostname.endsWith("cloudflarestream.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const videoId = parts[0];
  if (!videoId) return null;
  return { provider: "cloudflare", embedUrl: `https://${url.hostname}/${videoId}/iframe` };
}

function detectMux(raw: string, url: URL | null): VideoEmbed | null {
  if (url && url.hostname.endsWith("mux.com")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const playbackId = parts[parts.length - 1];
    if (playbackId) return { provider: "mux", embedUrl: `https://player.mux.com/${playbackId}` };
  }
  // A bare Mux Playback ID pasted with no URL shape at all (alphanumeric,
  // no dots/slashes, not obviously another format).
  if (!url && /^[a-zA-Z0-9]{20,}$/.test(raw.trim())) {
    return { provider: "mux", embedUrl: `https://player.mux.com/${raw.trim()}` };
  }
  return null;
}

function detectMp4(raw: string): VideoEmbed | null {
  if (/\.(mp4|webm|mov)(\?.*)?$/i.test(raw.trim())) return { provider: "mp4", src: raw.trim() };
  return null;
}

export function detectProvider(rawUrl: string): VideoEmbed {
  const raw = rawUrl.trim();
  if (!raw) return { provider: "unknown", originalUrl: raw };
  const url = tryUrl(raw);

  return (
    detectYoutube(raw, url) ??
    detectVimeo(raw, url) ??
    detectBunny(raw, url) ??
    detectCloudflare(raw, url) ??
    detectMux(raw, url) ??
    detectMp4(raw) ?? { provider: "unknown", originalUrl: raw }
  );
}
