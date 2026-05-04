import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles, FileText, Trophy, AlertCircle, RotateCw } from "lucide-react";
import RunButton from "./run-button";

export const dynamic = "force-dynamic";

interface RankingItem {
  supplier: string;
  rank: number;
  scoreTotal: number;
  scorePrice: number;
  scoreDelivery: number;
  scoreQuality: number;
  scoreService: number;
  totalNet?: number | null;
  currency?: string;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  inkoterm?: string | null;
  pros: string[];
  cons: string[];
}

interface NormPos {
  supplier: string;
  description: string;
  normalizedDescription: string;
  category: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
  normalizedPpu?: number;
}

interface ResultJson {
  ranking?: RankingItem[];
  normalizedPositions?: NormPos[];
  insights?: string[];
  recommendations?: string[];
  caveats?: string[];
  winnerReason?: string;
}

export default async function ComparisonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  const { id } = await params;
  const c = await prisma.comparison.findUnique({
    where: { id },
    include: { offers: { orderBy: { ranking: "asc" } } },
  });
  if (!c || c.userId !== user.id) notFound();

  const result = (c.resultJson as ResultJson | null) || null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/" className="opacity-60 hover:opacity-100"><ArrowLeft size={20} /></Link>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{c.title}</h1>
            <div className="text-xs opacity-60 flex flex-wrap gap-2">
              {c.customerName && <span>{c.customerName}</span>}
              {c.projectRef && <span>· Projekt {c.projectRef}</span>}
              <span>· {c.offers.length} Angebote</span>
              {c.claudeModel && <span>· {c.claudeModel}</span>}
              {c.claudeRunMs && <span>· KI-Laufzeit {(c.claudeRunMs / 1000).toFixed(1)}s</span>}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {(c.status === "DRAFT" || c.status === "ERROR" || c.status === "DONE") && c.offers.length >= 2 && (
            <RunButton comparisonId={c.id} label={c.status === "DONE" ? "Erneut analysieren" : "KI-Analyse starten"} />
          )}
        </div>
      </div>

      {c.status === "PROCESSING" && (
        <div className="card text-center py-8" style={{ background: "rgb(219 234 254)" }}>
          <Sparkles size={28} className="mx-auto mb-2 animate-pulse text-blue-600" />
          <p className="font-medium">Claude Opus laeuft…</p>
          <p className="text-xs opacity-70 mt-1">Das kann 20-90 Sekunden dauern bei {c.offers.length} Angeboten.</p>
          <a href={`/${c.id}`} className="btn btn-ghost mt-3 inline-flex"><RotateCw size={14} /> Status aktualisieren</a>
        </div>
      )}

      {c.status === "ERROR" && c.errorMessage && (
        <div className="card text-red-700" style={{ background: "rgb(254 226 226)", borderColor: "rgb(252 165 165)" }}>
          <div className="flex items-center gap-2 font-semibold mb-1"><AlertCircle size={18} /> Fehler bei der KI-Analyse</div>
          <pre className="text-xs whitespace-pre-wrap">{c.errorMessage}</pre>
        </div>
      )}

      {result && c.status === "DONE" && (
        <>
          {/* Winner Card */}
          {result.ranking && result.ranking[0] && (
            <div className="card border-yellow-300" style={{ background: "linear-gradient(135deg, rgb(254 249 195) 0%, rgb(255 255 255) 100%)" }}>
              <div className="flex items-start gap-3">
                <Trophy size={32} className="text-yellow-600 shrink-0" />
                <div className="flex-1">
                  <div className="text-xs opacity-70 uppercase">Sieger</div>
                  <div className="text-xl font-bold">{result.ranking[0].supplier}</div>
                  <div className="text-sm mt-1">
                    Score {result.ranking[0].scoreTotal}/100
                    {result.ranking[0].totalNet && ` · ${result.ranking[0].totalNet.toLocaleString("de-DE")} ${result.ranking[0].currency || "EUR"} netto`}
                    {result.ranking[0].deliveryDays && ` · ${result.ranking[0].deliveryDays} Tage Lieferzeit`}
                  </div>
                  {c.resultSummary && (
                    <p className="text-sm mt-3 opacity-90">{c.resultSummary}</p>
                  )}
                  {result.winnerReason && (
                    <p className="text-sm mt-2 opacity-80">{result.winnerReason}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Ranking Tabelle */}
          {result.ranking && (
            <div className="card overflow-x-auto">
              <h2 className="font-semibold mb-3">Ranking</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                    <th className="text-left p-2">#</th>
                    <th className="text-left p-2">Lieferant</th>
                    <th className="text-right p-2">Total</th>
                    <th className="text-right p-2">Preis</th>
                    <th className="text-right p-2">Lieferung</th>
                    <th className="text-right p-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {result.ranking.map((r) => (
                    <tr key={r.supplier} style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                      <td className="p-2 font-mono">{r.rank}</td>
                      <td className="p-2 font-medium">{r.supplier}</td>
                      <td className="p-2 text-right">{r.totalNet ? `${r.totalNet.toLocaleString("de-DE")} ${r.currency || "EUR"}` : "—"}</td>
                      <td className="p-2 text-right">{r.scorePrice}</td>
                      <td className="p-2 text-right">{r.deliveryDays ? `${r.deliveryDays}d` : "—"}</td>
                      <td className="p-2 text-right font-semibold">{r.scoreTotal}/100</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pros/Cons */}
              <div className="mt-4 grid gap-2">
                {result.ranking.map((r) => (
                  <details key={r.supplier} className="rounded border p-2 text-xs" style={{ borderColor: "rgb(var(--border))" }}>
                    <summary className="cursor-pointer font-medium">{r.supplier} · Pro/Contra</summary>
                    <div className="grid md:grid-cols-2 gap-2 mt-2">
                      <div>
                        <div className="text-green-700 font-semibold mb-1">+ Pro</div>
                        <ul className="list-disc pl-4 space-y-0.5">{r.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                      </div>
                      <div>
                        <div className="text-red-700 font-semibold mb-1">- Contra</div>
                        <ul className="list-disc pl-4 space-y-0.5">{r.cons.map((p, i) => <li key={i}>{p}</li>)}</ul>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}

          {/* Insights / Recommendations / Caveats */}
          <div className="grid md:grid-cols-3 gap-3">
            {result.insights && result.insights.length > 0 && (
              <div className="card">
                <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">📊 Erkenntnisse</h3>
                <ul className="text-sm list-disc pl-4 space-y-1">{result.insights.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {result.recommendations && result.recommendations.length > 0 && (
              <div className="card">
                <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">💡 Empfehlungen</h3>
                <ul className="text-sm list-disc pl-4 space-y-1">{result.recommendations.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
            {result.caveats && result.caveats.length > 0 && (
              <div className="card">
                <h3 className="text-xs font-semibold uppercase opacity-70 mb-2">⚠️ Vorbehalte</h3>
                <ul className="text-sm list-disc pl-4 space-y-1">{result.caveats.map((s, i) => <li key={i}>{s}</li>)}</ul>
              </div>
            )}
          </div>

          {/* Normalisierte Positionen */}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Angebots-Liste (immer sichtbar) */}
      <div className="card">
        <h2 className="font-semibold mb-3">Hochgeladene Angebote</h2>
        <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
          {c.offers.map((o) => (
            <li key={o.id} className="py-2 flex items-center gap-2 text-sm">
              <FileText size={16} className="opacity-50 shrink-0" />
              <span className="font-medium">{o.supplierName}</span>
              <span className="opacity-60 text-xs truncate hidden md:block">{o.originalFilename}</span>
              <span className="opacity-60 text-xs ml-auto">{(o.fileSize / 1024).toFixed(0)} KB</span>
              {o.ranking === 1 && <Trophy size={14} className="text-yellow-600" />}
            </li>
          ))}
        </ul>
      </div>

      {/* Background-Info + Custom-Prompt */}
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
    </div>
  );
}
