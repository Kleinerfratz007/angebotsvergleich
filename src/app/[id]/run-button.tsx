"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";

export default function RunButton({ comparisonId, label }: { comparisonId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/angebotsvergleich/api/comparisons/${comparisonId}/run`, {
        method: "POST",
        redirect: "manual",
      });
      if (res.type === "opaqueredirect" || res.status === 0) {
        setError("Sitzung abgelaufen. Seite wird neu geladen…");
        setTimeout(() => window.location.reload(), 800);
        return;
      }
      const ctype = res.headers.get("content-type") || "";
      if (!res.ok && res.status !== 202) {
        const text = await res.text();
        if (text.startsWith("<") || ctype.includes("text/html")) {
          setError("Sitzung abgelaufen. Seite wird neu geladen…");
          setTimeout(() => window.location.reload(), 800);
          return;
        }
        try {
          const data = JSON.parse(text);
          setError(data.error || `HTTP ${res.status}`);
        } catch {
          setError(`HTTP ${res.status}`);
        }
        setBusy(false);
        return;
      }
      // 202 Accepted: status ist jetzt PROCESSING, soft-refresh damit KiProgress rendert
      router.refresh();
      // busy bleibt true — KiProgress uebernimmt; minimaler Polling-Backstop:
      setTimeout(() => router.refresh(), 1500);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={trigger}
        disabled={busy}
        className="btn btn-primary inline-flex items-center gap-2"
        aria-busy={busy}
      >
        {busy ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>KI startet…</span>
          </>
        ) : (
          <>
            <Sparkles size={16} />
            <span>{label}</span>
          </>
        )}
      </button>
      {busy && (
        <div className="mt-3 rounded-lg border-2 border-purple-300 p-3 text-xs flex items-center gap-2" style={{ background: "linear-gradient(90deg, rgb(243 232 255), rgb(219 234 254))" }}>
          <Loader2 size={14} className="animate-spin text-purple-600" />
          <span className="font-medium">KI-Analyse wird gestartet — Animation laedt gleich…</span>
        </div>
      )}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </>
  );
}
