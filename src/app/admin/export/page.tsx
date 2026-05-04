import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import ExportClient from "./client";

export const dynamic = "force-dynamic";

export default async function AdminExportPage() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  if (!user.isAdmin) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold mb-2">Daten-Export</h1>
        <p className="text-sm opacity-70">Nur fuer Admins.</p>
      </div>
    );
  }

  // Stats pro Jahr
  const rows = await prisma.$queryRaw<Array<{ year: number; comparisons: bigint; offers: bigint; followups: bigint; usage: bigint }>>`
    SELECT
      EXTRACT(YEAR FROM c.created_at)::int AS year,
      COUNT(DISTINCT c.id)::bigint AS comparisons,
      COUNT(DISTINCT o.id)::bigint AS offers,
      COUNT(DISTINCT f.id)::bigint AS followups,
      0::bigint AS usage
    FROM comparisons c
    LEFT JOIN offers o ON o.comparison_id = c.id
    LEFT JOIN comparison_followups f ON f.comparison_id = c.id
    GROUP BY EXTRACT(YEAR FROM c.created_at)
    ORDER BY year DESC
  `;
  const usageByYear = await prisma.$queryRaw<Array<{ year: number; usage: bigint }>>`
    SELECT EXTRACT(YEAR FROM created_at)::int AS year, COUNT(*)::bigint AS usage
    FROM ai_usage GROUP BY EXTRACT(YEAR FROM created_at) ORDER BY year DESC
  `;
  const usageMap = new Map(usageByYear.map((u) => [u.year, Number(u.usage)]));

  const years = rows.map((r) => ({
    year: r.year,
    comparisons: Number(r.comparisons),
    offers: Number(r.offers),
    followups: Number(r.followups),
    usage: usageMap.get(r.year) || 0,
  }));

  return <ExportClient years={years} />;
}
