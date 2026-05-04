"use client";

import { useState, useMemo } from "react";
import { Trophy, AlertTriangle, Filter, ChevronUp, ChevronDown, Power } from "lucide-react";
import PushBedarfButton from "./push-bedarf-button";

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
  coveragePct?: number | null;
  cutCostsEur?: number | null;
  extraCosts?: Array<{ label: string; amountEur: number }>;
  tcoEur?: number | null;
  skontoPct?: number | null;
  skontoDays?: number | null;
  moq?: number | null;
  warrantyMonths?: number | null;
  eolWarnings?: string[];
  substitutions?: string[];
  quantityDeviationPct?: number | null;
  riskFlags?: string[];
  compliance?: { iso9001?: boolean | null; iso14001?: boolean | null; ce?: boolean | null; reach?: boolean | null; rohs?: boolean | null; en10204?: string | null; madeInEU?: boolean | null };
  co2KgPerUnit?: number | null;
  documentationScore?: number | null;
  scoreCompliance?: number | null;
  scoreRisk?: number | null;
  scoreCoverage?: number | null;
}

type SortKey = "rank" | "supplier" | "scoreTotal" | "scorePrice" | "scoreDelivery" | "scoreQuality" | "scoreService" | "totalNet" | "tcoEur" | "deliveryDays" | "coveragePct";
type Dim = "price" | "delivery" | "quality" | "service";

interface DimState { enabled: boolean; weight: number }

const DEFAULT_DIMS: Record<Dim, DimState> = {
  price:    { enabled: false, weight: 40 },
  delivery: { enabled: false, weight: 20 },
  quality:  { enabled: false, weight: 20 },
  service:  { enabled: false, weight: 20 },
};

const DIM_LABEL: Record<Dim, string> = { price: "Preis", delivery: "Lieferung", quality: "Qualität", service: "Service" };

