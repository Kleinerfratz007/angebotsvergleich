import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Archive } from "lucide-react";
import VergleichsListe from "../vergleichs-liste";

export const dynamic = "force-dynamic";

export default async function ArchivPage() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  if (!user.hasAccess) redirect("/");

  const comparisons = await prisma.comparison.findMany({
    where: { userId: user.id, archivedAt: { not: null } },
    orderBy: { archivedAt: "desc" },
    take: 200,
    include: { offers: { select: { id: true, supplierName: true, ranking: true } } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/" className="opacity-60 hover:opacity-100"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Archive size={22} /> Archiv</h1>
        <span className="badge ml-auto" style={{ background: "rgb(229 231 235)", color: "rgb(75 85 99)" }}>{comparisons.length}</span>
      </div>

      <p className="text-xs opacity-70">
        Hier liegen archivierte Vergleiche. „Wiederherstellen" verschiebt zurück nach „Meine Vergleiche". „Löschen" entfernt unwiderruflich.
      </p>

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
        mode="archive"
      />
    </div>
  );
}
