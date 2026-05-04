"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export default function RunButton({ comparisonId, label }: { comparisonId: string; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/angebotsvergleich/api/comparisons/${comparisonId}/run`, { method: "POST", redirect: "manual" });
      // Session abgelaufen — nginx hat zu Authentik-Login redirected.
      // Bei `redirect: "manual"` ist `type === "opaqueredirect"` und status=0.
      if (res.type === "opaqueredirect" || res.status === 0) {
        setError("Sitzung abgelaufen. Seite wird neu geladen…");
        setTimeout(() => window.location.reload(), 800);
        return;
      }
      const ctype = res.headers.get("content-type") || "";
      if (!res.ok || !ctype.includes("application/json")) {
        const text = await res.text();
        // HTML statt JSON = forward-auth Redirect-Response
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
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button onClick={trigger} disabled={busy} className="btn btn-primary">
        <Sparkles size={16} />
        {busy ? "KI laeuft… (kann 90s dauern)" : label}
      </button>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </>
  );
}
