"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type Mode = "light" | "dark" | "auto";

const KEY = "angebot.theme";

function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  if (mode === "auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", mode);
}

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("auto");

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) as Mode | null;
    const initial = saved && ["light", "dark", "auto"].includes(saved) ? saved : "auto";
    setMode(initial);
    applyMode(initial);
  }, []);

  function set(m: Mode) {
    setMode(m);
    applyMode(m);
    try { localStorage.setItem(KEY, m); } catch { /* ignore */ }
  }

  return (
    <div className="flex items-center gap-1 px-1 py-1 rounded-md" style={{ background: "rgb(var(--muted))" }} title="Theme: hell / dunkel / system">
      <button
        type="button"
        onClick={() => set("light")}
        className={`p-1 rounded ${mode === "light" ? "bg-white/30" : "opacity-50 hover:opacity-100"}`}
        aria-label="Helles Theme"
        title="Hell"
      >
        <Sun size={14} />
      </button>
      <button
        type="button"
        onClick={() => set("auto")}
        className={`p-1 rounded ${mode === "auto" ? "bg-white/30" : "opacity-50 hover:opacity-100"}`}
        aria-label="System-Theme"
        title="System"
      >
        <Monitor size={14} />
      </button>
      <button
        type="button"
        onClick={() => set("dark")}
        className={`p-1 rounded ${mode === "dark" ? "bg-white/30" : "opacity-50 hover:opacity-100"}`}
        aria-label="Dunkles Theme"
        title="Dunkel"
      >
        <Moon size={14} />
      </button>
    </div>
  );
}
