import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "/app/uploads";

export async function saveOfferFile(comparisonId: string, originalFilename: string, buffer: Buffer): Promise<{ storageKey: string; size: number }> {
  const dir = join(UPLOAD_DIR, "comparisons", comparisonId);
  await mkdir(dir, { recursive: true });
  const safeName = originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filename = `${randomUUID()}_${safeName}`;
  const fullPath = join(dir, filename);
  await writeFile(fullPath, buffer);
  return {
    storageKey: `comparisons/${comparisonId}/${filename}`,
    size: buffer.length,
  };
}

export async function readOfferFile(storageKey: string): Promise<Buffer> {
  const fullPath = join(UPLOAD_DIR, storageKey);
  return await readFile(fullPath);
}

export async function deleteOfferFile(storageKey: string): Promise<void> {
  try {
    await unlink(join(UPLOAD_DIR, storageKey));
  } catch { /* ignore */ }
}
