/**
 * Konvention §15.3 (2026-05-04): KI-Preise pro 1M Tokens (USD).
 *
 * Quellen:
 *  - Anthropic: https://www.anthropic.com/pricing
 *  - Google: https://ai.google.dev/pricing
 *
 * USD->EUR Wechselkurs: konstant (Snapshot). Spaeter optional via ECB-API.
 * Werte in USD pro 1.000.000 Tokens.
 */

export interface ModelPricing {
  /** USD pro 1M Input-Tokens */
  inputPer1M: number;
  /** USD pro 1M Output-Tokens */
  outputPer1M: number;
  /** USD pro 1M Cache-Read-Tokens (optional) */
  cacheReadPer1M?: number;
  /** USD pro 1M Cache-Create-Tokens (optional) */
  cacheCreatePer1M?: number;
}

/** Default Wechselkurs USD->EUR (Snapshot 2026-05) */
export const FX_USD_EUR_DEFAULT = 0.92;

/**
 * Pricing-Tabelle. Bei unbekanntem Modell wird Opus-Pricing verwendet
 * (defensive, eher zu viel zeigen als zu wenig).
 */
const PRICING: Record<string, ModelPricing> = {
  // ---- Anthropic ----
  "claude-opus-4-7":     { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.50, cacheCreatePer1M: 18.75 },
  "claude-opus-4":       { inputPer1M: 15, outputPer1M: 75, cacheReadPer1M: 1.50, cacheCreatePer1M: 18.75 },
  "claude-sonnet-4-5":   { inputPer1M: 3,  outputPer1M: 15, cacheReadPer1M: 0.30, cacheCreatePer1M: 3.75 },
  "claude-sonnet-4":     { inputPer1M: 3,  outputPer1M: 15, cacheReadPer1M: 0.30, cacheCreatePer1M: 3.75 },
  "claude-haiku-4":      { inputPer1M: 0.80, outputPer1M: 4, cacheReadPer1M: 0.08, cacheCreatePer1M: 1.00 },
  // Legacy
  "claude-3-5-sonnet-20241022": { inputPer1M: 3, outputPer1M: 15, cacheReadPer1M: 0.30, cacheCreatePer1M: 3.75 },
  "claude-3-opus-20240229":     { inputPer1M: 15, outputPer1M: 75 },

  // ---- Google ----
  "gemini-3.1-pro":        { inputPer1M: 2.50, outputPer1M: 10 },
  "gemini-2.5-pro":        { inputPer1M: 1.25, outputPer1M: 5 },
  "gemini-2.5-flash":      { inputPer1M: 0.075, outputPer1M: 0.30 },
  "gemini-1.5-pro":        { inputPer1M: 1.25, outputPer1M: 5 },
};

/** Default falls Modell nicht bekannt — eher hoch ansetzen damit User nicht ueberrascht wird. */
const FALLBACK: ModelPricing = { inputPer1M: 15, outputPer1M: 75 };

export function getModelPricing(model: string): ModelPricing {
  return PRICING[model] || FALLBACK;
}

export interface ComputeCostInput {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  fxUsdEur?: number;
}

export interface CostBreakdown {
  costUsd: number;
  costEur: number;
  fxUsdEur: number;
  pricing: ModelPricing;
  detail: {
    inputUsd: number;
    outputUsd: number;
    cacheReadUsd: number;
    cacheCreateUsd: number;
  };
}

/** Berechnet Kosten in USD + EUR fuer einen einzelnen Call. */
export function computeCost(input: ComputeCostInput): CostBreakdown {
  const p = getModelPricing(input.model);
  const fx = input.fxUsdEur ?? FX_USD_EUR_DEFAULT;

  const inputUsd       = (input.inputTokens / 1_000_000) * p.inputPer1M;
  const outputUsd      = (input.outputTokens / 1_000_000) * p.outputPer1M;
  const cacheReadUsd   = ((input.cacheReadTokens || 0) / 1_000_000) * (p.cacheReadPer1M || 0);
  const cacheCreateUsd = ((input.cacheCreateTokens || 0) / 1_000_000) * (p.cacheCreatePer1M || 0);

  const costUsd = inputUsd + outputUsd + cacheReadUsd + cacheCreateUsd;
  const costEur = costUsd * fx;

  return {
    costUsd: round6(costUsd),
    costEur: round6(costEur),
    fxUsdEur: fx,
    pricing: p,
    detail: {
      inputUsd: round6(inputUsd),
      outputUsd: round6(outputUsd),
      cacheReadUsd: round6(cacheReadUsd),
      cacheCreateUsd: round6(cacheCreateUsd),
    },
  };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}

/** Format-Helper fuer UI: "0,12 €" / "0,01 $". */
export function formatEur(eur: number): string {
  if (eur < 0.01) return `${(eur * 100).toFixed(2)} ct`;
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(eur);
}
export function formatUsd(usd: number): string {
  if (usd < 0.01) return `${(usd * 100).toFixed(2)} ¢`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(usd);
}
