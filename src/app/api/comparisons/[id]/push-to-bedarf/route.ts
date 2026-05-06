import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { readOfferFile } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BEDARF_URL = process.env.BEDARFSANMELDUNG_API_URL || "http://host.docker.internal:4104";
const SERVICE_TOKEN = process.env.BEDARFSANMELDUNG_INBOX_TOKEN || "";

/**
 * POST /api/comparisons/[id]/push-to-bedarf
 *
 * Body: {
 *   offerId: string,             // welcher Lieferant gewaehlt (nicht zwingend KI-Sieger)
 *   projektnr: string,
 *   lieferort: "DUI" | "EUS",
 *   menge?: number,              // override (default: bedarfMenge aus Ranking)
 *   einheit?: string,            // override
 *   bemerkung?: string,
 * }
 *
 * Konvention §8 (Inter-App-Inbox):
 *  - eigener Service-Token via BEDARFSANMELDUNG_INBOX_TOKEN
 *  - x-service-token Header
 *  - Empfaenger-Inbox validiert Body + speichert als pending
 *  - User in Bedarfsanmeldung-App muss accepten
 */
async function _POST_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  if (!SERVICE_TOKEN) {
    return NextResponse.json({ error: "BEDARFSANMELDUNG_INBOX_TOKEN nicht konfiguriert (Server-Setup)" }, { status: 503 });
  }

  const body = await req.json().catch(() => null) as {
    offerId?: string; projektnr?: string; lieferort?: string;
    menge?: number; einheit?: string; bemerkung?: string;
  } | null;
  if (!body?.offerId || !body?.projektnr || !body?.lieferort) {
    return NextResponse.json({ error: "offerId, projektnr, lieferort erforderlich" }, { status: 400 });
  }
  if (!["DUI", "EUS"].includes(body.lieferort)) {
    return NextResponse.json({ error: "lieferort muss DUI oder EUS sein" }, { status: 400 });
  }

  const c = await prisma.comparison.findUnique({
    where: { id },
    include: { offers: true },
  });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "DONE") return NextResponse.json({ error: "Vergleich noch nicht abgeschlossen" }, { status: 409 });

  const offer = c.offers.find((o) => o.id === body.offerId);
  if (!offer) return NextResponse.json({ error: "Offer nicht in diesem Vergleich" }, { status: 400 });

  // Ranking-Item finden um bedarfFelder zu holen
  type Ranking = { supplier: string; bedarfArtikelnummer?: string | null; bedarfHersteller?: string | null; bedarfSpezifikation?: string | null; bedarfEinheit?: string | null; bedarfBeschreibung?: string | null; bedarfMenge?: number | null };
  const result = c.resultJson as { ranking?: Ranking[] } | null;
  const rankingItem = result?.ranking?.find((r) => r.supplier.toLowerCase().trim() === offer.supplierName.toLowerCase().trim()) ||
    result?.ranking?.find((r) => r.supplier.toLowerCase().includes(offer.supplierName.toLowerCase()) || offer.supplierName.toLowerCase().includes(r.supplier.toLowerCase()));

  // Payload zusammenbauen — UI overrides haben Vorrang
  const payload = {
    projektnr: body.projektnr.trim(),
    pos: undefined,
    benoetigteMenge: body.menge ?? rankingItem?.bedarfMenge ?? 1,
    einheit: (body.einheit || rankingItem?.bedarfEinheit || "Stk").trim(),
    beschreibung: (rankingItem?.bedarfBeschreibung || c.title).slice(0, 200),
    artikelnummer: rankingItem?.bedarfArtikelnummer || undefined,
    spezifikation: rankingItem?.bedarfSpezifikation || c.backgroundInfo?.slice(0, 500) || undefined,
    hersteller: rankingItem?.bedarfHersteller || undefined,
    bemerkung: body.bemerkung || `Aus Angebotsvergleich "${c.title}" — Lieferant gewaehlt: ${offer.supplierName}${offer.totalNet ? ` (${offer.totalNet} ${offer.currency || "EUR"})` : ""}`,
    anforderer: user.name || user.email,
    lieferort: body.lieferort,
    lieferant: offer.supplierName,
    kunde: c.customerName || undefined,
  };

  // Konvention §8.2: Original-PDF des gewaehlten Angebots als attachment mitsenden
  // damit Empfaenger-App eigene Auswertung machen kann
  const attachments: Array<{ filename: string; mimeType?: string; base64: string }> = [];
  try {
    const buf = await readOfferFile(offer.storageKey);
    if (buf.length < 25 * 1024 * 1024) {  // max 25 MB
      attachments.push({
        filename: offer.originalFilename,
        mimeType: offer.mimeType || "application/pdf",
        base64: buf.toString("base64"),
      });
    }
  } catch (e) {
    console.warn(`[push-to-bedarf] PDF-Attachment failed for ${offer.id}: ${(e as Error).message}`);
  }

  // Inbox-Push
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch(`${BEDARF_URL}/bedarfsanmeldung/api/inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-service-token": SERVICE_TOKEN },
      body: JSON.stringify({
        fromApp: "angebotsvergleich",
        type: "offerOrder",
        fromUserId: user.id,
        fromUserName: user.name || user.email,
        refUrl: `/angebotsvergleich/${id}`,
        payload,
        attachments,
      }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json({ error: data.message || data.error || `HTTP ${res.status}` }, { status: 502 });
    }
    return NextResponse.json({ ok: true, inboxId: data.id || null, payload, attachmentsCount: attachments.length });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}

export const POST = withIdempotency(_POST_handler, { appName: "angebotsvergleich" });
