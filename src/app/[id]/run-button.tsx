"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

export default function RunButton({ comparisonId, label }: { comparisonId: string; label: string }) {
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
      // Session-Redirect (nginx forward-auth)
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
        return;
      }
      // 202 Accepted (Fire-and-Forget) ODER 200 OK → Page komplett reloaden
      // damit der Server-Component den neuen PROCESSING-Status laedt und
      // die KiProgress-Animation rendert.
      window.location.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      // busy bleibt true bis reload — kein finally-reset
    }
  }

  return (
    <>
      <button onClick={trigger} disabled={busy} className="btn btn-primary">
        <Sparkles size={16} className={busy ? "animate-spin" : undefined} />
        {busy ? "starte KI…" : label}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </>
  );
}
