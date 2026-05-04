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
      const res = await fetch(`/angebotsvergleich/api/comparisons/${comparisonId}/run`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || `HTTP ${res.status}`);
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
