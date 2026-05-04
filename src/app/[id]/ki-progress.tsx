"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Brain, Search, FileText, Calculator, CheckCircle2 } from "lucide-react";

const STAGES = [
  { icon: FileText,   label: "Lese alle PDFs",                duration: 5 },
  { icon: Search,     label: "Extrahiere Positionen + Preise", duration: 10 },
  { icon: Brain,      label: "Analysiere Lieferanten + Scope", duration: 20 },
  { icon: Calculator, label: "Berechne Scores + TCO + Pareto", duration: 15 },
  { icon: CheckCircle2, label: "Erstelle Empfehlung",         duration: 10 },
];

interface Props {
  offerCount: number;
  comparisonId: string;
}

export default function KiProgress({ offerCount, comparisonId }: Props) {
  const router = useRouter();
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const totalDuration = STAGES.reduce((s, x) => s + x.duration, 0); // ~60s
  const estimatedTotal = Math.max(totalDuration, offerCount * 12);

  // Counter
  useEffect(() => {
    const t = setInterval(() => setSecondsElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-Refresh alle 8 Sekunden — checkt ob Status sich geaendert hat
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(t);
  }, [router]);

  // Welcher Stage ist aktiv?
  let cum = 0;
  let activeStage = 0;
  for (let i = 0; i < STAGES.length; i++) {
    cum += STAGES[i].duration;
    if (secondsElapsed < cum) { activeStage = i; break; }
    activeStage = STAGES.length - 1;
  }

  const progressPct = Math.min(100, (secondsElapsed / estimatedTotal) * 100);

  return (
    <div className="card relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgb(243 232 255) 0%, rgb(219 234 254) 100%)" }}>
      {/* Animated gradient background bar */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, transparent, rgb(196 181 253), transparent)",
          backgroundSize: "200% 100%",
          animation: "shimmer 2.5s linear infinite",
        }}
      />
      <style>{`
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse-strong { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.1); opacity: 0.85; } }
        @keyframes thinking-dots {
          0%, 20% { content: "."; }
          40% { content: ".."; }
          60%, 100% { content: "..."; }
        }
        .ki-thinking::after { content: "..."; display: inline-block; min-width: 1.5em; animation: thinking-dots 1.5s infinite; }
        .ki-orb {
          width: 80px; height: 80px; border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgb(196 181 253), rgb(124 58 237));
          box-shadow: 0 0 40px rgba(124,58,237,0.6), inset 0 0 20px rgba(255,255,255,0.4);
          animation: pulse-strong 2s ease-in-out infinite;
          display: flex; align-items: center; justify-content: center;
        }
        .stage-active { font-weight: 600; color: rgb(88 28 135); }
        .stage-done { color: rgb(21 128 61); text-decoration: line-through; opacity: 0.7; }
        .stage-pending { opacity: 0.4; }
      `}</style>

      <div className="relative z-10 text-center py-6">
        {/* Animated KI Orb */}
        <div className="ki-orb mx-auto mb-4">
          <Sparkles size={36} color="white" style={{ animation: "spin-slow 3s linear infinite" }} />
        </div>

        <p className="text-lg font-bold text-purple-900">
          Claude analysiert deine Anfrage<span className="ki-thinking" />
        </p>
        <p className="text-xs opacity-70 mt-1">
          {offerCount} Angebote · ~{estimatedTotal}s erwartet · {secondsElapsed}s gelaufen
        </p>

        {/* Progress Bar */}
        <div className="max-w-md mx-auto mt-4 h-2 rounded-full overflow-hidden" style={{ background: "rgba(196,181,253,0.3)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, rgb(124 58 237), rgb(168 85 247))",
              boxShadow: "0 0 10px rgba(168,85,247,0.6)",
            }}
          />
        </div>

        {/* Stage-Liste */}
        <div className="max-w-md mx-auto mt-5 space-y-1.5 text-left text-sm">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const isDone = i < activeStage;
            const isActive = i === activeStage;
            return (
              <div
                key={i}
                className={`flex items-center gap-2 ${isDone ? "stage-done" : isActive ? "stage-active" : "stage-pending"}`}
              >
                <Icon size={14} className={isActive ? "animate-pulse" : ""} />
                <span>{s.label}</span>
                {isDone && <CheckCircle2 size={12} className="ml-auto text-green-600" />}
                {isActive && <span className="ml-auto text-xs font-mono">⏱</span>}
              </div>
            );
          })}
        </div>

        <p className="text-xs opacity-50 mt-4">
          Seite aktualisiert sich automatisch alle 8 Sekunden · <a href={`/angebotsvergleich/${comparisonId}`} className="underline">manuell aktualisieren</a>
        </p>
      </div>
    </div>
  );
}
