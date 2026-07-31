/**
 * Isomorphic HTML/ZIP bundle parser for "Vincular App" Fase 2 (subir
 * archivo) — runs identically in the browser (instant preview, before
 * anything is uploaded) and on the server (the real extraction that gets
 * uploaded to Storage), same code both places so preview and production
 * never drift. No "server-only"/"use client" import — deliberately safe in
 * both bundles.
 *
 * Zip-slip protection: any entry whose path normalizes outside the bundle
 * root (a leading "/", or a ".." segment) is rejected outright rather than
 * silently sanitized — an attacker-crafted zip should fail loudly, not
 * write somewhere unexpected in Storage.
 */

import JSZip from "jszip";

export const MAX_BUNDLE_BYTES = 25 * 1024 * 1024; // 25MB — see bundle-upload/route.ts's own comment for why.
const MAX_DECOMPRESSED_BYTES = 100 * 1024 * 1024; // zip-bomb guard — generous but bounded.

export interface ParsedBundleFile {
  path: string;
  bytes: Uint8Array;
  mimeType: string;
}

export interface ParsedBundle {
  files: ParsedBundleFile[];
  indexPath: string;
  counts: { css: number; js: number; images: number };
  totalBytes: number;
}

export type ParseBundleResult = { ok: true; bundle: ParsedBundle } | { ok: false; error: string };

const MIME_BY_EXTENSION: Record<string, string> = {
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",
  mjs: "application/javascript",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "svg", "webp", "ico"]);

function extensionOf(path: string): string {
  const dot = path.lastIndexOf(".");
  return dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
}

export function mimeTypeFor(path: string): string {
  return MIME_BY_EXTENSION[extensionOf(path)] ?? "application/octet-stream";
}

/** Rejects path traversal — normalized segments must never include ".." or
 * resolve to an absolute path. Exported because the bundle-asset proxy
 * route (src/app/api/public/mini-apps/[slug]/bundle/[...path]/route.ts)
 * reconstructs the same kind of filesystem-like path from a URL and needs
 * the identical guard. */
export function isSafeRelativePath(path: string): boolean {
  if (path.startsWith("/") || path.includes("\\")) return false;
  const segments = path.split("/");
  return segments.every((s) => s !== ".." && s !== "");
}

async function parseZip(bytes: Uint8Array): Promise<ParseBundleResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return { ok: false, error: "El archivo no es un ZIP válido." };
  }

  const files: ParsedBundleFile[] = [];
  let totalBytes = 0;
  let indexPath: string | null = null;

  const entries = Object.values(zip.files).filter((e) => !e.dir);
  for (const entry of entries) {
    // Strip a possible single top-level folder some zip tools add (e.g.
    // "mi-app/index.html") so "index.html" is still found at the root.
    const relativePath = entry.name;
    if (!isSafeRelativePath(relativePath)) {
      return { ok: false, error: `Ruta insegura dentro del ZIP: "${relativePath}".` };
    }
    const bytesForEntry = await entry.async("uint8array");
    totalBytes += bytesForEntry.byteLength;
    if (totalBytes > MAX_DECOMPRESSED_BYTES) {
      return { ok: false, error: "El ZIP descomprime a un tamaño demasiado grande." };
    }
    files.push({ path: relativePath, bytes: bytesForEntry, mimeType: mimeTypeFor(relativePath) });
  }

  // Buscar index.html en la raíz — si todos los archivos comparten un único
  // prefijo de carpeta (zip con una carpeta madre), se lo saca antes de
  // buscar, para que "mi-app/index.html" siga contando como "en la raíz".
  const topLevelFolders = new Set(files.map((f) => (f.path.includes("/") ? f.path.split("/")[0] : null)).filter(Boolean));
  const singleRootFolder = files.length > 0 && topLevelFolders.size === 1 && !files.some((f) => !f.path.includes("/")) ? [...topLevelFolders][0] : null;

  const normalizedFiles = singleRootFolder
    ? files.map((f) => ({ ...f, path: f.path.slice(singleRootFolder.length + 1) }))
    : files;

  const indexEntry = normalizedFiles.find((f) => f.path.toLowerCase() === "index.html");
  if (!indexEntry) {
    return { ok: false, error: "No se encontró un index.html en la raíz del ZIP." };
  }
  indexPath = indexEntry.path;

  const counts = { css: 0, js: 0, images: 0 };
  for (const f of normalizedFiles) {
    const ext = extensionOf(f.path);
    if (ext === "css") counts.css++;
    else if (ext === "js" || ext === "mjs") counts.js++;
    else if (IMAGE_EXTENSIONS.has(ext)) counts.images++;
  }

  return { ok: true, bundle: { files: normalizedFiles, indexPath, counts, totalBytes } };
}

/** `fileName` decides html-vs-zip handling; `bytes` is the raw uploaded
 * file content either way. */
export async function parseBundle(fileName: string, bytes: Uint8Array): Promise<ParseBundleResult> {
  if (bytes.byteLength > MAX_BUNDLE_BYTES) {
    return { ok: false, error: `El archivo supera el máximo de ${MAX_BUNDLE_BYTES / (1024 * 1024)} MB.` };
  }
  const ext = extensionOf(fileName);
  if (ext === "html" || ext === "htm") {
    return {
      ok: true,
      bundle: {
        files: [{ path: "index.html", bytes, mimeType: "text/html" }],
        indexPath: "index.html",
        counts: { css: 0, js: 0, images: 0 },
        totalBytes: bytes.byteLength,
      },
    };
  }
  if (ext === "zip") return parseZip(bytes);
  return { ok: false, error: "Formato no soportado — subí un archivo .html o .zip." };
}
