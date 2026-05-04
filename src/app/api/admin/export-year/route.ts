import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { readOfferFile } from "@/lib/storage";
import archiver from "archiver";
import { PassThrough } from "node:stream";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * GET /api/admin/export-year?year=2026[&user=alle|<userId>]
 *
 * Konvention §15.9 (2026-05-04, "10-Jahre-Aufbewahrung"):
 * Admin kann on-demand einen ZIP-Pack mit ALLEN Daten eines Jahres
 * herunterladen — Vergleiche + Offers + Followups + AiUsage + PDFs.
 *
 * Format:
 *  pack-<YEAR>.zip/
 *    comparisons.json   — alle Comparisons des Jahres (createdAt year=YEAR)
 *    offers.json        — alle Offers dieser Comparisons
 *    followups.json     — alle Followups dieser Comparisons
 *    usage.json         — alle AiUsage des Jahres
 *    pdfs/<comparisonId>/<originalFilename>  — alle Offer-PDFs
 *    rfq/<comparisonId>.txt — extracted RFQ-Text (falls vorhanden)
 *    README.txt         — Metadaten + Hinweise zur Konvention
 */
export async function GET(req: NextRequest) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const yearStr = new URL(req.url).searchParams.get("year") || "";
  const year = parseInt(yearStr, 10);
  if (!year || year < 2020 || year > 2100) {
    return NextResponse.json({ error: "year=YYYY (2020-2100) erforderlich" }, { status: 400 });
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  // 1) Daten sammeln
  const comparisons = await prisma.comparison.findMany({
    where: { createdAt: { gte: yearStart, lt: yearEnd } },
    include: { user: { select: { name: true, email: true } } },
  });
  const compIds = comparisons.map((c) => c.id);

  const offers = await prisma.offer.findMany({ where: { comparisonId: { in: compIds } } });
  const followups = await prisma.comparisonFollowup.findMany({ where: { comparisonId: { in: compIds } } });

  // AiUsage des Jahres (auch von geloeschten Comparisons mit comparisonId=null)
  const usage = await prisma.aiUsage.findMany({
    where: { createdAt: { gte: yearStart, lt: yearEnd } },
  });

  // 2) ZIP-Stream
  const archive = archiver("zip", { zlib: { level: 6 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  archive.append(
    `Angebotsvergleich Export-Pack ${year}\n` +
    `Erstellt: ${new Date().toISOString()}\n` +
    `Erstellt von: ${user.name} <${user.email}>\n` +
    `Konvention §15.9 — 10-Jahre-Aufbewahrung\n\n` +
    `Inhalt:\n` +
    `  - comparisons.json  (${comparisons.length} Vergleiche)\n` +
    `  - offers.json       (${offers.length} Angebote)\n` +
    `  - followups.json    (${followups.length} Follow-ups)\n` +
    `  - usage.json        (${usage.length} AI-Calls)\n` +
    `  - pdfs/             (PDF-Dateien aller Angebote)\n` +
    `  - rfq/              (RFQ-Texte falls vorhanden)\n\n` +
    `HINWEIS: Daten werden gemaess Konvention 10 Jahre vorgehalten und\n` +
    `koennen erst danach geloescht werden. Dieses Pack ist die offizielle\n` +
    `Archivkopie fuer Jahr ${year}.\n`,
    { name: "README.txt" },
  );

  // JSON-Dumps (mit Decimal->Number Konvertierung)
  archive.append(JSON.stringify(stripDecimals(comparisons), null, 2), { name: "comparisons.json" });
  archive.append(JSON.stringify(stripDecimals(offers), null, 2), { name: "offers.json" });
  archive.append(JSON.stringify(stripDecimals(followups), null, 2), { name: "followups.json" });
  archive.append(JSON.stringify(stripDecimals(usage), null, 2), { name: "usage.json" });

  // PDFs
  for (const o of offers) {
    if (!o.storageKey) continue;
    try {
      const buf = await readOfferFile(o.storageKey);
      archive.append(buf, { name: `pdfs/${o.comparisonId}/${o.originalFilename}` });
    } catch {
      archive.append(`Datei nicht gefunden: ${o.storageKey}`, { name: `pdfs/${o.comparisonId}/_MISSING_${o.originalFilename}.txt` });
    }
  }

  // RFQ-Texte
  for (const c of comparisons) {
    if (c.rfqExtractedText) {
      archive.append(c.rfqExtractedText, { name: `rfq/${c.id}.txt` });
    }
  }

  archive.finalize();

  // Convert PassThrough to ReadableStream for Response
  const readable = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  return new Response(readable, {
    status: 200,
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="angebotsvergleich-pack-${year}.zip"`,
      "cache-control": "no-store",
    },
  });
}

// Prisma Decimal -> Number (sonst broken JSON)
function stripDecimals(arr: unknown[]): unknown[] {
  return arr.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
      if (v && typeof v === "object" && "toNumber" in v && typeof (v as { toNumber?: () => number }).toNumber === "function") {
        out[k] = (v as { toNumber: () => number }).toNumber();
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}
