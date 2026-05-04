import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { extractText } from "@/lib/pdf-extract";
import { extractRfqScope } from "@/lib/rfq-extract";
import { logUsage } from "@/lib/usage-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/rfq-extract
 * multipart/form-data: file (PDF/Text der Anfrage)
 *
 * Extrahiert Text + ruft KI-Scope-Extraktion auf. Liefert die Scope-Vorschau
 * zurueck — KEIN DB-Save (passiert erst beim Comparison-POST mit rfqScope).
 */
export async function POST(req: NextRequest) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file erforderlich" }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "max 20 MB" }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    text = await extractText(buf, file.type, file.name);
  } catch (e) {
    return NextResponse.json({ error: "PDF-Text konnte nicht extrahiert werden: " + (e as Error).message }, { status: 422 });
  }
  if (!text || text.trim().length < 50) {
    return NextResponse.json({ error: "Zu wenig Text in der Datei extrahiert" }, { status: 422 });
  }

  try {
    const r = await extractRfqScope(text);
    // Cost-Tracking
    await logUsage({
      userId: user.id,
      userName: user.name || user.email,
      userEmail: user.email,
      provider: "claude",
      model: r.meta.model,
      kind: "comparison",
      inputTokens: r.meta.inputTokens,
      outputTokens: r.meta.outputTokens,
      runMs: r.meta.runMs,
    });
    return NextResponse.json({
      ok: true,
      scope: r.scope,
      meta: r.meta,
      extractedTextLength: text.length,
      filename: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
