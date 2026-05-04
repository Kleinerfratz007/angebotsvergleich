import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FilePlus, Lock } from "lucide-react";
import VergleichsListe from "./vergleichs-liste";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");

  if (!user.hasAccess) {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="card border-amber-300" style={{ background: "rgb(254 243 199)", borderColor: "rgb(252 211 77)" }}>
          <div className="flex items-start gap-3">
            <Lock size={28} className="text-amber-600 shrink-0 mt-1" />
            <div>
              <h1 className="text-xl font-bold mb-1">Kein Zugriff</h1>
              <p className="text-sm">Diese App ist derzeit nur f&uuml;r Mitarbeiter aus dem <strong>Einkauf</strong> sowie f&uuml;r Admins freigegeben.</p>
              <p className="text-xs opacity-70 mt-2">
                Angemeldet als: <code>{user.email}</code><br />
                Authentik-Gruppen: {user.groups.length > 0 ? user.groups.map((g) => <code key={g} className="mx-1">{g}</code>) : <em>keine</em>}
              </p>
              <p className="text-xs mt-3">Bei Fragen: <a href="mailto:sartor.m@id-engineering.com" className="text-purple-600 underline">sartor.m@id-engineering.com</a></p>
              <a href="/portal/" className="btn btn-primary mt-3 inline-flex"><span>← Zur&uuml;ck zum Portal</span></a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Liste: nur NICHT archivierte
  const comparisons = await prisma.comparison.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { offers: { select: { id: true, supplierName: true, ranking: true } } },
  });

  // Anzahl archivierter (für Sidebar-Badge / Hint)
  const archivedCount = await prisma.comparison.count({
    where: { userId: user.id, archivedAt: { not: null } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meine Vergleiche</h1>
          {archivedCount > 0 && (
            <p className="text-xs opacity-60 mt-1">
              {archivedCount} archiviert · <Link href="/archiv" className="text-purple-600 hover:underline">Archiv ansehen →</Link>
            </p>
          )}
        </div>
        <Link href="/neu" className="btn btn-primary"><FilePlus size={16} /> Neuer Vergleich</Link>
      </div>

      <VergleichsListe
        items={comparisons.map((c) => ({
          id: c.id,
          title: c.title,
          customerName: c.customerName,
          status: c.status,
          resultSummary: c.resultSummary,
          createdAt: c.createdAt.toISOString(),
          archivedAt: c.archivedAt?.toISOString() || null,
          offerCount: c.offers.length,
          winner: c.offers.find((o) => o.ranking === 1)?.supplierName || null,
        }))}
        mode="active"
      />
    </div>
  );
}
