import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { supabase } from "../supabase.js";
import { encrypt, decrypt, packEncrypted, unpackEncrypted } from "../crypto.js";
import { SESSION_DATA_PATH } from "../config.js";

const BUCKET = "whatsapp-web-sessions";

/**
 * Implements whatsapp-web.js's `RemoteAuth` Store interface
 * (sessionExists/save/extract/delete) — confirmed from the library's own
 * source (authStrategies/RemoteAuth.js), not just its docs. `RemoteAuth`
 * zips the ENTIRE Chromium profile directory into one file and hands this
 * class the `session` name it already computed internally; every method
 * below uses THAT value to build the local file path
 * (`path.join(SESSION_DATA_PATH, session + '.zip')`) rather than
 * recomputing it from our own sessionId — avoids depending on whether
 * RemoteAuth prefixes the name internally (it does, but this class doesn't
 * need to know or guess the exact convention).
 *
 * One instance per session, constructed with that session's own AES-256-GCM
 * key already resolved (via `get_whatsapp_web_session_key`,
 * 0051_whatsapp_web_credentials.sql — the RPC survives even though the
 * table it originally backed was dropped in 0052) — kept in memory only for
 * this process's lifetime, exactly like the old Baileys authStore.ts did.
 */
export class SupabaseStorageStore {
  constructor(
    private readonly sessionId: string,
    private readonly encryptionKey: string,
  ) {}

  private objectPath(): string {
    return `${this.sessionId}.zip.enc`;
  }

  async sessionExists(_args: { session: string }): Promise<boolean> {
    const { data, error } = await supabase.storage.from(BUCKET).list("", { search: this.objectPath() });
    if (error) {
      console.error(`[store] sessionExists check failed for ${this.sessionId}:`, error);
      return false;
    }
    return (data ?? []).some((f) => f.name === this.objectPath());
  }

  /** RemoteAuth calls this right after writing the local zip to
   * `path.join(dataPath, session + '.zip')` — no path argument is given
   * (confirmed from source), so this reads that exact conventional path. */
  async save(args: { session: string }): Promise<void> {
    const localZipPath = path.join(SESSION_DATA_PATH, `${args.session}.zip`);
    const plaintext = await readFile(localZipPath);
    const encrypted = encrypt(plaintext, this.encryptionKey);
    const blob = packEncrypted(encrypted);

    const { error } = await supabase.storage.from(BUCKET).upload(this.objectPath(), blob, {
      contentType: "application/octet-stream",
      upsert: true,
    });
    if (error) console.error(`[store] upload failed for session ${this.sessionId}:`, error);
  }

  /** RemoteAuth gives us the destination path here — we must write the
   * decrypted zip bytes there ourselves. */
  async extract(args: { session: string; path: string }): Promise<void> {
    const { data, error } = await supabase.storage.from(BUCKET).download(this.objectPath());
    if (error || !data) {
      throw new Error(`[store] download failed for session ${this.sessionId}: ${error?.message}`);
    }
    const blob = Buffer.from(await data.arrayBuffer());
    const plaintext = decrypt(unpackEncrypted(blob), this.encryptionKey);
    await writeFile(args.path, plaintext);
  }

  async delete(_args: { session: string }): Promise<void> {
    const { error } = await supabase.storage.from(BUCKET).remove([this.objectPath()]);
    if (error) console.error(`[store] delete failed for session ${this.sessionId}:`, error);
  }
}

/** Resolves the per-session symmetric key once via the existing
 * service-role-only RPC — shared helper so the provider doesn't need to
 * know this table/RPC's history (0051 created it for Baileys; it's reused
 * as-is here). */
export async function resolveSessionEncryptionKey(sessionId: string): Promise<string> {
  const { data, error } = await supabase.rpc("get_whatsapp_web_session_key", { p_session_id: sessionId });
  if (error || !data) {
    throw new Error(`[store] could not resolve encryption key for session ${sessionId}: ${error?.message}`);
  }
  return data as string;
}
