import { prisma } from "@/lib/db";
import { type AiProvider, DEFAULT_PROVIDER, runAiComparison } from "@/lib/ai-provider";
import { logUsage } from "@/lib/usage-log";
import type { ClaudeComparisonResult } from "@/lib/claude";

/**
 * Konvention §15.1+§15.2 (2026-05-04): Synchrone Multi-Provider KI-Analyse.
 * Erweitert 2026-05-04: AiUsage-Logging + tolerantes Supplier-Matching +
 * Sicherstellung dass alle Angebote im Ranking landen.
 */
export async function runAnalysis(comparisonId: string): Promise<void> {
  await prisma.comparison.update({
    where: { id: comparisonId },
    data: { status: "PROCESSING", errorMessage: null, updatedAt: new Date() },
  });

  let runMs = 0;
  let providerName: AiProvider = "claude";
  let modelName = "(unknown)";
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreateTokens = 0;
  let userIdForLog = "";
  let userNameForLog = "";
  let userEmailForLog = "";

  try {
    const c = await prisma.comparison.findUnique({
      where: { id: comparisonId },
      include: { offers: true, user: { select: { id: true, name: true, email: true } } },
    });
    if (!c) throw new Error("Comparison not found");
    if (c.offers.length < 2) throw new Error("Mindestens 2 Angebote noetig");

    userIdForLog = c.user.id;
    userNameForLog = c.user.name || c.user.email;
    userEmailForLog = c.user.email;

    const offerInputs = c.offers.map((o) => ({
      supplierName: o.supplierName,
      filename: o.originalFilename,
      extractedText: o.extractedText || `[Kein extrahierter Text — Datei: ${o.originalFilename}]`,
    }));

    providerName = (c.aiProvider as AiProvider) || DEFAULT_PROVIDER;
    const aiResult = await runAiComparison(providerName, offerInputs, c.backgroundInfo || "", c.customPrompt || "");
    const result = aiResult.result;
    modelName = aiResult.meta.model;
    inputTokens = aiResult.meta.inputTokens;
    outputTokens = aiResult.meta.outputTokens;
    cacheReadTokens = aiResult.meta.cacheReadTokens || 0;
    cacheCreateTokens = aiResult.meta.cacheCreateTokens || 0;
    runMs = aiResult.meta.runMs;

    // 1) Stelle sicher dass alle Angebote im Ranking sind (Claude vergisst manchmal eines)
    const ensuredResult = ensureAllOffersInRanking(result, offerInputs);

    // 2) Toleranter Mapping: Substring-Match wenn exact-match scheitert
    let winnerOfferId: string | null = null;
    if (ensuredResult.ranking) {
      for (const r of ensuredResult.ranking) {
        const offer = matchOffer(c.offers, r.supplier);
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
        resultSummary: ensuredResult.summary,
        resultJson: ensuredResult as unknown as object,
        winnerOfferId,
        claudeModel: `${providerName}:${modelName}`,
        claudeInputTokens: inputTokens,
        claudeOutputTokens: outputTokens,
        claudeRunMs: runMs,
      },
    });

    // Cost-Tracking persistieren (immer, auch bei Erfolg)
    await logUsage({
      userId: userIdForLog,
      userName: userNameForLog,
      userEmail: userEmailForLog,
      comparisonId,
      provider: providerName,
      model: modelName,
      kind: "comparison",
      inputTokens, outputTokens, cacheReadTokens, cacheCreateTokens,
      runMs,
    });

    notifyDone(comparisonId).catch(() => { /* ignore */ });
  } catch (e) {
    const errMsg = (e as Error).message;
    await prisma.comparison.update({
      where: { id: comparisonId },
      data: { status: "ERROR", errorMessage: errMsg },
    });
    // Selbst bei Fehler: Tokens loggen wenn vorhanden (ggf. teilweise verbraucht)
    if (userIdForLog && (inputTokens || outputTokens)) {
      await logUsage({
        userId: userIdForLog, userName: userNameForLog, userEmail: userEmailForLog,
        comparisonId, provider: providerName, model: modelName, kind: "comparison",
        inputTokens, outputTokens, cacheReadTokens, cacheCreateTokens, runMs,
        errorMessage: errMsg,
      });
    }
    throw e;
  }
}

/** Match supplier-name aus Ranking auf eine Offer (Exact -> Substring -> Position). */
function matchOffer<T extends { id: string; supplierName: string }>(offers: T[], supplier: string): T | null {
  const want = supplier.toLowerCase().trim();
  // 1) exakt
  let match = offers.find((o) => o.supplierName.toLowerCase().trim() === want);
  if (match) return match;
  // 2) substring (entweder Richtung)
  match = offers.find((o) => {
    const have = o.supplierName.toLowerCase().trim();
    return have.includes(want) || want.includes(have);
  });
  if (match) return match;
  // 3) erstes Wort
  const firstWord = want.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3) {
    match = offers.find((o) => o.supplierName.toLowerCase().includes(firstWord));
    if (match) return match;
  }
  return null;
}

/** Stelle sicher dass jedes Angebot im Ranking erscheint — fehlende auffuellen. */
function ensureAllOffersInRanking(
  result: ClaudeComparisonResult,
  offers: Array<{ supplierName: string; filename: string }>,
): ClaudeComparisonResult {
  const ranking = Array.isArray(result.ranking) ? [...result.ranking] : [];

  // WICHTIG: Wenn die KI mindestens so viele Items wie Angebote zurueckgegeben hat,
  // gehen wir davon aus dass sie alle abgedeckt sind (KI verwendet oft echte
  // Lieferantennamen statt der Default-Filenames). Kein doppeltes Auffuellen!
  if (ranking.length >= offers.length) return { ...result, ranking };

  // Sonst: fehlende per Position auffuellen (jedes nicht gematchte offer einmal)
  // Match-Strategie: Substring-Match in beide Richtungen, plus exact-match.
  const matchedOffers = new Set<number>();
  for (const r of ranking) {
    const want = r.supplier.toLowerCase().trim();
    for (let i = 0; i < offers.length; i++) {
      if (matchedOffers.has(i)) continue;
      const have = offers[i].supplierName.toLowerCase().trim();
      if (have === want || have.includes(want) || want.includes(have)) {
        matchedOffers.add(i);
        break;
      }
    }
  }

  // Falls weniger Matches als ranking-Items existieren, ist die Differenz
  // wahrscheinlich auf KI-Renaming zurueckzufuehren — wir nehmen positionsbasiert
  // die uebrigen Offers in der Reihenfolge ihres Hochladens auf.
  const unmatchedOffers = offers.filter((_, i) => !matchedOffers.has(i));
  // Aber nur so viele auffuellen wie tatsaechlich fehlen
  const needToAdd = offers.length - ranking.length;
  let nextRank = ranking.length + 1;
  for (let i = 0; i < Math.min(needToAdd, unmatchedOffers.length); i++) {
    const o = unmatchedOffers[i];
    ranking.push({
      supplier: o.supplierName,
      rank: nextRank++,
      scoreTotal: 0, scorePrice: 0, scoreDelivery: 0, scoreQuality: 0, scoreService: 0,
      totalNet: null, currency: "EUR", deliveryDays: null,
      pros: [],
      cons: [`Konnte aus dieser PDF (${o.filename}) keine vergleichbaren Daten extrahieren — ggf. ist es kein vollstaendiges Angebot oder die Extraktion hat versagt.`],
      coveragePct: 0, extraCosts: [], eolWarnings: [], substitutions: [],
      compliance: {}, riskFlags: ["Keine Daten extrahiert"],
    });
  }

  return { ...result, ranking };
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
