/**
 * Konvention §15.3 (2026-05-04): Logging-Helper fuer KI-Cost-Tracking.
 * Schreibt in AiUsage. NIEMALS throw — Logging darf Run-Failures nicht
 * verschlimmern.
 */
import { prisma } from "./db";
import { computeCost } from "./pricing";
import { getServerFxRate } from "./pricing-fx.server";

export interface LogUsageInput {
  userId: string;
  userName: string;
  userEmail: string;
  comparisonId?: string | null;
  followupId?: string | null;
  provider: "claude" | "gemini";
  model: string;
  kind: "comparison" | "followup" | "settings-test" | "report";
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  runMs: number;
  errorMessage?: string | null;
}

export interface LogUsageResult {
  costUsd: number;
  costEur: number;
  fxUsdEur: number;
  id?: string;
}

export async function logUsage(input: LogUsageInput): Promise<LogUsageResult> {
  const cost = computeCost({
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    cacheReadTokens: input.cacheReadTokens,
    cacheCreateTokens: input.cacheCreateTokens,
    fxUsdEur: getServerFxRate(),
  });
  try {
    const row = await prisma.aiUsage.create({
      data: {
        userId: input.userId,
        userName: input.userName || "(unbekannt)",
        userEmail: input.userEmail || "",
        comparisonId: input.comparisonId || null,
        followupId: input.followupId || null,
        provider: input.provider,
        model: input.model,
        kind: input.kind,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cacheReadTokens: input.cacheReadTokens || 0,
        cacheCreateTokens: input.cacheCreateTokens || 0,
        costUsd: cost.costUsd,
        costEur: cost.costEur,
        fxUsdEur: cost.fxUsdEur,
        runMs: input.runMs,
        errorMessage: input.errorMessage || null,
      },
      select: { id: true },
    });
    return { costUsd: cost.costUsd, costEur: cost.costEur, fxUsdEur: cost.fxUsdEur, id: row.id };
  } catch (e) {
    // Log to console but never throw — Cost-Tracking is secondary
    console.error("[usage-log] Failed to log AiUsage:", (e as Error).message);
    return { costUsd: cost.costUsd, costEur: cost.costEur, fxUsdEur: cost.fxUsdEur };
  }
}
