import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { ComparisonReport } from "@/lib/pdf-report";
import type { ClaudeComparisonResult } from "@/lib/claude";
import { computeCost } from "@/lib/pricing";
import { getServerFxRate } from "@/lib/pricing-fx.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/comparisons/[id]/report.pdf
 * Streamt den fertigen Vergleich als A4-PDF.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const c = await prisma.comparison.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      followups: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "DONE" || !c.resultJson) {
    return NextResponse.json({ error: "Vergleich noch nicht abgeschlossen" }, { status: 409 });
  }

  const result = c.resultJson as unknown as ClaudeComparisonResult;
  const inputTokens = c.claudeInputTokens || 0;
  const outputTokens = c.claudeOutputTokens || 0;
  const modelOnly = (c.claudeModel || "").includes(":") ? (c.claudeModel as string).split(":")[1] : (c.claudeModel || "claude-opus-4-7");
  const cost = computeCost({ model: modelOnly, inputTokens, outputTokens, fxUsdEur: getServerFxRate() });

  const buffer = await renderToBuffer(
    React.createElement(ComparisonReport, {
      comparisonId: c.id,
      title: c.title,
      customerName: c.customerName,
      projectRef: c.projectRef,
      backgroundInfo: c.backgroundInfo,
      customPrompt: c.customPrompt,
      createdAt: c.createdAt,
      user: { name: c.user.name || c.user.email, email: c.user.email },
      result,
      meta: {
        model: c.claudeModel || "claude-opus-4-7",
        inputTokens, outputTokens,
        runMs: c.claudeRunMs || 0,
        costEur: cost.costEur,
      },
      followups: c.followups.map((f) => ({
        prompt: f.prompt, response: f.response, createdAt: f.createdAt,
        userName: f.userName, costEur: Number(f.costEur),
      })),
    }),
  );

  const safeTitle = c.title.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="Angebotsvergleich_${safeTitle}_${id.slice(0, 8)}.pdf"`,
      "cache-control": "no-store",
    },
  });
}
