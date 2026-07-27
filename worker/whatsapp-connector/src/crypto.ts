import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for the RemoteAuth session blob (the whole zipped Chromium
 * profile) — real application-layer encryption, not just reliance on
 * Supabase's disk-level encryption ("credenciales cifradas" per the user's
 * explicit requirement). The key is the per-session symmetric secret
 * resolved once via `get_whatsapp_web_session_key`
 * (0051_whatsapp_web_credentials.sql, still valid — only the table that
 * migration created was dropped, not the RPC) and kept in memory for the
 * session's lifetime — never persisted here.
 *
 * Buffer-native (not string/JSON) — the session blob is a binary .zip, not
 * JSON like the old Baileys auth-state was.
 */
export interface EncryptedPayload {
  encryptedValue: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function encrypt(plaintext: Buffer, keyBase64: string): EncryptedPayload {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encryptedValue = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { encryptedValue, iv, authTag: cipher.getAuthTag() };
}

export function decrypt(payload: EncryptedPayload, keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, payload.iv);
  decipher.setAuthTag(payload.authTag);
  return Buffer.concat([decipher.update(payload.encryptedValue), decipher.final()]);
}

/** Packs iv(12) + authTag(16) + ciphertext into one flat blob for Storage,
 * and unpacks it back — avoids needing three separate Storage objects per
 * session for what's conceptually one encrypted file. */
export function packEncrypted(payload: EncryptedPayload): Buffer {
  return Buffer.concat([payload.iv, payload.authTag, payload.encryptedValue]);
}

export function unpackEncrypted(blob: Buffer): EncryptedPayload {
  return { iv: blob.subarray(0, 12), authTag: blob.subarray(12, 28), encryptedValue: blob.subarray(28) };
}
