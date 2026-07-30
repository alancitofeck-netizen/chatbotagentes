import { describe, expect, it } from "vitest";
import { detectProvider } from "./video";

describe("detectProvider", () => {
  it("YouTube: watch?v= always renders via youtube-nocookie.com (modo oculto)", () => {
    const result = detectProvider("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result).toEqual({ provider: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  it("YouTube: youtu.be short link", () => {
    const result = detectProvider("https://youtu.be/dQw4w9WgXcQ");
    expect(result).toEqual({ provider: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  it("YouTube: already an embed URL", () => {
    const result = detectProvider("https://www.youtube.com/embed/dQw4w9WgXcQ");
    expect(result).toEqual({ provider: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
  });

  it("Vimeo: plain vimeo.com/{id}", () => {
    const result = detectProvider("https://vimeo.com/76979871");
    expect(result).toEqual({ provider: "vimeo", embedUrl: "https://player.vimeo.com/video/76979871?title=0&byline=0&portrait=0" });
  });

  it("Vimeo: unlisted with hash", () => {
    const result = detectProvider("https://vimeo.com/76979871/abc123hash");
    expect(result).toEqual({
      provider: "vimeo",
      embedUrl: "https://player.vimeo.com/video/76979871?title=0&byline=0&portrait=0&h=abc123hash",
    });
  });

  it("Bunny Stream: already an embed URL passes through", () => {
    const result = detectProvider("https://iframe.mediadelivery.net/embed/12345/abcd-ef01");
    expect(result).toEqual({ provider: "bunny", embedUrl: "https://iframe.mediadelivery.net/embed/12345/abcd-ef01" });
  });

  it("Bunny Stream: constructs embed URL from a play path", () => {
    const result = detectProvider("https://vz-abc123.b-cdn.net/12345/abcd-ef01/play_720p.mp4");
    expect(result).toEqual({ provider: "bunny", embedUrl: "https://iframe.mediadelivery.net/embed/12345/abcd-ef01" });
  });

  it("Cloudflare Stream: always renders the /iframe variant", () => {
    const result = detectProvider("https://customer-abc123.cloudflarestream.com/31c9291a-...abc/watch");
    expect(result).toEqual({
      provider: "cloudflare",
      embedUrl: "https://customer-abc123.cloudflarestream.com/31c9291a-...abc/iframe",
    });
  });

  it("Mux: player.mux.com URL", () => {
    const result = detectProvider("https://player.mux.com/abc123XYZ");
    expect(result).toEqual({ provider: "mux", embedUrl: "https://player.mux.com/abc123XYZ" });
  });

  it("Mux: bare playback id with no URL shape", () => {
    const result = detectProvider("00X9OTVE5EQO02OxG7oM1kmSuGN4x00vP01H01wLPeD1p8QU");
    expect(result).toEqual({ provider: "mux", embedUrl: "https://player.mux.com/00X9OTVE5EQO02OxG7oM1kmSuGN4x00vP01H01wLPeD1p8QU" });
  });

  it("MP4: direct file URL", () => {
    const result = detectProvider("https://cdn.growthlink.uk/videos/leccion-1.mp4");
    expect(result).toEqual({ provider: "mp4", src: "https://cdn.growthlink.uk/videos/leccion-1.mp4" });
  });

  it("MP4: query string after extension is tolerated", () => {
    const result = detectProvider("https://cdn.growthlink.uk/videos/leccion-1.mp4?token=abc");
    expect(result).toEqual({ provider: "mp4", src: "https://cdn.growthlink.uk/videos/leccion-1.mp4?token=abc" });
  });

  it("unknown: unrecognized URL falls back without throwing", () => {
    const result = detectProvider("https://example.com/some-random-page");
    expect(result).toEqual({ provider: "unknown", originalUrl: "https://example.com/some-random-page" });
  });

  it("unknown: empty string", () => {
    expect(detectProvider("")).toEqual({ provider: "unknown", originalUrl: "" });
  });
});
