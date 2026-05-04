import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FilePlus, Trophy, Sparkles, AlertCircle, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");

  // Authorization: Admin oder Group "Einkauf"
  if (!user.hasAccess) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="card border-amber-300" style={{ background: "rgb(254 243 199)", borderColor: "rgb(252 211 77)" }}>
          <div className="flex items-start gap-3">
            <Lock size={28} className="text-amber-600 shrink-0 mt-1" />
            <div>
              <h1 className="text-xl font-bold mb-1">Kein Zugriff</h1>
              <p className="text-sm">
                Diese App ist derzeit nur f&uuml;r Mitarbeiter aus dem <strong>Einkauf</strong> sowie f&uuml;r Admins freigegeben.
              </p>
              <p className="text-xs opacity-70 mt-2">
                Angemeldet als: <code>{user.email}</code><br />
                Authentik-Gruppen: {user.groups.length > 0 ? user.groups.map((g) => <code key={g} className="mx-1">{g}</code>) : <em>keine</em>}
              </p>
              <p className="text-xs mt-3">
                Bei Fragen: <a href="mailto:sartor.m@id-engineering.com" className="text-purple-600 underline">sartor.m@id-engineering.com</a>
              </p>
              <a href="/portal/" className="btn btn-primary mt-3 inline-flex"><span>← Zur&uuml;ck zum Portal</span></a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const comparisons = await prisma.comparison.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { offers: { select: { id: true, supplierName: true, ranking: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Meine Vergleiche</h1>
        <Link href="/neu" className="btn btn-primary"><FilePlus size={16} /> Neuer Vergleich</Link>
      </div>

      {comparisons.length === 0 && (
        <div className="card text-center py-10">
          <Sparkles size={32} className="mx-auto opacity-40 mb-3" />
          <p className="text-sm opacity-70">Noch keine Vergleiche. Lege deinen ersten an, um Angebote von 2-10 Lieferanten KI-gestuetzt zu vergleichen.</p>
          <Link href="/neu" className="btn btn-primary mt-4 inline-flex"><FilePlus size={16} /> Ersten Vergleich anlegen</Link>
        </div>
      )}

      <ul className="space-y-2">
        {comparisons.map((c) => {
          const winner = c.offers.find((o) => o.ranking === 1);
          return (
            <li key={c.id}>
              <Link href={`/${c.id}`} className="card block hover:shadow-md transition">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold truncate">{c.title}</h2>
                    <div className="text-xs opacity-60 mt-1 flex flex-wrap gap-2">
                      {c.customerName && <span>{c.customerName}</span>}
                      <span>· {c.offers.length} Angebote</span>
                      <span>· {new Date(c.createdAt).toLocaleDateString("de-DE")}</span>
                    </div>
                    {c.resultSummary && (
                      <p className="text-sm mt-2 opacity-80 line-clamp-2">{c.resultSummary}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs">
                    {c.status === "DRAFT" && <span className="badge" style={{ background: "rgb(229 231 235)", color: "rgb(75 85 99)" }}>Entwurf</span>}
                    {c.status === "PROCESSING" && <span className="badge" style={{ background: "rgb(219 234 254)", color: "rgb(29 78 216)" }}><Sparkles size={10} className="inline animate-pulse" /> KI laeuft</span>}
                    {c.status === "DONE" && winner && <span className="badge" style={{ background: "rgb(254 249 195)", color: "rgb(146 64 14)" }}><Trophy size={10} className="inline" /> {winner.supplierName}</span>}
                    {c.status === "ERROR" && <span className="badge text-red-700" style={{ background: "rgb(254 226 226)" }}><AlertCircle size={10} className="inline" /> Fehler</span>}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
