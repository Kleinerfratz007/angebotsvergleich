"use client";

import { Sparkles, Zap, Trophy, Info } from "lucide-react";
import { AI_MODELS, type AiModelId, DEFAULT_MODEL } from "@/lib/ai-models";

interface Props {
  value: AiModelId;
  onChange: (id: AiModelId) => void;
  estCt?: number;  // Optional: bereits berechnete Kosten-Schaetzung
}

const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  haiku: Zap,
  sonnet: Sparkles,
  opus: Trophy,
};

export default function ModelPicker({ value, onChange, estCt }: Props) {
  const selected = AI_MODELS.find((m) => m.id === value) || AI_MODELS.find((m) => m.id === DEFAULT_MODEL)!;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {AI_MODELS.map((m) => {
          const Icon = ICONS[m.family] || Sparkles;
          const isActive = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className="text-left p-3 rounded-md border-2 transition relative"
              style={{
                borderColor: isActive ? "rgb(124 58 237)" : "rgb(var(--border))",
                background: isActive ? "rgb(245 243 255)" : "white",
              }}
            >
              {m.recommended && (
                <span className="badge absolute top-2 right-2" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)", fontSize: 10 }}>
                  Empfohlen
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                <Icon size={18} className="text-purple-600" />
                <div className="font-semibold text-sm">{m.label}</div>
              </div>
              <div className="text-xs opacity-70 mb-2">{m.shortDescription}</div>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono" title="typische Kosten pro Anfrage">~{m.typicalCostCt < 1 ? m.typicalCostCt.toFixed(1) : Math.round(m.typicalCostCt)} ct</span>
                <span className="opacity-50">·</span>
                <span className="opacity-70" title="typische Antwortzeit">~{m.typicalLatencySec}s</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Model Details */}
      <details className="card text-xs">
        <summary className="cursor-pointer flex items-center gap-1 font-medium">
          <Info size={12} /> Details zum gewählten Modell ({selected.label})
        </summary>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div>
            <div className="font-semibold text-green-700 mb-1">+ Stärken</div>
            <ul className="list-disc pl-4 space-y-0.5">{selected.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
          <div>
            <div className="font-semibold text-red-700 mb-1">– Schwächen</div>
            <ul className="list-disc pl-4 space-y-0.5">{selected.weaknesses.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </div>
        </div>
        <div className="mt-2 opacity-70">
          <strong>Am besten geeignet für:</strong> {selected.bestFor}
        </div>
        <div className="mt-2 opacity-60">
          Pricing: ${selected.inputPer1M.toFixed(2)} / 1M Input-Tokens · ${selected.outputPer1M.toFixed(2)} / 1M Output-Tokens
        </div>
      </details>

      {estCt !== undefined && (
        <div className="p-2 rounded text-xs flex items-center gap-2" style={{ background: "rgb(243 232 255)", color: "rgb(88 28 135)" }}>
          💰 Geschätzte Kosten für diese Anfrage: <strong>~{estCt.toFixed(1)} ct</strong> (basierend auf {selected.label})
        </div>
      )}
    </div>
  );
}
