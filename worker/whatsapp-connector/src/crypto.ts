import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for `whatsapp_web_credentials.encrypted_value` — real
 * application-layer encryption of the Baileys auth-state, not just reliance
 * on Supabase's disk-level encryption ("credenciales cifradas" per the
 * user's explicit requirement). The key is the per-session symmetric secret
 * resolved once via `get_whatsapp_web_session_key` (0051_whatsapp_web_credentials.sql)
 * and kept in memory for the socket's lifetime — never persisted here.
 */
export interface EncryptedPayload {
  encryptedValue: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

export function encrypt(plaintext: string, keyBase64: string): EncryptedPayload {
  const key = Buffer.from(keyBase64, "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encryptedValue = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { encryptedValue, iv, authTag: cipher.getAuthTag() };
}

export function decrypt(payload: EncryptedPayload, keyBase64: string): string {
  const key = Buffer.from(keyBase64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, payload.iv);
  decipher.setAuthTag(payload.authTag);
  return Buffer.concat([decipher.update(payload.encryptedValue), decipher.final()]).toString("utf8");
}
