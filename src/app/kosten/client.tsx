"use client";

import { useEffect, useState, useMemo } from "react";
import { Coins, Calendar, Users, Filter, Download, RefreshCw } from "lucide-react";
import { formatEur, formatUsd } from "@/lib/pricing";

interface UsageRow {
  id: string;
  createdAt: string;
  userName: string;
  userEmail: string;
  comparisonId: string | null;
  provider: string;
  model: string;
  kind: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  costEur: number;
  runMs: number;
  errorMessage: string | null;
}

interface CostsResponse {
  scope: "mine" | "all";
  period: "day" | "month" | "year" | "all";
  canSwitchScope: boolean;
  rows: UsageRow[];
  byUser: Record<string, { eur: number; usd: number; calls: number; tokens: number; email: string }>;
  byMonth: Record<string, { eur: number; usd: number; calls: number }>;
  byProvider: Record<string, { eur: number; usd: number; calls: number }>;
  total: { eur: number; usd: number; calls: number; tokens: number };
}

type SortKey = "createdAt" | "userName" | "provider" | "kind" | "tokens" | "costEur";

export default function KostenClient({ isAdmin, userName: _userName }: { isAdmin: boolean; userName: string }) {
  const [data, setData] = useState<CostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"day" | "month" | "year" | "all">("month");
  const [scope, setScope] = useState<"mine" | "all">(isAdmin ? "all" : "mine");
  const [filterUser, setFilterUser] = useState("");
  const [filterProvider, setFilterProvider] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/angebotsvergleich/api/costs?period=${period}&scope=${scope}`);
      const j = await res.json();
      setData(j);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [period, scope]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    let rows = data.rows;
    if (filterUser) rows = rows.filter((r) => r.userName.toLowerCase().includes(filterUser.toLowerCase()));
    if (filterProvider) rows = rows.filter((r) => r.provider === filterProvider);
    if (filterKind) rows = rows.filter((r) => r.kind === filterKind);

    const sorted = [...rows].sort((a, b) => {
      let x: number | string, y: number | string;
      switch (sortKey) {
        case "userName": x = a.userName; y = b.userName; break;
        case "provider": x = a.provider; y = b.provider; break;
        case "kind": x = a.kind; y = b.kind; break;
        case "tokens": x = a.inputTokens + a.outputTokens; y = b.inputTokens + b.outputTokens; break;
        case "costEur": x = a.costEur; y = b.costEur; break;
        default: x = a.createdAt; y = b.createdAt;
      }
      const cmp = x < y ? -1 : x > y ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, filterUser, filterProvider, filterKind, sortKey, sortDir]);

  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  function exportCsv() {
    if (!data) return;
    const head = ["Zeitpunkt", "User", "Email", "Provider", "Modell", "Art", "Input-Tok", "Output-Tok", "Cost USD", "Cost EUR", "Laufzeit ms", "Vergleich"];
    const rows = filteredRows.map((r) => [
      new Date(r.createdAt).toISOString(),
      r.userName, r.userEmail, r.provider, r.model, r.kind,
      String(r.inputTokens), String(r.outputTokens),
      r.costUsd.toFixed(6), r.costEur.toFixed(6),
      String(r.runMs), r.comparisonId || "",
    ]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${c.replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `angebotsvergleich-kosten-${period}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const byMonthSorted = useMemo(() => {
    if (!data) return [] as Array<{ month: string; eur: number; calls: number }>;
    return Object.entries(data.byMonth)
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data]);

  const maxMonthEur = useMemo(() => Math.max(0.001, ...byMonthSorted.map((m) => m.eur)), [byMonthSorted]);

  const userSorted = useMemo(() => {
    if (!data) return [] as Array<{ user: string; eur: number; calls: number; tokens: number; email: string }>;
    return Object.entries(data.byUser).map(([user, v]) => ({ user, ...v })).sort((a, b) => b.eur - a.eur);
  }, [data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Coins size={22} /> KI-Kosten</h1>
        <button onClick={load} disabled={loading} className="btn btn-ghost ml-auto" title="Neu laden"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        <button onClick={exportCsv} className="btn btn-ghost"><Download size={14} /> CSV</button>
      </div>

      {/* Filter-Bar */}
      <div className="card flex items-center gap-2 flex-wrap">
        <Calendar size={16} className="opacity-60" />
        <div className="flex gap-1">
          {(["day", "month", "year", "all"] as const).map((p) => (
            <button key={p} onClick={() => setPeriod(p)} className={`btn ${period === p ? "btn-primary" : "btn-ghost"} btn-sm`}>
              {p === "day" ? "Heute" : p === "month" ? "Monat" : p === "year" ? "Jahr" : "Gesamt"}
            </button>
          ))}
        </div>
        {data?.canSwitchScope && (
          <>
            <span className="opacity-30">|</span>
            <Users size={16} className="opacity-60" />
            <div className="flex gap-1">
              <button onClick={() => setScope("mine")} className={`btn ${scope === "mine" ? "btn-primary" : "btn-ghost"} btn-sm`}>Nur ich</button>
              <button onClick={() => setScope("all")} className={`btn ${scope === "all" ? "btn-primary" : "btn-ghost"} btn-sm`}>Alle User</button>
            </div>
          </>
        )}
      </div>

      {/* Total-Karten */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="card text-center">
            <div className="text-xs opacity-60 uppercase">Gesamt EUR</div>
            <div className="text-2xl font-bold">{formatEur(data.total.eur)}</div>
            <div className="text-xs opacity-60">{formatUsd(data.total.usd)}</div>
          </div>
          <div className="card text-center">
            <div className="text-xs opacity-60 uppercase">Calls</div>
            <div className="text-2xl font-bold">{data.total.calls}</div>
          </div>
          <div className="card text-center">
            <div className="text-xs opacity-60 uppercase">Tokens</div>
            <div className="text-2xl font-bold">{data.total.tokens.toLocaleString("de-DE")}</div>
          </div>
          <div className="card text-center">
            <div className="text-xs opacity-60 uppercase">Ø/Call</div>
            <div className="text-2xl font-bold">{data.total.calls > 0 ? formatEur(data.total.eur / data.total.calls) : "—"}</div>
          </div>
        </div>
      )}

      {/* Monatlicher Verlauf */}
      {byMonthSorted.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-sm mb-3">Verlauf nach Monaten</h2>
          <div className="space-y-1">
            {byMonthSorted.map((m) => (
              <div key={m.month} className="flex items-center gap-2 text-xs">
                <span className="w-16 font-mono opacity-70">{m.month}</span>
                <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden" style={{ background: "rgb(var(--accent))" }}>
                  <div className="h-full rounded" style={{ width: `${(m.eur / maxMonthEur) * 100}%`, background: "rgb(124 58 237)" }} />
                </div>
                <span className="w-24 text-right font-mono">{formatEur(m.eur)}</span>
                <span className="w-12 text-right opacity-60">{m.calls}×</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pro User (nur sichtbar wenn scope=all) */}
      {data && scope === "all" && userSorted.length > 0 && (
        <div className="card overflow-x-auto">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><Users size={14} /> Pro Nutzer</h2>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                <th className="text-left p-2">User</th>
                <th className="text-right p-2">Calls</th>
                <th className="text-right p-2">Tokens</th>
                <th className="text-right p-2">Kosten</th>
              </tr>
            </thead>
            <tbody>
              {userSorted.map((u) => (
                <tr key={u.user} style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                  <td className="p-2"><div className="font-medium">{u.user}</div><div className="text-xs opacity-60">{u.email}</div></td>
                  <td className="p-2 text-right font-mono">{u.calls}</td>
                  <td className="p-2 text-right font-mono">{u.tokens.toLocaleString("de-DE")}</td>
                  <td className="p-2 text-right font-mono font-semibold">{formatEur(u.eur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail-Tabelle (sortier-/filterbar) */}
      {data && (
        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Filter size={14} /> Einzel-Calls ({filteredRows.length})</h2>
            <div className="flex gap-2 flex-wrap text-xs">
              {data.canSwitchScope && (
                <input value={filterUser} onChange={(e) => setFilterUser(e.target.value)} placeholder="User filtern…" className="input input-sm w-32" />
              )}
              <select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)} className="input input-sm">
                <option value="">Alle Provider</option>
                {Object.keys(data.byProvider).map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className="input input-sm">
                <option value="">Alle Arten</option>
                <option value="comparison">Vergleich</option>
                <option value="followup">Follow-up</option>
                <option value="settings-test">Test</option>
              </select>
            </div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                <th onClick={() => toggleSort("createdAt")} className="text-left p-2 cursor-pointer hover:bg-white/5">Zeitpunkt {sortKey === "createdAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>
                {data.canSwitchScope && <th onClick={() => toggleSort("userName")} className="text-left p-2 cursor-pointer hover:bg-white/5">User {sortKey === "userName" ? (sortDir === "asc" ? "↑" : "↓") : ""}</th>}
                <th onClick={() => toggleSort("provider")} className="text-left p-2 cursor-pointer hover:bg-white/5">Provider</th>
                <th className="text-left p-2">Modell</th>
                <th onClick={() => toggleSort("kind")} className="text-left p-2 cursor-pointer hover:bg-white/5">Art</th>
                <th onClick={() => toggleSort("tokens")} className="text-right p-2 cursor-pointer hover:bg-white/5">Tokens</th>
                <th onClick={() => toggleSort("costEur")} className="text-right p-2 cursor-pointer hover:bg-white/5">EUR</th>
                <th className="text-left p-2">Vergleich</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid rgb(var(--border))" }} className={r.errorMessage ? "opacity-60" : ""}>
                  <td className="p-2 font-mono">{new Date(r.createdAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</td>
                  {data.canSwitchScope && <td className="p-2">{r.userName}</td>}
                  <td className="p-2">{r.provider}</td>
                  <td className="p-2 opacity-70">{r.model}</td>
                  <td className="p-2"><span className="badge">{r.kind}</span></td>
                  <td className="p-2 text-right font-mono">{(r.inputTokens + r.outputTokens).toLocaleString("de-DE")}</td>
                  <td className="p-2 text-right font-mono font-semibold">{formatEur(r.costEur)}</td>
                  <td className="p-2">{r.comparisonId ? <a href={`/angebotsvergleich/${r.comparisonId}`} className="text-purple-600 hover:underline">öffnen</a> : "—"}</td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr><td colSpan={data.canSwitchScope ? 8 : 7} className="text-center opacity-50 py-6">Keine Eintraege im gewaehlten Zeitraum</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
