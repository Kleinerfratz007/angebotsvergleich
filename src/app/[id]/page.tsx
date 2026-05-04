import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, FileText, Trophy, AlertCircle, RotateCw, Coins, FileDown, AlertTriangle } from "lucide-react";
import RunButton from "./run-button";
import RankingTable from "./ranking-table";
import FollowupChat from "./followup-chat";
import { computeCost, formatEur } from "@/lib/pricing";
import { RichText, RichBullets } from "@/lib/rich-text";

export const dynamic = "force-dynamic";

interface ResultJson {
  ranking?: Array<Record<string, unknown> & { supplier: string; rank: number; scoreTotal: number; scorePrice: number; scoreDelivery: number; scoreQuality: number; scoreService: number; pros: string[]; cons: string[] }>;
  normalizedPositions?: Array<{ supplier: string; description: string; normalizedDescription: string; category: string; quantity: number; unit: string; pricePerUnit: number; totalPrice: number; isEol?: boolean; uniqueToSupplier?: boolean }>;
  insights?: string[];
  recommendations?: string[];
  caveats?: string[];
  insightsByCategory?: Array<{ category: string; items: string[] }>;
  sensitivity?: string[];
  paretoNotes?: string[];
  winnerReason?: string;
}

export default async function ComparisonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  const { id } = await params;
  const c = await prisma.comparison.findUnique({
    where: { id },
    include: {
      offers: { orderBy: { ranking: "asc" } },
      followups: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c || c.userId !== user.id) notFound();

  const result = (c.resultJson as unknown as ResultJson | null) || null;
  const inputTokens = c.claudeInputTokens || 0;
  const outputTokens = c.claudeOutputTokens || 0;
  const modelOnly = (c.claudeModel || "").includes(":") ? (c.claudeModel as string).split(":")[1] : (c.claudeModel || "claude-opus-4-7");
  const cost = computeCost({ model: modelOnly, inputTokens, outputTokens });
  const followupCostEur = c.followups.reduce((sum, f) => sum + Number(f.costEur), 0);
  const totalCostEur = cost.costEur + followupCostEur;

  const offerCount = c.offers.length;
  const rankingCount = result?.ranking?.length || 0;
  const missingFromRanking = c.status === "DONE" && rankingCount < offerCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="opacity-60 hover:opacity-100"><ArrowLeft size={20} /></Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{c.title}</h1>
            <div className="text-xs opacity-60 flex flex-wrap gap-2">
              {c.customerName && <span>{c.customerName}</span>}
              {c.projectRef && <span>· Projekt {c.projectRef}</span>}
              <span>· {offerCount} Angebote hochgeladen</span>
              {c.claudeModel && <span>· {c.claudeModel}</span>}
              {c.claudeRunMs && <span>· KI-Laufzeit {(c.claudeRunMs / 1000).toFixed(1)}s</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {c.status === "DONE" && (
            <a href={`/angebotsvergleich/api/comparisons/${c.id}/report.pdf`} target="_blank" rel="noopener" className="btn btn-ghost"><FileDown size={14} /> Als PDF</a>
          )}
        </div>
      </div>

      {c.status === "PROCESSING" && (
        <div className="card text-center py-8" style={{ background: "rgb(219 234 254)" }}>
          <Sparkles size={28} className="mx-auto mb-2 animate-pulse text-blue-600" />
          <p className="font-medium">Claude Opus laeuft…</p>
          <p className="text-xs opacity-70 mt-1">Das kann 20-90 Sekunden dauern bei {offerCount} Angeboten.</p>
          <a href={`/${c.id}`} className="btn btn-ghost mt-3 inline-flex"><RotateCw size={14} /> Status aktualisieren</a>
        </div>
      )}

      {c.status === "ERROR" && c.errorMessage && (
        <div className="card text-red-700" style={{ background: "rgb(254 226 226)", borderColor: "rgb(252 165 165)" }}>
          <div className="flex items-center gap-2 font-semibold mb-1"><AlertCircle size={18} /> Fehler bei der KI-Analyse</div>
          <pre className="text-xs whitespace-pre-wrap">{c.errorMessage}</pre>
          {c.offers.length >= 2 && <RunButton comparisonId={c.id} label="Erneut versuchen" />}
        </div>
      )}

      {c.status === "DRAFT" && c.offers.length < 2 && (
        <div className="card text-amber-800" style={{ background: "rgb(254 243 199)" }}>
          <div className="flex items-center gap-2"><AlertCircle size={18} /> Mindestens 2 Angebote werden fuer einen Vergleich benoetigt. Aktuell: {offerCount}.</div>
        </div>
      )}

      {c.status === "DRAFT" && c.offers.length >= 2 && (
        <div className="card text-center py-6" style={{ background: "rgb(243 232 255)" }}>
          <Sparkles size={28} className="mx-auto mb-2 text-purple-600" />
          <p className="font-medium mb-3">Bereit zur KI-Analyse — {offerCount} Angebote vorbereitet.</p>
          <RunButton comparisonId={c.id} label="KI-Analyse starten" />
        </div>
      )}

      {result && c.status === "DONE" && (
        <>
          {/* 1) WINNER */}
          {result.ranking && result.ranking[0] && (
            <div className="card border-yellow-300" style={{ background: "linear-gradient(135deg, rgb(254 249 195) 0%, rgb(255 255 255) 100%)" }}>
              <div className="flex items-start gap-3">
                <Trophy size={32} className="text-yellow-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs opacity-70 uppercase">Sieger</div>
                  <div className="text-xl font-bold">{(result.ranking[0] as { supplier: string }).supplier}</div>
                  <div className="text-sm mt-1">
                    Score {(result.ranking[0] as { scoreTotal: number }).scoreTotal}/100
                    {(result.ranking[0] as { totalNet?: number | null }).totalNet && ` · ${(result.ranking[0] as { totalNet?: number }).totalNet!.toLocaleString("de-DE")} ${(result.ranking[0] as { currency?: string }).currency || "EUR"} netto`}
                    {(result.ranking[0] as { deliveryDays?: number | null }).deliveryDays && ` · ${(result.ranking[0] as { deliveryDays?: number }).deliveryDays!} Tage Lieferzeit`}
                  </div>
                  {c.resultSummary && (
                    <p className="text-sm mt-3 opacity-90"><RichText text={c.resultSummary} /></p>
                  )}
                  {result.winnerReason && (
                    <p className="text-sm mt-2 opacity-80"><RichText text={result.winnerReason} /></p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 2) FOLLOWUP — direkt unter Sieger, prominent */}
          <FollowupChat
            comparisonId={c.id}
            initialFollowups={c.followups.map((f) => ({
              id: f.id,
              prompt: f.prompt,
              response: f.response,
              costEur: Number(f.costEur),
              createdAt: f.createdAt.toISOString(),
              userName: f.userName,
              hasUpdate: Boolean(f.resultJson),
            }))}
          />

          {/* 3) RE-RUN */}
          {c.offers.length >= 2 && (
            <div className="card flex items-center justify-between gap-3 flex-wrap" style={{ background: "rgb(248 250 252)" }}>
              <div className="text-sm">
                <span className="font-semibold">Komplette Neu-Analyse?</span>
                <span className="opacity-70 block text-xs mt-1">
                  Falls Angebote getauscht oder Hintergrund-Info geaendert wurde — startet einen frischen KI-Lauf
                  (kostet ca. {formatEur(cost.costEur)}). Bestehender Run wird ueberschrieben.
                </span>
              </div>
              <RunButton comparisonId={c.id} label="Erneut analysieren" />
            </div>
          )}

          {/* 3a) WARNUNG: nicht alle Angebote im Ranking */}
          {missingFromRanking && (
            <div className="card text-amber-800" style={{ background: "rgb(254 243 199)", borderColor: "rgb(252 211 77)" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-semibold">Nur {rankingCount} von {offerCount} Angeboten im Ranking.</div>
                  <p className="text-xs mt-1">
                    Ein aelterer Run hat ein PDF moeglicherweise als Anfrage statt Angebot eingestuft. Klicke <strong>"Erneut analysieren"</strong> — ab v0.2 werden ALLE Angebote zwingend ins Ranking aufgenommen.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4) RANKING */}
          {result.ranking && (
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            <RankingTable ranking={result.ranking as any} />
          )}

          {/* 5) INSIGHTS gruppiert (mit RichText) */}
          {(result.insightsByCategory && result.insightsByCategory.length > 0) ? (
            <div className="grid md:grid-cols-2 gap-3">
              {result.insightsByCategory.map((g, i) => (
                <div key={i} className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">{g.category}</h3>
                  <RichBullets items={g.items} className="text-sm" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-3">
              {result.insights && result.insights.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">📊 Erkenntnisse</h3>
                  <RichBullets items={result.insights} className="text-sm" />
                </div>
              )}
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">💡 Empfehlungen</h3>
                  <RichBullets items={result.recommendations} className="text-sm" />
                </div>
              )}
              {result.caveats && result.caveats.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">⚠️ Vorbehalte</h3>
                  <RichBullets items={result.caveats} className="text-sm" />
                </div>
              )}
            </div>
          )}

          {/* 6) SENSITIVITY + PARETO */}
          {((result.sensitivity && result.sensitivity.length > 0) || (result.paretoNotes && result.paretoNotes.length > 0)) && (
            <div className="grid md:grid-cols-2 gap-3">
              {result.sensitivity && result.sensitivity.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">🎯 Sensitivitaet</h3>
                  <RichBullets items={result.sensitivity} className="text-sm" />
                </div>
              )}
              {result.paretoNotes && result.paretoNotes.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">📈 Pareto-Analyse</h3>
                  <RichBullets items={result.paretoNotes} className="text-sm" />
                </div>
              )}
            </div>
          )}

          {/* 7) Recommendations + Caveats falls insightsByCategory genutzt */}
          {result.insightsByCategory && (
            <div className="grid md:grid-cols-2 gap-3">
              {result.recommendations && result.recommendations.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">💡 Empfehlungen</h3>
                  <RichBullets items={result.recommendations} className="text-sm" />
                </div>
              )}
              {result.caveats && result.caveats.length > 0 && (
                <div className="card">
                  <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">⚠️ Vorbehalte</h3>
                  <RichBullets items={result.caveats} className="text-sm" />
                </div>
              )}
            </div>
          )}

          {/* 8) NORMALISIERTE POSITIONEN */}
          {result.normalizedPositions && result.normalizedPositions.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="font-semibold mb-3">Normalisierte Positionen</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                    <th className="text-left p-2">Lieferant</th>
                    <th className="text-left p-2">Beschreibung</th>
                    <th className="text-left p-2">Kategorie</th>
                    <th className="text-right p-2">Menge</th>
                    <th className="text-right p-2">€/Einheit</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-left p-2">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {result.normalizedPositions.map((p, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                      <td className="p-2">{p.supplier}</td>
                      <td className="p-2">{p.normalizedDescription || p.description}</td>
                      <td className="p-2 opacity-70">{p.category}</td>
                      <td className="p-2 text-right font-mono">{p.quantity?.toLocaleString("de-DE")} {p.unit}</td>
                      <td className="p-2 text-right font-mono">{p.pricePerUnit?.toLocaleString("de-DE")}</td>
                      <td className="p-2 text-right font-mono">{p.totalPrice?.toLocaleString("de-DE")}</td>
                      <td className="p-2 text-xs">
                        {p.isEol && <span className="badge" style={{ background: "rgb(254 226 226)", color: "rgb(153 27 27)" }}>EOL</span>}
                        {p.uniqueToSupplier && <span className="badge ml-1" style={{ background: "rgb(254 249 195)", color: "rgb(146 64 14)" }}>Unique</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Hochgeladene Angebote */}
      <div className="card">
        <h2 className="font-semibold mb-3">Hochgeladene Angebote ({c.offers.length})</h2>
        <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
          {c.offers.map((o) => (
            <li key={o.id} className="py-2 flex items-center gap-2 text-sm">
              <FileText size={16} className="opacity-50 shrink-0" />
              <span className="font-medium">{o.supplierName}</span>
              <span className="opacity-60 text-xs truncate hidden md:block">{o.originalFilename}</span>
              <span className="opacity-60 text-xs ml-auto">{(o.fileSize / 1024).toFixed(0)} KB</span>
              {o.ranking === 1 && <Trophy size={14} className="text-yellow-600" />}
              {o.ranking && o.ranking > 1 && <span className="badge text-xs">#{o.ranking}</span>}
              {!o.ranking && c.status === "DONE" && <span className="badge text-xs" style={{ background: "rgb(254 226 226)", color: "rgb(153 27 27)" }}>nicht im Ranking</span>}
            </li>
          ))}
        </ul>
      </div>

      {(c.backgroundInfo || c.customPrompt) && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-sm">Eingaben fuer KI</summary>
          {c.backgroundInfo && (
            <div className="mt-2">
              <div className="text-xs opacity-70">Hintergrund-Info</div>
              <p className="text-sm whitespace-pre-wrap">{c.backgroundInfo}</p>
            </div>
          )}
          {c.customPrompt && (
            <div className="mt-2">
              <div className="text-xs opacity-70">Spezielle Hinweise</div>
              <p className="text-sm whitespace-pre-wrap">{c.customPrompt}</p>
            </div>
          )}
        </details>
      )}

      {c.status === "DONE" && (
        <div className="card flex items-center justify-between text-xs flex-wrap gap-2" style={{ background: "rgb(243 232 255)" }}>
          <div className="flex items-center gap-2">
            <Coins size={14} className="text-purple-700" />
            <span className="font-semibold">Kosten dieses Vergleichs:</span>
            <span className="font-mono">{formatEur(totalCostEur)}</span>
            <span className="opacity-60">({inputTokens.toLocaleString("de-DE")} in / {outputTokens.toLocaleString("de-DE")} out tokens · {c.followups.length} Follow-ups)</span>
          </div>
          <a href="/angebotsvergleich/kosten" className="text-purple-700 hover:underline">Alle Kosten →</a>
        </div>
      )}
    </div>
  );
}
