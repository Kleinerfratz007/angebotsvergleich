"use client";

import { useState } from "react";
import { ShoppingCart, Send } from "lucide-react";

interface Props {
  comparisonId: string;
  offerId: string;
  supplierName: string;
  defaultProjekt?: string | null;
  rankingMeta?: { artikelnummer?: string | null; hersteller?: string | null; menge?: number | null; einheit?: string | null };
}

export default function PushBedarfButton({ comparisonId, offerId, supplierName, defaultProjekt, rankingMeta }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [projektnr, setProjektnr] = useState(defaultProjekt || "");
  const [lieferort, setLieferort] = useState<"DUI" | "EUS">("DUI");
  const [menge, setMenge] = useState<string>(String(rankingMeta?.menge ?? 1));
  const [einheit, setEinheit] = useState(rankingMeta?.einheit || "Stk");
  const [bemerkung, setBemerkung] = useState("");

  async function send() {
    setMsg(null);
    if (!projektnr.trim()) { setMsg({ kind: "err", text: "Projektnummer erforderlich" }); return; }
    setBusy(true);
    try {
      const r = await fetch(`/angebotsvergleich/api/comparisons/${comparisonId}/push-to-bedarf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId,
          projektnr: projektnr.trim(),
          lieferort,
          menge: Number(menge) || undefined,
          einheit: einheit.trim() || undefined,
          bemerkung: bemerkung.trim() || undefined,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMsg({ kind: "ok", text: `An Bedarfsanmeldung gesendet — wartet auf Annahme` });
      setTimeout(() => setOpen(false), 1500);
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
        title={`Lieferant ${supplierName} an Bedarfsanmeldung senden`}
      >
        <ShoppingCart size={12} /> Bestellen
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="card max-w-md w-full" style={{ background: "rgb(var(--card))" }}>
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-semibold flex items-center gap-2"><ShoppingCart size={16} /> An Bedarfsanmeldung pushen</h3>
              <button onClick={() => setOpen(false)} className="opacity-60 hover:opacity-100" type="button">×</button>
            </div>
            <p className="text-xs opacity-70 mb-3">
              Lieferant: <strong>{supplierName}</strong>
              {rankingMeta?.artikelnummer && <> · Art-Nr. <code>{rankingMeta.artikelnummer}</code></>}
              {rankingMeta?.hersteller && <> · {rankingMeta.hersteller}</>}
            </p>

            <div className="space-y-2">
              <label className="block">
                <span className="text-xs opacity-70 block mb-1">Projektnummer <span className="text-red-500">*</span></span>
                <input value={projektnr} onChange={(e) => setProjektnr(e.target.value)} className="input" placeholder="z.B. 12579" required />
              </label>

              <label className="block">
                <span className="text-xs opacity-70 block mb-1">Lieferort</span>
                <select value={lieferort} onChange={(e) => setLieferort(e.target.value as "DUI" | "EUS")} className="input">
                  <option value="DUI">DUI · Duisburg</option>
                  <option value="EUS">EUS · Euskirchen</option>
                </select>
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs opacity-70 block mb-1">Menge</span>
                  <input value={menge} onChange={(e) => setMenge(e.target.value)} type="number" min="0.001" step="0.001" className="input" />
                </label>
                <label className="block">
                  <span className="text-xs opacity-70 block mb-1">Einheit</span>
                  <input value={einheit} onChange={(e) => setEinheit(e.target.value)} className="input" placeholder="Stk" />
                </label>
              </div>

              <label className="block">
                <span className="text-xs opacity-70 block mb-1">Bemerkung (optional)</span>
                <textarea value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} rows={2} className="input" placeholder="z.B. dringend bis KW 32" />
              </label>
            </div>

            {msg && (
              <div className={`mt-3 p-2 rounded text-xs ${msg.kind === "ok" ? "text-green-700" : "text-red-700"}`} style={{ background: msg.kind === "ok" ? "rgb(220 252 231)" : "rgb(254 226 226)" }}>
                {msg.kind === "ok" ? "✓" : "✗"} {msg.text}
              </div>
            )}

            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setOpen(false)} className="btn btn-ghost" type="button">Abbrechen</button>
              <button onClick={send} disabled={busy || !projektnr.trim()} className="btn btn-primary" type="button">
                <Send size={14} /> {busy ? "sende…" : "An Bedarfsanmeldung senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
