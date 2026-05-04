import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { FilePlus, Sparkles, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_BADGE: Record<string, { label: string; className: string; Icon: typeof Clock }> = {
  DRAFT: { label: "Entwurf", className: "bg-gray-100 text-gray-700", Icon: Clock },
  PROCESSING: { label: "KI laeuft…", className: "bg-blue-100 text-blue-700", Icon: Sparkles },
  DONE: { label: "Fertig", className: "bg-green-100 text-green-700", Icon: CheckCircle2 },
  ERROR: { label: "Fehler", className: "bg-red-100 text-red-700", Icon: AlertCircle },
};

export default async function HomePage() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");

  const comparisons = await prisma.comparison.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { offers: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meine Angebotsvergleiche</h1>
          <p className="text-sm opacity-70">Vergleiche 2-10 Angebote mit Claude-Opus-Unterstuetzung</p>
        </div>
        <Link href="/neu" className="btn btn-primary">
          <FilePlus size={16} /> Neuer Vergleich
        </Link>
      </div>

      {comparisons.length === 0 ? (
        <div className="card text-center py-10">
          <Sparkles size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm opacity-70 mb-4">Noch keine Vergleiche. Lade 2 oder mehr Angebote hoch und lass die KI sie analysieren.</p>
          <Link href="/neu" className="btn btn-primary inline-flex">
            <FilePlus size={16} /> Ersten Vergleich anlegen
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {comparisons.map((c) => {
            const badge = STATUS_BADGE[c.status];
            const Icon = badge.Icon;
            return (
              <Link key={c.id} href={`/${c.id}`} className="card hover:border-purple-500 transition-colors block">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{c.title}</div>
                    <div className="text-xs opacity-60 mt-1 flex flex-wrap gap-3">
                      <span>{c._count.offers} Angebote</span>
                      {c.customerName && <span>· {c.customerName}</span>}
                      <span>· {new Date(c.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}</span>
                    </div>
                    {c.resultSummary && (
                      <p className="text-sm mt-2 opacity-80 line-clamp-2">{c.resultSummary}</p>
                    )}
                  </div>
                  <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${badge.className}`}>
                    <Icon size={12} /> {badge.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
