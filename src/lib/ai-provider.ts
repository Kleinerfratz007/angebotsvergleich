/**
 * Konvention §15.2 (2026-05-04): Multi-Provider AI-Layer fuer Angebotsvergleich.
 *
 * Unterstuetzte Provider:
 *  - claude (Anthropic Claude Opus 4.7) — Default, Production-ready
 *  - gemini (Google Gemini Pro 3.1) — Vorbereitet, braucht GOOGLE_API_KEY
 *
 * Auswahl pro Comparison via field `aiProvider` ODER global per env
 * AI_PROVIDER_DEFAULT (default: claude).
 *
 * Beide Provider returnen die GLEICHE Result-Struktur (ClaudeComparisonResult)
 * damit das UI keine Provider-Logik kennen muss.
 */
import {
  type OfferInput,
  type ClaudeComparisonResult,
  isClaudeConfigured,
  mockComparison,
  runClaudeComparison,
} from "./claude";
import { isGeminiConfigured, runGeminiComparison } from "./gemini";

export type AiProvider = "claude" | "gemini";

export const DEFAULT_PROVIDER: AiProvider =
  (process.env.AI_PROVIDER_DEFAULT as AiProvider) === "gemini" ? "gemini" : "claude";

export interface AiRunResult {
  result: ClaudeComparisonResult;
  meta: { provider: AiProvider; model: string; inputTokens: number; outputTokens: number; runMs: number };
}

export function isProviderConfigured(provider: AiProvider): boolean {
  if (provider === "gemini") return isGeminiConfigured();
  return isClaudeConfigured();
}

export function configuredProviders(): AiProvider[] {
  const list: AiProvider[] = [];
  if (isClaudeConfigured()) list.push("claude");
  if (isGeminiConfigured()) list.push("gemini");
  return list;
}

export async function runAiComparison(
  provider: AiProvider,
  offers: OfferInput[],
  backgroundInfo: string,
  customPrompt: string,
): Promise<AiRunResult> {
  if (provider === "gemini") {
    if (!isGeminiConfigured()) {
      // Fallback auf Mock mit Hinweis
      return {
        result: mockComparison(offers),
        meta: { provider, model: "mock-gemini", inputTokens: 0, outputTokens: 0, runMs: 0 },
      };
    }
    const r = await runGeminiComparison(offers, backgroundInfo, customPrompt);
    return { result: r.result, meta: { provider, ...r.meta } };
  }
  // Default: claude
  if (!isClaudeConfigured()) {
    return {
      result: mockComparison(offers),
      meta: { provider, model: "mock-claude", inputTokens: 0, outputTokens: 0, runMs: 0 },
    };
  }
  const r = await runClaudeComparison(offers, backgroundInfo, customPrompt);
  return { result: r.result, meta: { provider, ...r.meta } };
}
