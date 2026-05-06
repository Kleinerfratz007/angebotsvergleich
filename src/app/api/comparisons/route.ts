import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { saveOfferFile } from "@/lib/storage";
import { extractText } from "@/lib/pdf-extract";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/comparisons
 * multipart/form-data:
 *  - title (string)
 *  - customerName, projectRef, backgroundInfo, customPrompt (optional)
 *  - run = "1" → KI sofort triggern
 *  - file (multiple) + supplierName (multiple, gleicher Index)
 */
async function _POST_handler(req: NextRequest) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fd = await req.formData();
  const title = String(fd.get("title") || "").trim();
  if (!title) return NextResponse.json({ error: "Titel erforderlich" }, { status: 400 });

  const supplierNames = fd.getAll("supplierName").map(String);
  const files = fd.getAll("file").filter((f): f is File => f instanceof File);
  if (supplierNames.length !== files.length) {
    return NextResponse.json({ error: "supplierName/file Anzahl mismatch" }, { status: 400 });
  }
  if (files.length > 10) return NextResponse.json({ error: "max 10 Angebote" }, { status: 400 });

  const aiProviderRaw = String(fd.get("aiProvider") || "claude");
  const aiProvider = aiProviderRaw === "gemini" ? "gemini" : "claude";

  // Optional: RFQ-Scope (Step 0 — vom /rfq-extract endpoint vorab vorbereitet)
  let rfqScope: object | null = null;
  let rfqOriginalFilename: string | null = null;
  let rfqMimeType: string | null = null;
  let rfqFileSize: number | null = null;
  let rfqExtractedText: string | null = null;
  let rfqInputTokens: number | null = null;
  let rfqOutputTokens: number | null = null;
  let rfqExtractModel: string | null = null;

  const rfqScopeRaw = String(fd.get("rfqScope") || "");
  if (rfqScopeRaw) {
    try { rfqScope = JSON.parse(rfqScopeRaw); }
    catch { return NextResponse.json({ error: "rfqScope invalid JSON" }, { status: 400 }); }
    rfqOriginalFilename = String(fd.get("rfqOriginalFilename") || "") || null;
    rfqMimeType = String(fd.get("rfqMimeType") || "") || null;
    rfqFileSize = Number(fd.get("rfqFileSize") || 0) || null;
    rfqExtractedText = String(fd.get("rfqExtractedText") || "") || null;
    rfqInputTokens = Number(fd.get("rfqInputTokens") || 0) || null;
    rfqOutputTokens = Number(fd.get("rfqOutputTokens") || 0) || null;
    rfqExtractModel = String(fd.get("rfqExtractModel") || "") || null;
  }

  const comparison = await prisma.comparison.create({
    data: {
      userId: user.id,
      title,
      customerName: String(fd.get("customerName") || "") || null,
      projectRef: String(fd.get("projectRef") || "") || null,
      backgroundInfo: String(fd.get("backgroundInfo") || "") || null,
      customPrompt: String(fd.get("customPrompt") || "") || null,
      aiProvider,
      status: "DRAFT",
      rfqScope: rfqScope as object | undefined,
      rfqOriginalFilename, rfqMimeType, rfqFileSize, rfqExtractedText,
      rfqInputTokens, rfqOutputTokens, rfqExtractModel,
      rfqExtractedAt: rfqScope ? new Date() : null,
    },
  });

  // Pro Datei: speichern + Text extrahieren + Offer-Record
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const supplierName = supplierNames[i] || `Lieferant ${i + 1}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { storageKey, size } = await saveOfferFile(comparison.id, file.name, buf);
    let extractedText: string | null = null;
    let parsedAt: Date | null = null;
    try {
      extractedText = await extractText(buf, file.type, file.name);
      parsedAt = new Date();
    } catch (e) {
      extractedText = `[Extraktion-Fehler: ${(e as Error).message}]`;
    }
    await prisma.offer.create({
      data: {
        comparisonId: comparison.id,
        supplierName,
        originalFilename: file.name,
        storageKey,
        mimeType: file.type || "application/pdf",
        fileSize: size,
        extractedText,
        parsedAt,
      },
    });
  }

  // Direkt KI starten?
  const shouldRun = fd.get("run") === "1";
  if (shouldRun && files.length >= 2) {
    // Trigger via interner fetch — non-blocking ist nicht moeglich in Vercel-style;
    // wir warten synchron weil Server-Action-User darauf wartet.
    try {
      const { runAnalysis } = await import("./run-helper");
      await runAnalysis(comparison.id);
    } catch (e) {
      console.warn("[comparison] sofort-run fehlgeschlagen:", (e as Error).message);
    }
  }

  return NextResponse.json({ id: comparison.id, status: comparison.status }, { status: 201 });
}

export const POST = withIdempotency(_POST_handler, { appName: "angebotsvergleich" });
