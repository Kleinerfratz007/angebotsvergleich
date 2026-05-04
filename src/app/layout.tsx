import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";
import { LayoutDashboard, FilePlus, Bell } from "lucide-react";

export const metadata: Metadata = {
  title: "Angebotsvergleich · ID Engineering",
  description: "KI-gestuetzter Angebotsvergleich mit Claude",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>
        <div className="min-h-screen flex">
          <aside className="w-56 border-r p-3 hidden md:flex md:flex-col gap-1" style={{ borderColor: "rgb(var(--border))", background: "rgb(var(--muted))" }}>
            <div className="px-2 py-3 mb-2">
              <div className="font-bold text-base">Angebotsvergleich</div>
              <div className="text-xs opacity-70">KI-gestuetzt mit Claude</div>
            </div>
            <Link href="/portal/" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2 opacity-70">
              ← Zum Portal
            </Link>
            <Link href="/" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <LayoutDashboard size={16} /> Meine Vergleiche
            </Link>
            <Link href="/neu" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <FilePlus size={16} /> Neuer Vergleich
            </Link>
            <Link href="/benachrichtigungen" className="px-3 py-2 rounded-md text-sm hover:bg-white/10 flex items-center gap-2">
              <Bell size={16} /> Benachrichtigungen
            </Link>
          </aside>
          <main className="flex-1 p-4 md:p-6 max-w-6xl mx-auto w-full">{children}</main>
        </div>
      </body>
    </html>
  );
}