export default function RankingTable({ ranking, comparisonId, offerIdMap, defaultProjekt }: { ranking: RankingItem[]; comparisonId: string; offerIdMap: Record<string, string>; defaultProjekt?: string | null }) {
  const [dims, setDims] = useState<Record<Dim, DimState>>(DEFAULT_DIMS);
  const [filterCompliance, setFilterCompliance] = useState<{ iso9001: boolean; ce: boolean; madeInEU: boolean; noEol: boolean }>({ iso9001: false, ce: false, madeInEU: false, noEol: false });
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const anyDimEnabled = (Object.keys(dims) as Dim[]).some((k) => dims[k].enabled);

  // Custom-Score = gewichteter Mittelwert aus AKTIVIERTEN Dimensionen
  const withCustomScore = useMemo(() => {
    if (!anyDimEnabled) return ranking.map((r) => ({ ...r, customScore: r.scoreTotal }));
    const enabled = (Object.keys(dims) as Dim[]).filter((k) => dims[k].enabled);
    const wSum = enabled.reduce((s, k) => s + dims[k].weight, 0) || 1;
    return ranking.map((r) => {
      const subScores: Record<Dim, number> = { price: r.scorePrice, delivery: r.scoreDelivery, quality: r.scoreQuality, service: r.scoreService };
      const cs = enabled.reduce((s, k) => s + subScores[k] * dims[k].weight, 0) / wSum;
      return { ...r, customScore: Math.round(cs) };
    });
  }, [ranking, dims, anyDimEnabled]);

  const filtered = useMemo(() => withCustomScore.filter((r) => {
    if (filterCompliance.iso9001 && !r.compliance?.iso9001) return false;
    if (filterCompliance.ce && !r.compliance?.ce) return false;
    if (filterCompliance.madeInEU && !r.compliance?.madeInEU) return false;
    if (filterCompliance.noEol && (r.eolWarnings || []).length > 0) return false;
    return true;
  }), [withCustomScore, filterCompliance]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let x: number | string | null | undefined, y: number | string | null | undefined;
      switch (sortKey) {
        case "supplier": x = a.supplier; y = b.supplier; break;
        case "scoreTotal": x = a.scoreTotal; y = b.scoreTotal; break;
        case "scorePrice": x = a.scorePrice; y = b.scorePrice; break;
        case "scoreDelivery": x = a.scoreDelivery; y = b.scoreDelivery; break;
        case "scoreQuality": x = a.scoreQuality; y = b.scoreQuality; break;
        case "scoreService": x = a.scoreService; y = b.scoreService; break;
        case "totalNet": x = a.totalNet ?? Infinity; y = b.totalNet ?? Infinity; break;
        case "tcoEur": x = a.tcoEur ?? a.totalNet ?? Infinity; y = b.tcoEur ?? b.totalNet ?? Infinity; break;
        case "deliveryDays": x = a.deliveryDays ?? Infinity; y = b.deliveryDays ?? Infinity; break;
        case "coveragePct": x = a.coveragePct ?? -1; y = b.coveragePct ?? -1; break;
        default: x = a.rank; y = b.rank;
      }
      const cmp = (x as number) < (y as number) ? -1 : (x as number) > (y as number) ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir(k === "totalNet" || k === "tcoEur" || k === "deliveryDays" ? "asc" : "desc"); }
  }
  function setDim(k: Dim, partial: Partial<DimState>) { setDims({ ...dims, [k]: { ...dims[k], ...partial } }); }
  function toggleAll(enabled: boolean) {
    const next = { ...dims };
    (Object.keys(next) as Dim[]).forEach((k) => { next[k] = { ...next[k], enabled }; });
    setDims(next);
  }
  function resetWeights() {
    setDims(DEFAULT_DIMS);
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="opacity-30">↕</span>;
    return sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />;
  }

  return (
    <div className="space-y-3">
      {/* Gewichtung & Filter */}
      <div className="card">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Filter size={14} /> Gewichtung &amp; Filter
            {anyDimEnabled && <span className="badge ml-2" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>aktiv — Custom-Score nutzt nur ausgewaehlte Dimensionen</span>}
            {!anyDimEnabled && <span className="badge ml-2 opacity-70" style={{ background: "rgb(241 245 249)" }}>aus — Custom-Score = KI-Score (alle 4 gleich gewichtet wie urspruenglich)</span>}
          </div>
          <div className="flex gap-2 text-xs">
            <button onClick={() => toggleAll(true)} className="btn btn-ghost btn-sm" disabled={anyDimEnabled && (Object.keys(dims) as Dim[]).every((k) => dims[k].enabled)}>
              <Power size={12} /> Alle an
            </button>
            <button onClick={() => toggleAll(false)} className="btn btn-ghost btn-sm" disabled={!anyDimEnabled}>
              <Power size={12} /> Alle aus
            </button>
            <button onClick={resetWeights} className="btn btn-ghost btn-sm" title="Gewichte auf 40/20/20/20 zuruecksetzen">↻ Reset</button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {(["price", "delivery", "quality", "service"] as Dim[]).map((k) => (
            <div key={k} className={`flex items-center gap-2 p-2 rounded transition ${dims[k].enabled ? "" : "opacity-50"}`} style={{ background: dims[k].enabled ? "rgb(243 232 255)" : undefined }}>
              <input
                type="checkbox"
                checked={dims[k].enabled}
                onChange={(e) => setDim(k, { enabled: e.target.checked })}
                className="shrink-0"
                aria-label={`${DIM_LABEL[k]} aktivieren`}
              />
              <span className="w-20 font-medium">{DIM_LABEL[k]}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={dims[k].weight}
                onChange={(e) => setDim(k, { weight: Number(e.target.value) })}
                className="flex-1"
                disabled={!dims[k].enabled}
              />
              <span className="w-10 text-right font-mono">{dims[k].weight}%</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-3 pt-3 text-xs border-t" style={{ borderColor: "rgb(var(--border))" }}>
          <span className="font-semibold opacity-70">Filter:</span>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={filterCompliance.iso9001} onChange={(e) => setFilterCompliance({ ...filterCompliance, iso9001: e.target.checked })} /> nur ISO 9001</label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={filterCompliance.ce} onChange={(e) => setFilterCompliance({ ...filterCompliance, ce: e.target.checked })} /> nur CE</label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={filterCompliance.madeInEU} onChange={(e) => setFilterCompliance({ ...filterCompliance, madeInEU: e.target.checked })} /> nur Made-in-EU</label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={filterCompliance.noEol} onChange={(e) => setFilterCompliance({ ...filterCompliance, noEol: e.target.checked })} /> ohne EOL-Hinweise</label>
        </div>
      </div>

      {/* Tabelle */}
      <div className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Ranking ({sorted.length} von {ranking.length})</h2>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid rgb(var(--border))" }}>
              <th onClick={() => toggleSort("rank")} className="text-left p-2 cursor-pointer hover:bg-white/5 select-none">#&nbsp;<SortIcon k="rank" /></th>
              <th onClick={() => toggleSort("supplier")} className="text-left p-2 cursor-pointer hover:bg-white/5 select-none">Lieferant <SortIcon k="supplier" /></th>
              <th onClick={() => toggleSort("totalNet")} className="text-right p-2 cursor-pointer hover:bg-white/5 select-none">Total netto <SortIcon k="totalNet" /></th>
              <th onClick={() => toggleSort("tcoEur")} className="text-right p-2 cursor-pointer hover:bg-white/5 select-none">TCO <SortIcon k="tcoEur" /></th>
              <th onClick={() => toggleSort("deliveryDays")} className="text-right p-2 cursor-pointer hover:bg-white/5 select-none">Liefer. <SortIcon k="deliveryDays" /></th>
              <th onClick={() => toggleSort("coveragePct")} className="text-right p-2 cursor-pointer hover:bg-white/5 select-none">Coverage <SortIcon k="coveragePct" /></th>
              <th onClick={() => toggleSort("scoreTotal")} className="text-right p-2 cursor-pointer hover:bg-white/5 select-none">KI-Score <SortIcon k="scoreTotal" /></th>
              <th className="text-right p-2 select-none" title={anyDimEnabled ? "Berechnet aus deinen aktivierten Dimensionen" : "Identisch zu KI-Score solange keine Dimensionen aktiviert"}>
                {anyDimEnabled ? "Custom" : "= KI-Score"}
              </th>
              <th className="text-left p-2 select-none">Flags</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.supplier + r.rank} style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                <td className="p-2 font-mono">{r.rank === 1 ? <Trophy size={14} className="text-yellow-600 inline" /> : null} {r.rank}</td>
                <td className="p-2 font-medium">{r.supplier}</td>
                <td className="p-2 text-right font-mono">{r.totalNet ? `${r.totalNet.toLocaleString("de-DE")} ${r.currency || "EUR"}` : "—"}</td>
                <td className="p-2 text-right font-mono">{r.tcoEur ? r.tcoEur.toLocaleString("de-DE") : "—"}</td>
                <td className="p-2 text-right">{r.deliveryDays ? `${r.deliveryDays}d` : "—"}</td>
                <td className="p-2 text-right">{r.coveragePct !== null && r.coveragePct !== undefined ? `${r.coveragePct}%` : "—"}</td>
                <td className="p-2 text-right font-semibold">{r.scoreTotal}/100</td>
                <td className="p-2 text-right font-bold" style={{ color: anyDimEnabled ? "rgb(124 58 237)" : "rgb(100 116 139)" }}>{r.customScore}/100</td>
                <td className="p-2 flex flex-wrap gap-1 text-xs">
                  {r.compliance?.iso9001 && <span className="badge" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>ISO9001</span>}
                  {r.compliance?.ce && <span className="badge" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>CE</span>}
                  {r.compliance?.en10204 && <span className="badge" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>EN 10204 {r.compliance.en10204}</span>}
                  {r.compliance?.madeInEU && <span className="badge" style={{ background: "rgb(254 249 195)", color: "rgb(146 64 14)" }}>EU</span>}
                  {(r.eolWarnings || []).length > 0 && <span className="badge" style={{ background: "rgb(254 226 226)", color: "rgb(153 27 27)" }} title={r.eolWarnings!.join(", ")}><AlertTriangle size={10} className="inline" /> EOL</span>}
                  {(r.riskFlags || []).length > 0 && <span className="badge" style={{ background: "rgb(254 243 199)", color: "rgb(146 64 14)" }} title={r.riskFlags!.join(", ")}>⚠ Risiko</span>}
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="text-center opacity-50 py-6">Kein Lieferant erfuellt alle Filter — Filter lockern.</td></tr>
            )}
          </tbody>
        </table>

        {/* Pros/Cons + Details Drawer */}
        <div className="mt-4 grid gap-2">
          {sorted.map((r) => (
            <details key={r.supplier} className="rounded border p-2 text-xs" style={{ borderColor: "rgb(var(--border))" }}>
              <summary className="cursor-pointer font-medium">#{r.rank} {r.supplier} · Details</summary>
              <div className="grid md:grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="text-green-700 font-semibold mb-1">+ Pro</div>
                  <ul className="list-disc pl-4 space-y-0.5">{r.pros.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
                <div>
                  <div className="text-red-700 font-semibold mb-1">– Contra</div>
                  <ul className="list-disc pl-4 space-y-0.5">{r.cons.map((p, i) => <li key={i}>{p}</li>)}</ul>
                </div>
              </div>
              <div className="grid md:grid-cols-3 gap-2 mt-3 text-xs">
                {r.cutCostsEur !== null && r.cutCostsEur !== undefined && <div><div className="opacity-60">Schnittkosten</div><div className="font-mono">{r.cutCostsEur.toLocaleString("de-DE")} EUR</div></div>}
                {r.skontoPct && <div><div className="opacity-60">Skonto</div><div className="font-mono">{r.skontoPct}% / {r.skontoDays || "?"} Tage</div></div>}
                {r.moq && <div><div className="opacity-60">MOQ</div><div className="font-mono">{r.moq}</div></div>}
                {r.warrantyMonths && <div><div className="opacity-60">Garantie</div><div className="font-mono">{r.warrantyMonths} Monate</div></div>}
                {r.inkoterm && <div><div className="opacity-60">Inkoterm</div><div className="font-mono">{r.inkoterm}</div></div>}
                {r.paymentTerms && <div><div className="opacity-60">Zahlung</div><div>{r.paymentTerms}</div></div>}
                {r.documentationScore !== null && r.documentationScore !== undefined && <div><div className="opacity-60">Doku-Score</div><div className="font-mono">{r.documentationScore}/100</div></div>}
                {r.co2KgPerUnit && <div><div className="opacity-60">CO₂/Einheit</div><div className="font-mono">{r.co2KgPerUnit} kg</div></div>}
              </div>
              {(r.extraCosts && r.extraCosts.length > 0) && (
                <div className="mt-2"><div className="opacity-60 text-xs">Zusatzkosten</div>
                  <ul className="list-disc pl-4">{r.extraCosts.map((e, i) => <li key={i}>{e.label}: {e.amountEur.toLocaleString("de-DE")} EUR</li>)}</ul>
                </div>
              )}
              {(r.eolWarnings && r.eolWarnings.length > 0) && (
                <div className="mt-2 text-red-700"><div className="font-semibold text-xs">⚠ EOL-Hinweise</div><ul className="list-disc pl-4">{r.eolWarnings.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
              )}
              {(r.riskFlags && r.riskFlags.length > 0) && (
                <div className="mt-2 text-amber-700"><div className="font-semibold text-xs">⚠ Risiko-Flags</div><ul className="list-disc pl-4">{r.riskFlags.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
              )}
              {offerIdMap[r.supplier.toLowerCase().trim()] && (
                <div className="mt-3 pt-2 border-t flex items-center justify-between gap-2" style={{ borderColor: "rgb(var(--border))" }}>
                  <span className="text-xs opacity-70">Lieferant fuer Bestellung waehlen:</span>
                  <PushBedarfButton
                    comparisonId={comparisonId}
                    offerId={offerIdMap[r.supplier.toLowerCase().trim()]}
                    supplierName={r.supplier}
                    defaultProjekt={defaultProjekt}
                    rankingMeta={{
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      artikelnummer: (r as any).bedarfArtikelnummer,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      hersteller: (r as any).bedarfHersteller,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      menge: (r as any).bedarfMenge,
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      einheit: (r as any).bedarfEinheit,
                    }}
                  />
                </div>
              )}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
