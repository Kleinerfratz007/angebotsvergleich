"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy, Sparkles, AlertCircle, Archive, ArchiveRestore, Trash2, FileText } from "lucide-react";

export interface VergleichItem {
  id: string;
  title: string;
  customerName: string | null;
  status: string;
  resultSummary: string | null;
  createdAt: string;
  archivedAt: string | null;
  offerCount: number;
  winner: string | null;
}

interface Props {
  items: VergleichItem[];
  mode: "active" | "archive";  // zeigt aktive ODER archivierte
}

export default function VergleichsListe({ items, mode }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function archive(id: string, archived: boolean) {
    setBusy(id);
    setErr(null);
    try {
      const r = await fetch(`/angebotsvergleich/api/comparisons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function hardDelete(id: string, title: string) {
    if (!confirm(`Vergleich „${title}" ENDGÜLTIG löschen?\n\nAlle Angebote, Followups und PDFs werden unwiderruflich entfernt. Cost-Tracking bleibt für Audit erhalten.\n\nFortfahren?`)) return;
    setBusy(id);
    setErr(null);
    try {
      const r = await fetch(`/angebotsvergleich/api/comparisons/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`);
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <div className="card text-center py-10">
        {mode === "active" ? (
          <>
            <Sparkles size={32} className="mx-auto opacity-40 mb-3" />
            <p className="text-sm opacity-70">Noch keine Vergleiche. Lege deinen ersten an.</p>
          </>
        ) : (
          <>
            <Archive size={32} className="mx-auto opacity-40 mb-3" />
            <p className="text-sm opacity-70">Archiv ist leer.</p>
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {err && <div className="card text-red-700 text-sm" style={{ background: "rgb(254 226 226)" }}>❌ {err}</div>}
      <ul className="space-y-2">
        {items.map((c) => (
          <li key={c.id} className="card relative" style={c.archivedAt ? { opacity: 0.7, background: "rgb(248 250 252)" } : undefined}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <Link href={`/${c.id}`} className="flex-1 min-w-0">
                <h2 className="font-semibold truncate hover:text-purple-700">{c.title}</h2>
                <div className="text-xs opacity-60 mt-1 flex flex-wrap gap-2">
                  {c.customerName && <span>{c.customerName}</span>}
                  <span>· {c.offerCount} Angebote</span>
                  <span>· {new Date(c.createdAt).toLocaleDateString("de-DE")}</span>
                  {c.archivedAt && <span className="badge" style={{ background: "rgb(229 231 235)", color: "rgb(75 85 99)" }}><Archive size={10} className="inline" /> archiviert {new Date(c.archivedAt).toLocaleDateString("de-DE")}</span>}
                </div>
                {c.resultSummary && (
                  <p className="text-sm mt-2 opacity-80 line-clamp-2">{c.resultSummary}</p>
                )}
              </Link>
              <div className="flex flex-col items-end gap-2">
                <div className="flex flex-col items-end gap-1 text-xs">
                  {c.status === "DRAFT" && <span className="badge" style={{ background: "rgb(229 231 235)", color: "rgb(75 85 99)" }}>Entwurf</span>}
                  {c.status === "PROCESSING" && <span className="badge" style={{ background: "rgb(219 234 254)", color: "rgb(29 78 216)" }}><Sparkles size={10} className="inline animate-pulse" /> KI laeuft</span>}
                  {c.status === "DONE" && c.winner && <span className="badge" style={{ background: "rgb(254 249 195)", color: "rgb(146 64 14)" }}><Trophy size={10} className="inline" /> {c.winner}</span>}
                  {c.status === "ERROR" && <span className="badge text-red-700" style={{ background: "rgb(254 226 226)" }}><AlertCircle size={10} className="inline" /> Fehler</span>}
                </div>
                <div className="flex gap-1">
                  {mode === "active" ? (
                    <button
                      onClick={() => archive(c.id, true)}
                      disabled={busy === c.id}
                      className="btn btn-ghost btn-sm"
                      title="Archivieren — verschiebt in Archiv-Section"
                      type="button"
                    >
                      <Archive size={12} /> Archivieren
                    </button>
                  ) : (
                    <button
                      onClick={() => archive(c.id, false)}
                      disabled={busy === c.id}
                      className="btn btn-ghost btn-sm"
                      title="Wiederherstellen"
                      type="button"
                    >
                      <ArchiveRestore size={12} /> Wiederherstellen
                    </button>
                  )}
                  <button
                    onClick={() => hardDelete(c.id, c.title)}
                    disabled={busy === c.id}
                    className="btn btn-ghost btn-sm"
                    title="Endgültig löschen (unwiderruflich)"
                    type="button"
                    style={{ color: "rgb(220 38 38)" }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
