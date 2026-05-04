import { prisma } from "@/lib/db";
import { isClaudeConfigured, mockComparison, runClaudeComparison } from "@/lib/claude";

/** Konvention §15.1 (2026-05-04): Synchrone KI-Analyse mit Optimistic-Update auf Comparison. */
export async function runAnalysis(comparisonId: string): Promise<void> {
  // 1) Status PROCESSING
  await prisma.comparison.update({
    where: { id: comparisonId },
    data: { status: "PROCESSING", errorMessage: null, updatedAt: new Date() },
  });

  try {
    const c = await prisma.comparison.findUnique({
      where: { id: comparisonId },
      include: { offers: true },
    });
    if (!c) throw new Error("Comparison not found");
    if (c.offers.length < 2) throw new Error("Mindestens 2 Angebote noetig");

    const offerInputs = c.offers.map((o) => ({
      supplierName: o.supplierName,
      filename: o.originalFilename,
      extractedText: o.extractedText || `[Kein extrahierter Text — Datei: ${o.originalFilename}]`,
    }));

    let result, meta;
    if (isClaudeConfigured()) {
      const r = await runClaudeComparison(offerInputs, c.backgroundInfo || "", c.customPrompt || "");
      result = r.result;
      meta = r.meta;
    } else {
      result = mockComparison(offerInputs);
      meta = { model: "mock", inputTokens: 0, outputTokens: 0, runMs: 0 };
    }

    // Map Ranking → Offer-Updates
    let winnerOfferId: string | null = null;
    if (result.ranking) {
      for (const r of result.ranking) {
        const offer = c.offers.find((o) => o.supplierName.toLowerCase().trim() === r.supplier.toLowerCase().trim());
        if (!offer) continue;
        await prisma.offer.update({
          where: { id: offer.id },
          data: {
            ranking: r.rank,
            scoreTotal: r.scoreTotal,
            scorePrice: r.scorePrice,
            scoreDelivery: r.scoreDelivery,
            scoreQuality: r.scoreQuality,
            scoreService: r.scoreService,
            totalNet: r.totalNet ?? null,
            currency: r.currency || "EUR",
            deliveryDays: r.deliveryDays ?? null,
            paymentTerms: r.paymentTerms || null,
            inkoterm: r.inkoterm || null,
          },
        });
        if (r.rank === 1) winnerOfferId = offer.id;
      }
    }

    await prisma.comparison.update({
      where: { id: comparisonId },
      data: {
        status: "DONE",
        resultSummary: result.summary,
        resultJson: result as unknown as object,
        winnerOfferId,
        claudeModel: meta.model,
        claudeInputTokens: meta.inputTokens,
        claudeOutputTokens: meta.outputTokens,
        claudeRunMs: meta.runMs,
      },
    });

    // Konvention §13: Notify-Hook (silent, ohne hard failure)
    notifyDone(comparisonId).catch(() => { /* ignore */ });
  } catch (e) {
    await prisma.comparison.update({
      where: { id: comparisonId },
      data: { status: "ERROR", errorMessage: (e as Error).message },
    });
    throw e;
  }
}

const NOTIFICATIONS_API = process.env.NOTIFICATIONS_API_URL || "http://127.0.0.1:3001";
const SERVICE_TOKEN = process.env.NOTIFICATIONS_SERVICE_TOKEN || "";

async function notifyDone(comparisonId: string) {
  if (!SERVICE_TOKEN) return;
  const c = await prisma.comparison.findUnique({
    where: { id: comparisonId },
    include: { user: { select: { email: true } } },
  });
  if (!c?.user?.email) return;
  const recipientUsername = c.user.email.split("@")[0];
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    await fetch(`${NOTIFICATIONS_API}/api/notifications/inbox`, {
      method: "POST",
      headers: { "x-service-token": SERVICE_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientUsername,
        sourceApp: "angebotsvergleich",
        type: "INFO",
        title: `Angebotsvergleich fertig: ${c.title}`,
        message: c.resultSummary || "KI-Analyse abgeschlossen",
        actionUrl: `/angebotsvergleich/${comparisonId}`,
      }),
      signal: ctrl.signal,
    });
  } catch { /* ignore */ } finally { clearTimeout(timer); }
}
