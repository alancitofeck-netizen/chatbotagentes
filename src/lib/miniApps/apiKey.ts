import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/** Public API keys authenticate anonymous, cross-origin POST requests
 * (the lead-ingestion endpoint) — they need a fast per-request equality
 * check, unlike outbound-integration secrets (Vault), which are retrieved
 * async and only ever read server-side. A plaintext key is only ever
 * returned once, at creation/regeneration time; only its SHA-256 hash is
 * persisted (mini_apps.api_key_hash). */
export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

export function lastFour(plaintext: string): string {
  return plaintext.slice(-4);
}

export function verifyApiKey(plaintext: string, storedHash: string): boolean {
  const providedHash = hashApiKey(plaintext);
  const providedBuf = Buffer.from(providedHash);
  const storedBuf = Buffer.from(storedHash);
  if (providedBuf.length !== storedBuf.length) return false;
  return timingSafeEqual(providedBuf, storedBuf);
}

/** URL-safe slug from a name, with a short random suffix to keep it globally
 * unique (mini_apps.slug has no workspace scoping — see migration comment). */
export function slugify(name: string): string {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics left by NFD (e.g. "á" -> "a" + accent)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const suffix = randomBytes(3).toString("hex");
  return `${base || "mini-app"}-${suffix}`;
}
