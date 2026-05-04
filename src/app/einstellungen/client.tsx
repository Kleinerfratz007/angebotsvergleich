"use client";

import { useEffect, useState } from "react";
import { Save, KeyRound, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface SettingItem {
  key: string;
  masked: string;
  source: "db" | "env" | "none";
  updatedAt?: string;
}

const KEY_META: Record<string, { label: string; help: string; link?: string; type: "secret" | "text"; group: "claude" | "gemini" | "common" }> = {
  ANTHROPIC_API_KEY: { label: "Anthropic API-Key (Claude)", help: "sk-ant-api03-...", link: "https://console.anthropic.com/settings/keys", type: "secret", group: "claude" },
  ANTHROPIC_MODEL: { label: "Claude-Modell (optional)", help: "Default: claude-opus-4-7", type: "text", group: "claude" },
  GOOGLE_API_KEY: { label: "Google API-Key (Gemini)", help: "AIzaSy...", link: "https://aistudio.google.com/app/apikey", type: "secret", group: "gemini" },
  GEMINI_MODEL: { label: "Gemini-Modell (optional)", help: "Default: gemini-3.1-pro", type: "text", group: "gemini" },
  AI_PROVIDER_DEFAULT: { label: "Default-Provider", help: "claude oder gemini (Default: claude)", type: "text", group: "common" },
};

export default function SettingsClient() {
  const [items, setItems] = useState<SettingItem[]>([]);
  const [encryptionOk, setEncryptionOk] = useState(true);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function load() {
    const res = await fetch("/angebotsvergleich/api/settings");
    const data = await res.json();
    setItems(data.items || []);
    setEncryptionOk(Boolean(data.encryptionConfigured));
  }
  useEffect(() => { load(); }, []);

  async function save(key: string) {
    setSaving(key);
    setMsg(null);
    try {
      const value = editing[key] ?? "";
      const res = await fetch("/angebotsvergleich/api/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data.error || "Fehler" });
      } else {
        setMsg({ kind: "ok", text: data.deleted ? `${key} geloescht` : `${key} gespeichert` });
        setEditing({ ...editing, [key]: "" });
        load();
      }
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(null);
    }
  }

  async function testProvider(provider: "claude" | "gemini") {
    setTesting(provider);
    setMsg(null);
    try {
      const res = await fetch("/angebotsvergleich/api/settings/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.ok) {
        setMsg({ kind: "ok", text: `${provider}: ${data.model} → "${data.response}" (${data.tokens?.input_tokens || data.tokens?.promptTokenCount || "?"} in / ${data.tokens?.output_tokens || data.tokens?.candidatesTokenCount || "?"} out tokens)` });
      } else {
        setMsg({ kind: "err", text: `${provider}: ${data.error}` });
      }
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setTesting(null);
    }
  }

  const claudeKeyConfigured = items.find((i) => i.key === "ANTHROPIC_API_KEY")?.source !== "none";
  const geminiKeyConfigured = items.find((i) => i.key === "GOOGLE_API_KEY")?.source !== "none";

  function renderItem(s: SettingItem, dimmed: boolean) {
    const meta = KEY_META[s.key];
    if (!meta) return null;
    return (
      <div key={s.key} className={`card space-y-2 ${dimmed ? "opacity-50" : ""}`} style={dimmed ? { background: "rgb(248 250 252)" } : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-semibold text-sm">{meta.label}</div>
            <div className="text-xs opacity-60">{meta.help}</div>
          </div>
          <div className="text-right text-xs opacity-60">
            {s.source === "db" && <span className="text-green-700">✓ in DB</span>}
            {s.source === "env" && <span className="text-blue-700">env-Fallback</span>}
            {s.source === "none" && <span className="opacity-50">noch nicht gesetzt</span>}
            {s.updatedAt && <div>{new Date(s.updatedAt).toLocaleString("de-DE")}</div>}
          </div>
        </div>
        {s.masked && (
          <div className="text-xs font-mono p-2 rounded" style={{ background: "rgb(var(--accent))" }}>
            Aktuell: {s.masked}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type={meta.type === "secret" ? "password" : "text"}
            value={editing[s.key] || ""}
            onChange={(e) => setEditing({ ...editing, [s.key]: e.target.value })}
            placeholder={s.masked ? "Neuen Wert eingeben oder leer lassen" : meta.help}
            className="input"
            disabled={!encryptionOk || saving === s.key}
          />
          <button onClick={() => save(s.key)} disabled={!encryptionOk || saving === s.key} className="btn btn-primary">
            <Save size={14} />
            {saving === s.key ? "…" : "Speichern"}
          </button>
          {meta.link && (
            <a href={meta.link} target="_blank" rel="noopener" className="btn btn-ghost"><ExternalLink size={14} /></a>
          )}
        </div>
      </div>
    );
  }

  const claudeItems = items.filter((i) => KEY_META[i.key]?.group === "claude");
  const geminiItems = items.filter((i) => KEY_META[i.key]?.group === "gemini");
  const commonItems = items.filter((i) => KEY_META[i.key]?.group === "common");

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><KeyRound size={22} /> KI-Provider-Einstellungen</h1>
        <p className="text-sm opacity-70">Werte werden AES-256-GCM-verschluesselt in DB gespeichert.</p>
      </div>

      {!encryptionOk && (
        <div className="card border-red-300 text-red-800 text-sm" style={{ background: "rgb(254 226 226)", borderColor: "rgb(252 165 165)" }}>
          <div className="flex items-center gap-2 font-semibold mb-1"><AlertCircle size={16} /> APP_ENCRYPTION_KEY nicht gesetzt</div>
          <p>Server-Admin muss in <code>/root/.id-portal-secrets.env</code> eine Zeile <code>APP_ENCRYPTION_KEY=&lt;64 hex&gt;</code> setzen und Container neu starten.</p>
        </div>
      )}

      {msg && (
        <div className={`card text-sm ${msg.kind === "ok" ? "border-green-300" : "border-red-300"}`} style={{ background: msg.kind === "ok" ? "rgb(220 252 231)" : "rgb(254 226 226)" }}>
          {msg.kind === "ok" ? "✅ " : "❌ "}{msg.text}
        </div>
      )}

      {/* Claude — der primaere Provider */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold opacity-70 uppercase">🟣 Claude (Anthropic) {claudeKeyConfigured && <span className="text-green-700 text-xs normal-case opacity-100">aktiv</span>}</h2>
        {claudeItems.map((s) => renderItem(s, false))}
        <div className="card">
          <button onClick={() => testProvider("claude")} disabled={testing !== null || !claudeKeyConfigured} className="btn btn-ghost">
            <CheckCircle2 size={14} /> Claude testen {testing === "claude" ? "…" : ""}
          </button>
          {!claudeKeyConfigured && <p className="text-xs opacity-60 mt-2">Erst API-Key oben eintragen, dann testen.</p>}
        </div>
      </div>

      {/* Gemini — DIMMED solange kein Key */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold opacity-70 uppercase">
          {geminiKeyConfigured ? "🔵 Gemini (Google)" : <span style={{ textDecoration: "line-through" }}>🔵 Gemini (Google) — deaktiviert</span>}
          {geminiKeyConfigured && <span className="text-green-700 text-xs normal-case opacity-100"> aktiv</span>}
        </h2>
        {!geminiKeyConfigured && (
          <div className="card text-xs opacity-70" style={{ background: "rgb(241 245 249)" }}>
            <p>Gemini ist als Provider vorbereitet, wird aber erst aktiv sobald oben ein <code>GOOGLE_API_KEY</code> gespeichert wird. Bis dahin laeuft alles ueber Claude.</p>
          </div>
        )}
        {geminiItems.map((s) => renderItem(s, !geminiKeyConfigured))}
        {geminiKeyConfigured && (
          <div className="card">
            <button onClick={() => testProvider("gemini")} disabled={testing !== null} className="btn btn-ghost">
              <CheckCircle2 size={14} /> Gemini testen {testing === "gemini" ? "…" : ""}
            </button>
          </div>
        )}
      </div>

      {/* Gemeinsame Settings (Default-Provider) */}
      {commonItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold opacity-70 uppercase">⚙️ Allgemein</h2>
          {commonItems.map((s) => renderItem(s, !geminiKeyConfigured && s.key === "AI_PROVIDER_DEFAULT"))}
        </div>
      )}

      <div className="card text-xs opacity-70">
        <p><strong>So bekommst du die Keys:</strong></p>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><strong>Anthropic Claude</strong>: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" className="text-purple-600 hover:underline">console.anthropic.com/settings/keys</a> → Create Key</li>
          <li><strong>Google Gemini</strong>: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="text-purple-600 hover:underline">aistudio.google.com/app/apikey</a> → Create API key</li>
        </ul>
      </div>
    </div>
  );
}
