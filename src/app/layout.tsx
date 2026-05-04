import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import ThemeToggle from "./theme-toggle";
import { I18nProvider, LanguageToggle } from "@/lib/i18n-provider";
import { getServerT } from "@/lib/i18n-server";
import { LayoutDashboard, FilePlus, Bell, Settings, Coins, Archive, Download } from "lucide-react";

export const metadata: Metadata = {
  title: "Angebotsvergleich · ID Engineering",
  description: "KI-gestuetzter Angebotsvergleich mit Claude",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getServerT();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <I18nProvider initialLocale={locale}>
        <div className="min-h-screen flex">
          <aside className="w-56 border-r p-3 hidden md:flex md:flex-col gap-1" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--muted))" }}>
            <div className="px-2 py-3 mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-bold text-base">{t("app.title")}</div>
                <div className="text-xs opacity-70">{t("app.subtitle")}</div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                <ThemeToggle />
                <LanguageToggle />
              </div>
            </div>
            {/* External Link — Next.js basePath-aware <Link> haengt /angebotsvergleich davor.
                Wir wollen aber das echte Portal-Root, nicht /angebotsvergleich/portal. */}
            <a href="/portal/" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2 opacity-70">
              ← {t("nav.portal")}
            </a>
            <Link href="/" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <LayoutDashboard size={16} /> {t("nav.comparisons")}
            </Link>
            <Link href="/neu" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <FilePlus size={16} /> {t("nav.new")}
            </Link>
            <Link href="/kosten" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <Coins size={16} /> {t("nav.costs")}
            </Link>
            <Link href="/archiv" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <Archive size={16} /> {t("nav.archive")}
            </Link>
            <Link href="/benachrichtigungen" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <Bell size={16} /> {t("nav.notifications")}
            </Link>
            <Link href="/admin/export" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2 opacity-60 mt-auto" title="Admin: Daten-Export">
              <Download size={16} /> {t("nav.export")}
            </Link>
            <Link href="/einstellungen" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <Settings size={16} /> {t("nav.settings")}
            </Link>
          </aside>
          <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">{children}</main>
        </div>
        </I18nProvider>
      </body>
    </html>
  );
}
