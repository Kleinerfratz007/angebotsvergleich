import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { runAnalysis } from "../../run-helper";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * POST /api/comparisons/[id]/run
 * Triggert KI-Analyse synchron (UI zeigt Loading-State).
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const c = await prisma.comparison.findUnique({ where: { id } });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await runAnalysis(id);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
