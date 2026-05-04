"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, Sparkles, FileText } from "lucide-react";
import RfqStep, { type RfqData } from "./rfq-step";
import ModelPicker from "./model-picker";
import { type AiModelId, DEFAULT_MODEL, getModel } from "@/lib/ai-models";

interface OfferDraft {
  id: string;
  supplierName: string;
  file: File;
}

const PROMPT_HINTS = [
  "z.B. \"Wir brauchen unbedingt CE-Konformitaet\"",
  "z.B. \"Lieferant X war in der Vergangenheit oft verspaetet — bitte abwerten\"",
  "z.B. \"Mengen-Varianz +/-15% ist akzeptabel — bevorzuge flexibel staffelbare Angebote\"",
];

export default function NewComparisonClient({ geminiAvailable }: { geminiAvailable: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [projectRef, setProjectRef] = useState("");
  const [backgroundInfo, setBackgroundInfo] = useState("");
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiProvider, setAiProvider] = useState<"claude" | "gemini">("claude");
  const [rfqData, setRfqData] = useState<RfqData | null>(null);
  const [aiModel, setAiModel] = useState<AiModelId>(DEFAULT_MODEL);
  const [offers, setOffers] = useState<OfferDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | null) {
    if (!files) return;
    const newOffers: OfferDraft[] = [];
    for (const file of Array.from(files)) {
      if (offers.length + newOffers.length >= 10) break;
      const cleanName = file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
      newOffers.push({ id: crypto.randomUUID(), supplierName: cleanName, file });
    }
    setOffers([...offers, ...newOffers]);
  }
  function removeOffer(id: string) {
    setOffers(offers.filter((o) => o.id !== id));
  }
  function updateSupplier(id: string, name: string) {
    setOffers(offers.map((o) => (o.id === id ? { ...o, supplierName: name } : o)));
  }

  async function submit(runImmediately: boolean) {
    setError(null);
    if (!title.trim()) { setError("Titel ist erforderlich"); return; }
    if (offers.length < 2 && runImmediately) { setError("Mindestens 2 Angebote fuer Vergleich noetig"); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("title", title);
      if (customerName) fd.append("customerName", customerName);
      if (projectRef) fd.append("projectRef", projectRef);
      if (backgroundInfo) fd.append("backgroundInfo", backgroundInfo);
      if (customPrompt) fd.append("customPrompt", customPrompt);
      fd.append("aiProvider", aiProvider);
      fd.append("aiModel", aiModel);
      if (rfqData) {
        fd.append("rfqScope", JSON.stringify(rfqData.scope));
        fd.append("rfqOriginalFilename", rfqData.filename);
        fd.append("rfqMimeType", rfqData.mimeType);
        fd.append("rfqFileSize", String(rfqData.fileSize));
        fd.append("rfqInputTokens", String(rfqData.meta.inputTokens));
        fd.append("rfqOutputTokens", String(rfqData.meta.outputTokens));
        fd.append("rfqExtractModel", rfqData.meta.model);
      }
      for (const o of offers) {
        fd.append("supplierName", o.supplierName);
        fd.append("file", o.file, o.file.name);
      }
      fd.append("run", runImmediately ? "1" : "0");
      const res = await fetch("/angebotsvergleich/api/comparisons", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || `HTTP ${res.status}`);
        return;
      }
      router.push(`/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-2xl font-bold">Neuer Angebotsvergleich</h1>

      {error && (
        <div className="card border-red-300 text-red-700 text-sm" style={{ background: "rgb(254 226 226)" }}>
          ❌ {error}
        </div>
      )}

      <RfqStep value={rfqData} onChange={setRfqData} />

      <div className="card space-y-3">
        <h2 className="font-semibold text-sm uppercase opacity-70">Stammdaten</h2>
        <label className="block">
          <span className="text-xs opacity-70 block mb-1">Titel <span className="text-red-500">*</span></span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="input" placeholder="z.B. Aluminium-Profile Q3 2026" />
        </label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs opacity-70 block mb-1">Kunde (optional)</span>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="input" placeholder="z.B. Thyssenkrupp AG" />
          </label>
          <label className="block">
            <span className="text-xs opacity-70 block mb-1">Projekt-Nr (optional)</span>
            <input value={projectRef} onChange={(e) => setProjectRef(e.target.value)} className="input" placeholder="z.B. 12345" />
          </label>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-sm uppercase opacity-70">KI-Modell</h2>
        <ModelPicker
          value={aiModel}
          onChange={setAiModel}
          estCt={getModel(aiModel).typicalCostCt * Math.max(1, offers.length / 3)}
        />
        <details className="text-xs opacity-70">
          <summary className="cursor-pointer">Erweitert: Provider waehlen (Claude / Gemini)</summary>
        {geminiAvailable ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAiProvider("claude")}
              className={`p-3 rounded-md border text-left text-sm transition ${aiProvider === "claude" ? "border-purple-500 bg-purple-50" : ""}`}
              style={{ borderColor: aiProvider === "claude" ? undefined : "rgb(var(--border))" }}
            >
              <div className="font-semibold">🟣 Claude Opus 4.7</div>
              <div className="text-xs opacity-70">Anthropic · Default</div>
            </button>
            <button
              type="button"
              onClick={() => setAiProvider("gemini")}
              className={`p-3 rounded-md border text-left text-sm transition ${aiProvider === "gemini" ? "border-blue-500 bg-blue-50" : ""}`}
              style={{ borderColor: aiProvider === "gemini" ? undefined : "rgb(var(--border))" }}
            >
              <div className="font-semibold">🔵 Gemini Pro 3.1</div>
              <div className="text-xs opacity-70">Google</div>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 rounded-md border border-purple-500 bg-purple-50 text-sm">
              <div className="font-semibold">🟣 Claude Opus 4.7</div>
              <div className="text-xs opacity-70">Anthropic · Production-ready</div>
            </div>
            <div className="p-3 rounded-md border text-sm opacity-50" style={{ borderColor: "rgb(var(--border))", background: "rgb(248 250 252)" }}>
              <div className="font-semibold" style={{ textDecoration: "line-through" }}>🔵 Gemini Pro 3.1</div>
              <div className="text-xs opacity-70">Wird aktiv sobald GOOGLE_API_KEY in Einstellungen gesetzt ist.</div>
            </div>
          </div>
        )}
        </details>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-sm uppercase opacity-70">Hintergrund-Info fuer die KI</h2>
        <label className="block">
          <span className="text-xs opacity-70 block mb-1">Was wird beschafft + Kontext</span>
          <textarea
            value={backgroundInfo}
            onChange={(e) => setBackgroundInfo(e.target.value)}
            rows={4}
            className="textarea"
            placeholder="z.B. Wir brauchen 500m Aluminium-Strangpressprofil 6060-T6, Querschnitt 40x40mm, Wandstaerke 3mm, eloxiert silber. Liefertermin: Mitte Q3, an unser Werk Duisburg."
          />
        </label>
        <label className="block">
          <span className="text-xs opacity-70 block mb-1">
            Spezielle Hinweise (optional) — wird zusaetzlich an Claude Opus 4.7 mitgegeben
          </span>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            className="textarea"
            placeholder={PROMPT_HINTS[Math.floor(Math.random() * PROMPT_HINTS.length)]}
          />
        </label>
      </div>

      <div className="card space-y-3">
        <h2 className="font-semibold text-sm uppercase opacity-70">Angebote (2-10)</h2>
        <div
          className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:border-purple-400"
          style={{ borderColor: "rgb(var(--border))" }}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); }}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
        >
          <Upload size={28} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">PDFs hier ablegen oder klicken zum Auswaehlen</p>
          <p className="text-xs opacity-60 mt-1">{offers.length} / 10 Angebote</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf,.txt,text/plain"
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>
        {offers.length > 0 && (
          <ul className="divide-y" style={{ borderColor: "rgb(var(--border))" }}>
            {offers.map((o) => (
              <li key={o.id} className="py-2 flex items-center gap-2">
                <FileText size={16} className="opacity-50 shrink-0" />
                <input
                  value={o.supplierName}
                  onChange={(e) => updateSupplier(o.id, e.target.value)}
                  className="input text-sm"
                  placeholder="Lieferant-Name"
                />
                <span className="text-xs opacity-60 truncate hidden md:block">{o.file.name}</span>
                <span className="text-xs opacity-60 whitespace-nowrap">{(o.file.size / 1024).toFixed(0)} KB</span>
                <button onClick={() => removeOffer(o.id)} className="opacity-60 hover:opacity-100 hover:text-red-600">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-end">
        <button onClick={() => submit(false)} disabled={busy || !title.trim()} className="btn btn-ghost">
          Als Entwurf speichern
        </button>
        <button
          onClick={() => submit(true)}
          disabled={busy || !title.trim() || offers.length < 2}
          className="btn btn-primary"
        >
          <Sparkles size={16} />
          {busy ? "Lade hoch + KI laeuft…" : "Speichern + KI starten"}
        </button>
      </div>
    </div>
  );
}
