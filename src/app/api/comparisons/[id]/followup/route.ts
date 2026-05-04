import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { runClaudeFollowup, type ClaudeComparisonResult } from "@/lib/claude";
import { logUsage } from "@/lib/usage-log";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

/**
 * POST /api/comparisons/[id]/followup
 * Body: { prompt: string }
 *
 * Sendet einen Folge-Prompt an Claude (mit voller Konversations-History +
 * dem urspruenglichen Result-JSON). Persistiert Antwort als ComparisonFollowup
 * + Cost in AiUsage. Wenn Claude ein neues vollstaendiges resultJson liefert,
 * wird Comparison.resultJson auch ueberschrieben (Original im Followup
 * archiviert).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null) as { prompt?: string } | null;
  const prompt = (body?.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt erforderlich" }, { status: 400 });
  if (prompt.length > 5000) return NextResponse.json({ error: "prompt zu lang (max 5000 Zeichen)" }, { status: 400 });

  const c = await prisma.comparison.findUnique({
    where: { id },
    include: { offers: true, followups: { orderBy: { createdAt: "asc" } } },
  });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (c.status !== "DONE" || !c.resultJson) {
    return NextResponse.json({ error: "Initial-Vergleich noch nicht abgeschlossen" }, { status: 409 });
  }

  const offerInputs = c.offers.map((o) => ({
    supplierName: o.supplierName,
    filename: o.originalFilename,
    extractedText: o.extractedText || `[Kein extrahierter Text]`,
  }));

  const history = c.followups.flatMap((f) => [
    { role: "user" as const, content: f.prompt },
    { role: "assistant" as const, content: f.response + (f.resultJson ? "\n\n```json\n" + JSON.stringify(f.resultJson) + "\n```" : "") },
  ]);

  try {
    const r = await runClaudeFollowup(
      offerInputs,
      c.backgroundInfo || "",
      c.customPrompt || "",
      c.resultJson as unknown as ClaudeComparisonResult,
      history,
      prompt,
    );

    const followup = await prisma.comparisonFollowup.create({
      data: {
        comparisonId: id,
        userId: user.id,
        userName: user.name || user.email,
        prompt,
        response: r.responseText,
        resultJson: r.updatedResult as unknown as object | undefined,
        provider: "claude",
        model: r.meta.model,
        inputTokens: r.meta.inputTokens,
        outputTokens: r.meta.outputTokens,
        costUsd: 0,  // wird gleich beim Logging berechnet, hier vorab 0
        costEur: 0,
        runMs: r.meta.runMs,
      },
    });

    // Cost loggen (berechnet auch USD/EUR)
    const usage = await logUsage({
      userId: user.id,
      userName: user.name || user.email,
      userEmail: user.email,
      comparisonId: id,
      followupId: followup.id,
      provider: "claude",
      model: r.meta.model,
      kind: "followup",
      inputTokens: r.meta.inputTokens,
      outputTokens: r.meta.outputTokens,
      cacheReadTokens: r.meta.cacheReadTokens,
      cacheCreateTokens: r.meta.cacheCreateTokens,
      runMs: r.meta.runMs,
    });

    // Cost-Felder im Followup nachtragen
    await prisma.comparisonFollowup.update({
      where: { id: followup.id },
      data: { costUsd: usage.costUsd, costEur: usage.costEur },
    });

    // Wenn Claude ein neues volles JSON geliefert hat -> Comparison-Result aktualisieren
    if (r.updatedResult) {
      await prisma.comparison.update({
        where: { id },
        data: {
          resultJson: r.updatedResult as unknown as object,
          resultSummary: r.updatedResult.summary,
        },
      });
    }

    return NextResponse.json({ ok: true, followup: { id: followup.id, response: r.responseText, hasUpdate: Boolean(r.updatedResult), costEur: usage.costEur } });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
