import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * GET /api/costs?period=day|month|year|all&scope=mine|all
 *
 * Aggregiert AiUsage-Records.
 *  - scope=mine: nur eigene (default fuer Non-Admin)
 *  - scope=all:  alle (nur Admin)
 *
 * Liefert:
 *  - rows: Einzel-Records (limit 500)
 *  - byUser: { userName: { eur: n, usd: n, calls: n } }
 *  - byMonth: { "2026-05": { eur: n, ... } }
 *  - byProvider: { claude: { eur: ... } }
 *  - total: { eur, usd, calls }
 */
export async function GET(req: NextRequest) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const period = url.searchParams.get("period") || "all";
  const scopeParam = url.searchParams.get("scope") || "mine";
  const scope: "mine" | "all" = scopeParam === "all" && user.isAdmin ? "all" : "mine";

  const now = new Date();
  let from: Date | null = null;
  if (period === "day") from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === "month") from = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (period === "year") from = new Date(now.getFullYear(), 0, 1);

  const where: Record<string, unknown> = {};
  if (scope === "mine") where.userId = user.id;
  if (from) where.createdAt = { gte: from };

  const rows = await prisma.aiUsage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    select: {
      id: true, createdAt: true, userName: true, userEmail: true, comparisonId: true,
      provider: true, model: true, kind: true,
      inputTokens: true, outputTokens: true, costUsd: true, costEur: true,
      runMs: true, errorMessage: true,
    },
  });

  // Aggregations (alle gefilterten, nicht nur die 500)
  const all = await prisma.aiUsage.findMany({
    where,
    select: {
      userName: true, userEmail: true, provider: true, model: true,
      inputTokens: true, outputTokens: true, costUsd: true, costEur: true, createdAt: true,
    },
  });

  const byUser: Record<string, { eur: number; usd: number; calls: number; tokens: number; email: string }> = {};
  const byMonth: Record<string, { eur: number; usd: number; calls: number }> = {};
  const byProvider: Record<string, { eur: number; usd: number; calls: number }> = {};
  let totalEur = 0, totalUsd = 0, totalCalls = 0, totalTokens = 0;

  for (const r of all) {
    const eur = Number(r.costEur);
    const usd = Number(r.costUsd);
    const tokens = (r.inputTokens || 0) + (r.outputTokens || 0);
    totalEur += eur; totalUsd += usd; totalCalls++; totalTokens += tokens;

    const u = r.userName || "(unknown)";
    if (!byUser[u]) byUser[u] = { eur: 0, usd: 0, calls: 0, tokens: 0, email: r.userEmail || "" };
    byUser[u].eur += eur; byUser[u].usd += usd; byUser[u].calls++; byUser[u].tokens += tokens;

    const monthKey = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, "0")}`;
    if (!byMonth[monthKey]) byMonth[monthKey] = { eur: 0, usd: 0, calls: 0 };
    byMonth[monthKey].eur += eur; byMonth[monthKey].usd += usd; byMonth[monthKey].calls++;

    const p = r.provider || "unknown";
    if (!byProvider[p]) byProvider[p] = { eur: 0, usd: 0, calls: 0 };
    byProvider[p].eur += eur; byProvider[p].usd += usd; byProvider[p].calls++;
  }

  return NextResponse.json({
    scope, period,
    canSwitchScope: user.isAdmin,
    rows: rows.map((r) => ({
      ...r,
      costUsd: Number(r.costUsd),
      costEur: Number(r.costEur),
    })),
    byUser, byMonth, byProvider,
    total: {
      eur: round6(totalEur), usd: round6(totalUsd),
      calls: totalCalls, tokens: totalTokens,
    },
  });
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
