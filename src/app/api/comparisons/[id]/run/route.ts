import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { runAnalysis } from "../../run-helper";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * POST /api/comparisons/[id]/run
 *
 * Konvention §15.10 (2026-05-04): Fire-and-Forget Pattern.
 * Setzt Status auf PROCESSING + startet runAnalysis im Hintergrund + returns 202.
 * UI kann sofort die KI-Progress-Animation rendern; runAnalysis läuft 30-90s
 * im Hintergrund und setzt am Ende DONE/ERROR.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const c = await prisma.comparison.findUnique({ where: { id } });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // PROCESSING SOFORT setzen damit Browser-Refresh die Animation zeigt
  await prisma.comparison.update({
    where: { id },
    data: { status: "PROCESSING", errorMessage: null, updatedAt: new Date() },
  });

  // Fire-and-Forget: runAnalysis im Hintergrund (catch um unhandled rejection zu vermeiden)
  runAnalysis(id).catch((e: Error) => {
    console.error("[run-bg] failed for", id, e.message);
  });

  // Sofort 202 Accepted — UI rendert KiProgress-Animation
  return NextResponse.json({ ok: true, accepted: true, status: "PROCESSING" }, { status: 202 });
}
