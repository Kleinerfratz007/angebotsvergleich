import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { encrypt, isEncryptionConfigured, maskKey, decrypt } from "@/lib/encryption";
import { getSetting, invalidateSetting } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

const ALLOWED_KEYS = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_MODEL",
  "GOOGLE_API_KEY",
  "GEMINI_MODEL",
  "AI_PROVIDER_DEFAULT",
] as const;

/** GET /api/settings — Admin only. Liefert maskierte Werte. */
export async function GET() {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const items: Array<{ key: string; masked: string; source: "db" | "env" | "none"; updatedAt?: string }> = [];
  for (const key of ALLOWED_KEYS) {
    let masked = "";
    let source: "db" | "env" | "none" = "none";
    let updatedAt: string | undefined;

    if (isEncryptionConfigured()) {
      try {
        const row = await prisma.appSetting.findUnique({ where: { key } });
        if (row?.valueEncrypted) {
          const decrypted = decrypt(row.valueEncrypted);
          masked = key.endsWith("_KEY") ? maskKey(decrypted) : decrypted;
          source = "db";
          updatedAt = row.updatedAt.toISOString();
        }
      } catch { /* ignore */ }
    }
    if (!masked && process.env[key]) {
      const envVal = process.env[key]!;
      masked = key.endsWith("_KEY") ? maskKey(envVal) : envVal;
      source = "env";
    }
    items.push({ key, masked, source, updatedAt });
  }

  return NextResponse.json({
    items,
    encryptionConfigured: isEncryptionConfigured(),
  });
}

/** POST /api/settings — Admin only. Speichert verschluesselt. */
async function _POST_handler(req: NextRequest) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (!isEncryptionConfigured()) return NextResponse.json({ error: "APP_ENCRYPTION_KEY nicht konfiguriert" }, { status: 503 });

  const body = await req.json().catch(() => null) as { key?: string; value?: string } | null;
  if (!body?.key || typeof body.value !== "string") {
    return NextResponse.json({ error: "key + value erforderlich" }, { status: 400 });
  }
  if (!(ALLOWED_KEYS as readonly string[]).includes(body.key)) {
    return NextResponse.json({ error: "Unbekannter Key" }, { status: 400 });
  }

  // Leerer Value = Loeschen
  if (body.value.trim() === "") {
    await prisma.appSetting.deleteMany({ where: { key: body.key } });
    invalidateSetting(body.key);
    return NextResponse.json({ ok: true, deleted: true });
  }

  const encrypted = encrypt(body.value.trim());
  await prisma.appSetting.upsert({
    where: { key: body.key },
    update: { valueEncrypted: encrypted, updatedById: user.id },
    create: { key: body.key, valueEncrypted: encrypted, updatedById: user.id },
  });
  invalidateSetting(body.key);
  return NextResponse.json({ ok: true });
}

export const POST = withIdempotency(_POST_handler, { appName: "angebotsvergleich" });
