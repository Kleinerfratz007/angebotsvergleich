"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Languages } from "lucide-react";
import { type Locale, LOCALES, COOKIE_NAME, getDict, makeT } from "./i18n";

interface Ctx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale: Locale; children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    // Cookie setzen (1 Jahr gueltig)
    document.cookie = `${COOKIE_NAME}=${l}; Path=/angebotsvergleich; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    document.documentElement.lang = l;
    // Server-Components-Reload
    setTimeout(() => window.location.reload(), 100);
  }, []);

  const t = useMemo(() => makeT(locale), [locale]);

  // HTML lang attribute aktuell halten
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const value = useMemo<Ctx>(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback: DE als Default wenn Provider fehlt (Build-Time)
    return { locale: "de", setLocale: () => {}, t: makeT("de") };
  }
  return ctx;
}

export function useT() {
  return useI18n().t;
}

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex items-center gap-1 px-1 py-1 rounded-md text-xs" style={{ background: "rgb(var(--muted))" }} title="Sprache / Language">
      <Languages size={12} className="opacity-60 ml-0.5" />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          className={`px-1.5 py-0.5 rounded uppercase font-mono ${locale === l ? "bg-white/30 font-bold" : "opacity-50 hover:opacity-100"}`}
          aria-label={l === "de" ? "Deutsch" : "English"}
          aria-pressed={locale === l}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
