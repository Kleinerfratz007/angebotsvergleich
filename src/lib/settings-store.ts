/**
 * Konvention §17 (2026-05-04): Settings-Store mit DB-First, env-Fallback.
 * Cache pro Process (5 min TTL) damit nicht jeder Claude-Call DB hit.
 */
import { prisma } from "./db";
import { decrypt, isEncryptionConfigured } from "./encryption";

const cache = new Map<string, { value: string; expires: number }>();
const TTL_MS = 5 * 60 * 1000;

/**
 * Liefert Setting-Value: erst aus DB (falls Encryption konfiguriert),
 * sonst aus env (Fallback). Liefert "" wenn nirgends gesetzt.
 */
export async function getSetting(key: string): Promise<string> {
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;

  let value = "";
  if (isEncryptionConfigured()) {
    try {
      const row = await prisma.appSetting.findUnique({ where: { key } });
      if (row?.valueEncrypted) {
        value = decrypt(row.valueEncrypted);
      }
    } catch {
      /* DB-Fehler → fallback auf env */
    }
  }
  if (!value) value = process.env[key] || "";
  cache.set(key, { value, expires: Date.now() + TTL_MS });
  return value;
}

/** Cache invalidieren — nach Settings-Save aufrufen. */
export function invalidateSetting(key: string): void {
  cache.delete(key);
}

export function invalidateAllSettings(): void {
  cache.clear();
}
