import { BufferJSON, initAuthCreds, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from "@whiskeysockets/baileys";
import { supabase } from "./supabase.js";
import { encrypt, decrypt } from "./crypto.js";

const CREDS_KEY_ID = "singleton";

interface CredentialRow {
  key_type: string;
  key_id: string;
  encrypted_value: string; // bytea comes back as a hex string ("\\x...") over PostgREST
  iv: string;
  auth_tag: string;
}

/** Supabase/PostgREST returns `bytea` columns as `\x`-prefixed hex strings —
 * convert both ways explicitly rather than assuming base64. */
function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.startsWith("\\x") ? hex.slice(2) : hex, "hex");
}
function bufferToHex(buf: Buffer): string {
  return "\\x" + buf.toString("hex");
}

/**
 * Custom Baileys `AuthenticationState` adapter over `whatsapp_web_credentials`
 * (0051_whatsapp_web_credentials.sql) — one row per Signal key rather than a
 * single mutating blob, mirroring Baileys' own `useMultiFileAuthState` shape.
 * Every read/write is encrypted with this session's own AES-256-GCM key
 * (resolved once via `get_whatsapp_web_session_key`, kept only in memory for
 * the socket's lifetime — never written back to disk/DB here).
 */
export async function loadAuthState(
  sessionId: string,
  workspaceId: string,
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const { data: keyRow, error: keyError } = await supabase.rpc("get_whatsapp_web_session_key", { p_session_id: sessionId });
  if (keyError || !keyRow) {
    throw new Error(`[authStore] could not resolve the encryption key for session ${sessionId}: ${keyError?.message}`);
  }
  const encryptionKey = keyRow as string;

  const { data: rows, error: rowsError } = await supabase
    .from("whatsapp_web_credentials")
    .select("key_type, key_id, encrypted_value, iv, auth_tag")
    .eq("session_id", sessionId);
  if (rowsError) {
    throw new Error(`[authStore] failed to load credentials for session ${sessionId}: ${rowsError.message}`);
  }

  function decryptRow(row: CredentialRow): unknown {
    const plaintext = decrypt(
      { encryptedValue: hexToBuffer(row.encrypted_value), iv: hexToBuffer(row.iv), authTag: hexToBuffer(row.auth_tag) },
      encryptionKey,
    );
    return JSON.parse(plaintext, BufferJSON.reviver);
  }

  const credsRow = (rows as CredentialRow[] | null)?.find((r) => r.key_type === "creds" && r.key_id === CREDS_KEY_ID);
  const creds: AuthenticationCreds = credsRow ? (decryptRow(credsRow) as AuthenticationCreds) : initAuthCreds();

  // In-memory index of every non-creds key, keyed "type:id" — Baileys reads
  // these far more often than it writes, so an upfront load is cheaper than
  // a DB round trip per get().
  const keyRows = (rows as CredentialRow[] | null)?.filter((r) => !(r.key_type === "creds" && r.key_id === CREDS_KEY_ID)) ?? [];
  const memory = new Map<string, unknown>(keyRows.map((r) => [`${r.key_type}:${r.key_id}`, decryptRow(r)]));

  async function persistCreds(value: AuthenticationCreds): Promise<void> {
    const payload = encrypt(JSON.stringify(value, BufferJSON.replacer), encryptionKey);
    const { error } = await supabase.from("whatsapp_web_credentials").upsert(
      {
        session_id: sessionId,
        workspace_id: workspaceId,
        key_type: "creds",
        key_id: CREDS_KEY_ID,
        encrypted_value: bufferToHex(payload.encryptedValue),
        iv: bufferToHex(payload.iv),
        auth_tag: bufferToHex(payload.authTag),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "session_id,key_type,key_id" },
    );
    if (error) console.error(`[authStore] failed to persist creds for session ${sessionId}:`, error);
  }

  const state: AuthenticationState = {
    creds,
    keys: {
      async get(type, ids) {
        const results: Record<string, unknown> = {};
        for (const id of ids) {
          const cached = memory.get(`${type}:${id}`);
          if (cached !== undefined) results[id] = cached;
        }
        return results as { [id: string]: SignalDataTypeMap[typeof type] };
      },
      async set(data) {
        // Baileys hands over a batch spanning multiple key types per call
        // (e.g. several pre-keys during pairing) — persisted as one upsert
        // (+ one delete pass for null values), not N sequential awaits.
        const upserts: Record<string, unknown>[] = [];
        const deletes: { key_type: string; key_id: string }[] = [];

        for (const [type, entries] of Object.entries(data)) {
          for (const [id, value] of Object.entries(entries as Record<string, unknown>)) {
            const memKey = `${type}:${id}`;
            if (value === null || value === undefined) {
              memory.delete(memKey);
              deletes.push({ key_type: type, key_id: id });
              continue;
            }
            memory.set(memKey, value);
            const payload = encrypt(JSON.stringify(value, BufferJSON.replacer), encryptionKey);
            upserts.push({
              session_id: sessionId,
              workspace_id: workspaceId,
              key_type: type,
              key_id: id,
              encrypted_value: bufferToHex(payload.encryptedValue),
              iv: bufferToHex(payload.iv),
              auth_tag: bufferToHex(payload.authTag),
              updated_at: new Date().toISOString(),
            });
          }
        }

        if (upserts.length) {
          const { error } = await supabase.from("whatsapp_web_credentials").upsert(upserts, { onConflict: "session_id,key_type,key_id" });
          if (error) console.error(`[authStore] failed to upsert ${upserts.length} key(s) for session ${sessionId}:`, error);
        }
        for (const d of deletes) {
          const { error } = await supabase
            .from("whatsapp_web_credentials")
            .delete()
            .eq("session_id", sessionId)
            .eq("key_type", d.key_type)
            .eq("key_id", d.key_id);
          if (error) console.error(`[authStore] failed to delete key ${d.key_type}:${d.key_id} for session ${sessionId}:`, error);
        }
      },
    },
  };

  return { state, saveCreds: () => persistCreds(state.creds) };
}
