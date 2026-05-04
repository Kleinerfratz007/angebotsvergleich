/**
 * Konvention §17 (2026-05-04): AES-256-GCM Verschluesselung fuer
 * sensitive Settings (z.B. API-Keys) in DB.
 *
 * Key kommt aus APP_ENCRYPTION_KEY env (32 hex bytes = 64 chars).
 * Falls fehlend, generiere Warnung — App laeuft, aber Keys nicht persistierbar.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_HEX = process.env.APP_ENCRYPTION_KEY || "";

function getKey(): Buffer {
  if (!KEY_HEX) throw new Error("APP_ENCRYPTION_KEY nicht gesetzt — Settings nicht speicherbar");
  if (KEY_HEX.length !== 64) throw new Error("APP_ENCRYPTION_KEY muss 64 hex-Zeichen sein (32 bytes)");
  return Buffer.from(KEY_HEX, "hex");
}

export function isEncryptionConfigured(): boolean {
  return KEY_HEX.length === 64;
}

/** Encrypts a plaintext to format "iv:authTag:ciphertext" (alle hex). */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);  // GCM standard IV-Laenge
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(payload: string): string {
  const key = getKey();
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("Ungueltiges encrypted format");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}

/** "sk-ant-...c0d3" — zeigt nur Prefix+Suffix fuer UI-Anzeige. */
export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 12) return "••••";
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}
