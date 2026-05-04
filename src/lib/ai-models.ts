/**
 * Konvention §15.7 (2026-05-04): Zentrale KI-Modell-Definition.
 *
 * Single Source of Truth fuer alle Apps die KI nutzen — Kosten, Staerken,
 * Schwaechen, Empfehlungen sind hier zentral. Pricing-Werte sind synchron
 * zu pricing.ts (gleiche $-Werte pro 1M Tokens).
 *
 * Cross-App-Nutzung: Angebotsvergleich, OCR-Service, Bedarfsanmeldung, LMS
 * importieren diese Definition (oder bekommen sie via Master-Data-API).
 */

export type AiModelId = "claude-haiku-4-5" | "claude-sonnet-4-5" | "claude-opus-4-7";

export interface AiModel {
  id: AiModelId;
  /** API-Identifier fuer Anthropic SDK */
  apiId: string;
  /** UI-Label */
  label: string;
  /** Anbieter */
  provider: "claude";
  /** Familie (zur Sortierung) */
  family: "haiku" | "sonnet" | "opus";
  /** Pricing pro 1M Tokens (USD) */
  inputPer1M: number;
  outputPer1M: number;
  /** Typische Kosten pro Anfrage (Estimate fuer ~5k in / 2k out tokens) — fuer UI-Hint */
  typicalCostCt: number;
  /** Typische Latenz in Sekunden */
  typicalLatencySec: number;
  /** Kurzbeschreibung */
  shortDescription: string;
  /** Staerken (Bullets) */
  strengths: string[];
  /** Schwaechen / Caveats (Bullets) */
  weaknesses: string[];
  /** Wann nutzen (Empfehlungs-Hint) */
  bestFor: string;
  /** Empfohlen-Flag fuer Default-UI-Auswahl */
  recommended?: boolean;
}

export const AI_MODELS: AiModel[] = [
  {
    id: "claude-haiku-4-5",
    apiId: "claude-haiku-4-5",
    label: "Claude Haiku 4.5",
    provider: "claude",
    family: "haiku",
    inputPer1M: 0.80,
    outputPer1M: 4.00,
    typicalCostCt: 0.5,
    typicalLatencySec: 3,
    shortDescription: "Schnell + günstig — gut für einfache Texterkennung",
    strengths: [
      "Sehr schnell (~2-4 s)",
      "Günstig: ~0,5 ct pro Anfrage",
      "Gut für einfache Extraktion (Felder aus PDFs, Klassifikation)",
    ],
    weaknesses: [
      "Weniger genau bei komplexen Dokumenten",
      "Schwächer bei mehrstufigen Analysen",
      "Limitierte Kontextverarbeitung",
    ],
    bestFor: "Schnelle Extraktion, Klassifikation, hohe Volumina mit niedrigem Kostendruck",
  },
  {
    id: "claude-sonnet-4-5",
    apiId: "claude-sonnet-4-5",
    label: "Claude Sonnet 4.5",
    provider: "claude",
    family: "sonnet",
    inputPer1M: 3.00,
    outputPer1M: 15.00,
    typicalCostCt: 2,
    typicalLatencySec: 8,
    shortDescription: "Bestes Preis-/Leistungs-Verhältnis — Standard-Empfehlung",
    strengths: [
      "Sehr gutes Preis-/Leistungs-Verhältnis",
      "Stark bei Dokumenten + Analyse",
      "Zuverlässig bei strukturiertem Output (JSON)",
    ],
    weaknesses: [
      "Etwas langsamer als Haiku (~5-15 s)",
      "Bei sehr komplexen Zusammenhängen schwächer als Opus",
    ],
    bestFor: "Standard-Angebotsvergleich, Bedarfsanmeldungen, Dokumenten-Scans",
    recommended: true,
  },
  {
    id: "claude-opus-4-7",
    apiId: "claude-opus-4-7",
    label: "Claude Opus 4",
    provider: "claude",
    family: "opus",
    inputPer1M: 15.00,
    outputPer1M: 75.00,
    typicalCostCt: 12,
    typicalLatencySec: 30,
    shortDescription: "Höchste Qualität — komplexe Analysen, mehrstufige Argumentation",
    strengths: [
      "Höchste Analyse-Qualität",
      "Verstehe komplexe technische Spezifikationen",
      "Beste für mehrstufige Logik (Pareto, TCO, Sensitivität)",
    ],
    weaknesses: [
      "Teuer: ~10–15 ct pro Anfrage",
      "Langsam (~20–60 s)",
      "Overkill für einfache Extraktion",
    ],
    bestFor: "Komplexe Vergleiche mit vielen Angeboten, kritische Beschaffungs-Entscheidungen",
  },
];

/** Default-Empfehlung fuer neue Anfragen */
export const DEFAULT_MODEL: AiModelId = "claude-sonnet-4-5";

export function getModel(id: string | null | undefined): AiModel {
  return AI_MODELS.find((m) => m.id === id || m.apiId === id) || AI_MODELS.find((m) => m.id === DEFAULT_MODEL)!;
}

/** Kosten-Schaetzung in EUR fuer eine Anfrage mit gegebenen Token-Vorhersagen */
export function estimateCost(modelId: AiModelId, estInputTokens: number, estOutputTokens: number, fxUsdEur = 0.92): { usd: number; eur: number; ct: number } {
  const m = getModel(modelId);
  const usd = (estInputTokens / 1_000_000) * m.inputPer1M + (estOutputTokens / 1_000_000) * m.outputPer1M;
  const eur = usd * fxUsdEur;
  return { usd, eur, ct: eur * 100 };
}
