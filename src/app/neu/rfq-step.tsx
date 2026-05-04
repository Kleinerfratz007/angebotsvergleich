"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Sparkles, Edit3, Check, X, AlertCircle, Lightbulb } from "lucide-react";

export interface RfqScope {
  summary: string;
  whatIsRequested: string;
  problemToSolve: string;
  context: { project?: string | null; industry?: string | null; application?: string | null };
  scopeItems: Array<{ description: string; quantity?: number | null; unit?: string | null; specs?: string | null; isOptional?: boolean }>;
  technicalRequirements: string[];
  qualityRequirements: string[];
  deliveryRequirements: { deadline?: string | null; location?: string | null; inkoterm?: string | null; deliveryNotes?: string | null };
  budget: { amount?: number | null; currency?: string | null; notes?: string | null };
  certifications: string[];
  paymentRequirements: string[];
  otherConstraints: string[];
  caveats: string[];
}

export interface RfqData {
  scope: RfqScope;
  meta: { model: string; inputTokens: number; outputTokens: number; runMs: number };
  filename: string;
  fileSize: number;
  mimeType: string;
}

interface Props {
  value: RfqData | null;
  onChange: (v: RfqData | null) => void;
}

export default function RfqStep({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  async function handleFile(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/angebotsvergleich/api/rfq-extract", { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      onChange({ scope: j.scope, meta: j.meta, filename: j.filename, fileSize: j.fileSize, mimeType: j.mimeType });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    onChange(null);
    setEditing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (!value) {
    return (
      <div className="card border-2 border-dashed" style={{ borderColor: "rgb(196 181 253)", background: "linear-gradient(135deg, rgb(245 243 255) 0%, white 100%)" }}>
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <h2 className="font-semibold text-sm uppercase opacity-70 flex items-center gap-2">
            <Lightbulb size={16} className="text-purple-600" /> Step 0 · Anfrage hochladen <span className="badge" style={{ background: "rgb(229 231 235)" }}>optional</span>
          </h2>
        </div>
        <p className="text-xs opacity-70 mb-3">
          Wenn du deine eigene <strong>Angebotsanfrage (RFQ)</strong> als PDF hochlädst, extrahiert die KI den <strong>Scope</strong> (was wird angefragt, Mengen, Anforderungen, Liefertermin, Budget, Zertifikate). Beim Vergleich wird dann jedes Angebot daran gemessen — &quot;Coverage Score&quot;.
        </p>
        <div
          className={`border-2 border-dashed rounded-md p-4 text-center cursor-pointer hover:border-purple-400 ${busy ? "opacity-50" : ""}`}
          style={{ borderColor: "rgb(196 181 253)" }}
          onClick={() => !busy && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
        >
          {busy ? (
            <>
              <Sparkles size={24} className="mx-auto mb-2 text-purple-600 animate-pulse" />
              <p className="text-sm">KI liest die Anfrage…</p>
              <p className="text-xs opacity-60 mt-1">~10–30 s, ca. 2–8 ct</p>
            </>
          ) : (
            <>
              <Upload size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">Anfrage-PDF ablegen oder klicken</p>
              <p className="text-xs opacity-60 mt-1">max 20 MB</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf,.txt,text/plain"
            className="hidden"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
        {err && <div className="text-xs text-red-700 mt-2 p-2 rounded" style={{ background: "rgb(254 226 226)" }}>❌ {err}</div>}
        <p className="text-xs opacity-50 mt-2">
          🔒 Datei wird nur zur Scope-Analyse an Claude gesendet. Wir speichern den extrahierten Text + Scope, NICHT die PDF dauerhaft (außer du startest später den Vergleich).
        </p>
      </div>
    );
  }

  const s = value.scope;
  return (
    <div className="card border-2" style={{ borderColor: "rgb(34 197 94)", background: "linear-gradient(135deg, rgb(220 252 231) 0%, white 100%)" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold flex items-center gap-2">
            <Check size={18} className="text-green-600" />
            Anfrage analysiert · {value.filename}
          </h2>
          <div className="text-xs opacity-70 mt-1">
            {(value.fileSize / 1024).toFixed(0)} KB · {value.meta.model} · {value.meta.inputTokens.toLocaleString("de-DE")} in / {value.meta.outputTokens.toLocaleString("de-DE")} out tokens · {(value.meta.runMs / 1000).toFixed(1)}s
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setEditing(!editing)} className="btn btn-ghost" title={editing ? "Bearbeitung beenden" : "Bearbeiten"}>
            <Edit3 size={14} /> {editing ? "Fertig" : "Edit"}
          </button>
          <button onClick={clear} className="btn btn-ghost" title="Anfrage entfernen">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-3 p-3 rounded" style={{ background: "white", border: "1px solid rgb(187 247 208)" }}>
        {editing ? (
          <textarea
            value={s.summary}
            onChange={(e) => onChange({ ...value, scope: { ...s, summary: e.target.value } })}
            className="textarea w-full text-sm"
            rows={2}
          />
        ) : (
          <p className="text-sm font-medium">{s.summary}</p>
        )}
        <div className="text-xs opacity-70 mt-2">
          <strong>Was angefragt:</strong> {s.whatIsRequested}
        </div>
        {s.problemToSolve && (
          <div className="text-xs opacity-70 mt-1">
            <strong>Anwendung:</strong> {s.problemToSolve}
          </div>
        )}
      </div>

      {/* Grid: Scope-Items + Anforderungen */}
      <div className="grid md:grid-cols-2 gap-3 text-xs">
        {s.scopeItems && s.scopeItems.length > 0 && (
          <div className="p-2 rounded" style={{ background: "white" }}>
            <div className="font-semibold opacity-70 uppercase mb-1">📦 Positionen ({s.scopeItems.length})</div>
            <ul className="space-y-1">
              {s.scopeItems.map((it, i) => (
                <li key={i} className="border-b pb-1" style={{ borderColor: "rgb(220 252 231)" }}>
                  <strong>{it.description}</strong>
                  {it.quantity != null && <span className="ml-1 text-gray-600">— {it.quantity} {it.unit || ""}</span>}
                  {it.specs && <div className="opacity-70 text-xs">{it.specs}</div>}
                  {it.isOptional && <span className="badge ml-1" style={{ background: "rgb(254 243 199)" }}>optional</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          {s.technicalRequirements && s.technicalRequirements.length > 0 && (
            <div className="p-2 rounded" style={{ background: "white" }}>
              <div className="font-semibold opacity-70 uppercase mb-1">🔧 Technisch</div>
              <ul className="list-disc pl-4 space-y-0.5">{s.technicalRequirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {s.qualityRequirements && s.qualityRequirements.length > 0 && (
            <div className="p-2 rounded" style={{ background: "white" }}>
              <div className="font-semibold opacity-70 uppercase mb-1">⭐ Qualität</div>
              <ul className="list-disc pl-4 space-y-0.5">{s.qualityRequirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </div>
          )}
          {s.certifications && s.certifications.length > 0 && (
            <div className="p-2 rounded" style={{ background: "white" }}>
              <div className="font-semibold opacity-70 uppercase mb-1">📋 Zertifikate</div>
              <div className="flex flex-wrap gap-1">{s.certifications.map((c, i) => <span key={i} className="badge" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>{c}</span>)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom: Lieferung + Budget + Kontext */}
      <div className="grid md:grid-cols-3 gap-3 text-xs mt-3">
        {s.deliveryRequirements && (s.deliveryRequirements.deadline || s.deliveryRequirements.location) && (
          <div className="p-2 rounded" style={{ background: "white" }}>
            <div className="font-semibold opacity-70 uppercase mb-1">🚚 Lieferung</div>
            {s.deliveryRequirements.deadline && <div>Termin: <strong>{s.deliveryRequirements.deadline}</strong></div>}
            {s.deliveryRequirements.location && <div>Ort: {s.deliveryRequirements.location}</div>}
            {s.deliveryRequirements.inkoterm && <div>Inkoterm: <strong>{s.deliveryRequirements.inkoterm}</strong></div>}
            {s.deliveryRequirements.deliveryNotes && <div className="opacity-70">{s.deliveryRequirements.deliveryNotes}</div>}
          </div>
        )}
        {s.budget && (s.budget.amount || s.budget.notes) && (
          <div className="p-2 rounded" style={{ background: "white" }}>
            <div className="font-semibold opacity-70 uppercase mb-1">💰 Budget</div>
            {s.budget.amount != null && <div className="font-semibold">{s.budget.amount.toLocaleString("de-DE")} {s.budget.currency || "EUR"}</div>}
            {s.budget.notes && <div className="opacity-70">{s.budget.notes}</div>}
          </div>
        )}
        {s.context && (s.context.project || s.context.industry) && (
          <div className="p-2 rounded" style={{ background: "white" }}>
            <div className="font-semibold opacity-70 uppercase mb-1">🏷️ Kontext</div>
            {s.context.project && <div>Projekt: <strong>{s.context.project}</strong></div>}
            {s.context.industry && <div>Branche: {s.context.industry}</div>}
            {s.context.application && <div>Anwendung: {s.context.application}</div>}
          </div>
        )}
      </div>

      {s.caveats && s.caveats.length > 0 && (
        <div className="mt-3 p-2 rounded text-xs" style={{ background: "rgb(254 243 199)", color: "rgb(146 64 14)" }}>
          <div className="font-semibold flex items-center gap-1"><AlertCircle size={12} /> Vorbehalte / Unklarheiten</div>
          <ul className="list-disc pl-4 mt-1">{s.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>
        </div>
      )}

      <div className="mt-3 text-xs opacity-60">
        ✓ Dieser Scope wird beim KI-Vergleich als Benchmark genutzt — Angebote werden auf Coverage geprüft.
      </div>
    </div>
  );
}
