"use client";

import { useState } from "react";
import { Send, Sparkles, MessageCircle, Lightbulb } from "lucide-react";
import { useRouter } from "next/navigation";

interface Followup {
  id: string;
  prompt: string;
  response: string;
  costEur: number;
  createdAt: string;
  userName: string;
  hasUpdate?: boolean;
}

const SUGGESTIONS = [
  "Gewichte Preis 60%, Lieferung 10%, Qualität 20%, Service 10%",
  "Welcher Lieferant ist bei +20% Menge guenstiger?",
  "Beziehe alle Soft-Faktoren staerker ein und neu bewerten",
  "Was passiert wenn der Sieger nicht liefern kann — wer waere Plan B?",
  "Vergleiche TCO inkl. Versand und Skonto neu",
];

export default function FollowupChat({
  comparisonId,
  initialFollowups,
}: { comparisonId: string; initialFollowups: Followup[] }) {
  const router = useRouter();
  const [followups, setFollowups] = useState<Followup[]>(initialFollowups);
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function send(textOverride?: string) {
    const text = (textOverride ?? prompt).trim();
    if (!text) return;
    setSending(true);
    setErr(null);
    setPrompt("");
    try {
      const res = await fetch(`/angebotsvergleich/api/comparisons/${comparisonId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || `HTTP ${res.status}`);
      setFollowups((prev) => [...prev, {
        id: j.followup.id,
        prompt: text,
        response: j.followup.response,
        costEur: j.followup.costEur,
        createdAt: new Date().toISOString(),
        userName: "Du",
        hasUpdate: j.followup.hasUpdate,
      }]);
      if (j.followup.hasUpdate) {
        setTimeout(() => router.refresh(), 600);
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      className="card border-2 shadow-lg"
      style={{
        background: "linear-gradient(135deg, rgb(245 243 255) 0%, rgb(255 255 255) 100%)",
        borderColor: "rgb(168 85 247)",
      }}
    >
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-lg font-bold flex items-center gap-2 text-purple-900">
          <MessageCircle size={22} className="text-purple-600" />
          Follow-up Chat &middot; Ergebnis verfeinern
        </h2>
        <span className="text-xs opacity-70 flex items-center gap-1">
          <Lightbulb size={12} /> stelle Folgefragen, lass neu gewichten, lass tiefer analysieren
        </span>
      </div>

      {followups.length > 0 && (
        <div className="space-y-3 mb-4 max-h-96 overflow-y-auto p-2 rounded" style={{ background: "rgb(255 255 255 / 0.6)" }}>
          {followups.map((f, i) => (
            <div key={f.id} className="text-sm space-y-2 pb-3" style={i < followups.length - 1 ? { borderBottom: "1px dashed rgb(196 181 253)" } : undefined}>
              <div className="bg-purple-100 rounded p-2" style={{ background: "rgb(237 233 254)" }}>
                <div className="text-xs opacity-70 mb-1">
                  <span className="font-semibold">{f.userName}</span> · {new Date(f.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}
                </div>
                <div className="font-medium">{f.prompt}</div>
              </div>
              <div className="pl-3 whitespace-pre-wrap text-gray-800" style={{ borderLeft: "2px solid rgb(168 85 247)" }}>{f.response}</div>
              <div className="text-xs opacity-60 flex items-center gap-2 pl-3">
                {f.hasUpdate && <span className="badge" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>📊 Hauptergebnis wurde aktualisiert</span>}
                <span className="ml-auto">Kosten: {f.costEur < 0.01 ? `${(f.costEur * 100).toFixed(2)} ct` : `${f.costEur.toFixed(4)} €`}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Was willst du verfeinern? z.B. andere Gewichtung, was-wenn-Analyse, vertiefe einen Aspekt, korrigiere KI-Fehler…"
          className="input w-full min-h-20 max-h-60 resize-y border-2"
          style={{ borderColor: "rgb(196 181 253)" }}
          disabled={sending}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send(); }}
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1 text-xs">
            {SUGGESTIONS.slice(0, 3).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={sending}
                className="badge hover:bg-purple-200 cursor-pointer"
                style={{ background: "rgb(237 233 254)", color: "rgb(88 28 135)", border: "1px solid rgb(196 181 253)" }}
                title={"Sofort senden: " + s}
              >
                💡 {s.slice(0, 40)}{s.length > 40 ? "…" : ""}
              </button>
            ))}
          </div>
          <button onClick={() => send()} disabled={sending || !prompt.trim()} className="btn btn-primary">
            {sending ? <Sparkles size={16} className="animate-pulse" /> : <Send size={16} />}
            {sending ? "KI denkt nach…" : "Senden"}
          </button>
        </div>
      </div>
      {err && <div className="text-xs text-red-700 mt-2 p-2 rounded" style={{ background: "rgb(254 226 226)" }}>❌ {err}</div>}
      <div className="text-xs opacity-50 mt-3 flex items-center gap-2">
        <span>⌨ Strg+Enter sendet · Folgefragen kosten meist 0,5–5 ct.</span>
        <a href="/angebotsvergleich/kosten" className="ml-auto text-purple-600 hover:underline">Alle Kosten →</a>
      </div>
    </div>
  );
}
