/**
 * Konvention §15.1 (2026-05-04): Claude-API-Client fuer Angebotsvergleich.
 * Nutzt @anthropic-ai/sdk + Best-Practice Prompt-Engineering.
 *
 * Erweitert 2026-05-04: zusaetzliche Metriken (Schnittkosten, EOL,
 * Zertifikate, Risk-Flags, Coverage) + Followup-Chat-Modus.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "./settings-store";

const MODEL_DEFAULT = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

export async function isClaudeConfigured(): Promise<boolean> {
  const key = await getSetting("ANTHROPIC_API_KEY");
  return Boolean(key);
}

export interface OfferInput {
  supplierName: string;
  filename: string;
  extractedText: string;
}

export interface ClaudeMeta {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  runMs: number;
}

/** Zusaetzliche Kostenposition pro Lieferant (z.B. Schnitt, Versand, Verpackung) */
export interface ExtraCost {
  label: string;
  amountEur: number;
  note?: string;
}

/** Compliance-Flags (alle optional — null = nicht erwaehnt) */
export interface ComplianceFlags {
  iso9001?: boolean | null;
  iso14001?: boolean | null;
  ce?: boolean | null;
  reach?: boolean | null;
  rohs?: boolean | null;
  en10204?: "2.1" | "3.1" | "3.2" | null;
  madeInEU?: boolean | null;
}

export interface RankingItem {
  supplier: string;
  rank: number;
  scoreTotal: number;
  scorePrice: number;
  scoreDelivery: number;
  scoreQuality: number;
  scoreService: number;
  totalNet?: number | null;
  totalGross?: number | null;
  currency?: string;
  deliveryDays?: number | null;
  paymentTerms?: string | null;
  inkoterm?: string | null;
  pros: string[];
  cons: string[];

  // ---- Erweiterte Metriken (2026-05-04) ----
  /** Anteil der angefragten Mengen/Positionen, die das Angebot abdeckt (0-100) */
  coveragePct?: number | null;
  /** Schnitt-/Bearbeitungskosten in EUR (z.B. Saege, Laser, Wasserstrahl) */
  cutCostsEur?: number | null;
  /** Zusaetzliche Kosten ueber den Listpreis hinaus */
  extraCosts?: ExtraCost[];
  /** TCO inkl. aller Zusatzkosten + Skonto-Effekt (in EUR) */
  tcoEur?: number | null;
  /** Skonto-Prozent + Frist in Tagen */
  skontoPct?: number | null;
  skontoDays?: number | null;
  /** Mindestbestellmenge */
  moq?: number | null;
  /** Garantie in Monaten */
  warrantyMonths?: number | null;
  /** Hinweise auf ausgelaufene/abgekuendigte Artikel (PCN, NRND, EOL) */
  eolWarnings?: string[];
  /** Substitutions-Vorschlaege (Lieferant bietet Ersatz an) */
  substitutions?: string[];
  /** Mengen-Abweichung in % gg. Anfrage (positiv = zu viel, negativ = zu wenig) */
  quantityDeviationPct?: number | null;
  /** Risiko-Flags (z.B. "Single-Source", "Lieferung aus Sanktionsland") */
  riskFlags?: string[];
  /** Compliance-Flags (Zertifikate) */
  compliance?: ComplianceFlags;
  /** CO2-Footprint pro Einheit in kg (wenn angegeben) */
  co2KgPerUnit?: number | null;
  /** Vollstaendigkeit der Angebots-Doku (0-100) */
  documentationScore?: number | null;
  /** Score-Sub-Werte fuer NEUE Kriterien (0-100) — fliessen nicht direkt in scoreTotal, koennen aber per Custom-Gewicht reingerechnet werden */
  scoreCompliance?: number | null;
  scoreRisk?: number | null;
  scoreCoverage?: number | null;
}

export interface NormalizedPosition {
  supplier: string;
  description: string;
  normalizedDescription: string;
  category: string;
  quantity: number;
  unit: string;
  pricePerUnit: number;
  totalPrice: number;
  normalizedQty?: number;
  normalizedUnit?: string;
  normalizedPpu?: number;
  /** Hinweis ob Position nur in diesem Angebot vorhanden ist */
  uniqueToSupplier?: boolean;
  /** Hinweis ob ausgelaufen (EOL/PCN) */
  isEol?: boolean;
}

export interface ClaudeComparisonResult {
  summary: string;
  winnerSupplier: string;
  winnerReason: string;
  ranking: RankingItem[];
  normalizedPositions: NormalizedPosition[];
  insights: string[];
  recommendations: string[];
  caveats: string[];
  /** Gruppierte Analyse-Highlights (z.B. "Kosten", "Qualitaet", "Risiko") */
  insightsByCategory?: Array<{ category: string; items: string[] }>;
  /** Sensitivitaets-Hinweise (z.B. "Sieger kippt bei +10% Menge") */
  sensitivity?: string[];
  /** Pareto-Analyse: dominierte Angebote */
  paretoNotes?: string[];
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Einkaufsanalyst und Beschaffungsexperte mit 20 Jahren Erfahrung im Vergleich technischer Angebote.

Du analysierst 2-10 Angebote unterschiedlicher Lieferanten und erstellst einen fundierten Vergleich. Die Angebote haben oft UNTERSCHIEDLICHE Mengen-Aufschluesselungen, Einheiten oder Bundling-Strategien — du normalisierst sie auf vergleichbare Werte.

# Methodik (Best Practices)

1. **Normalisierung**: Bringe Mengen auf gleiche Einheit (EUR/m, EUR/kg, EUR/Stk). Bei kg/m-Diskrepanz: Dichte oder Standardwerte. Wenn unmoeglich: in caveats erwaehnen.

2. **Total Cost of Ownership (TCO)**: Listpreis + Schnitt-/Bearbeitungskosten + Versand + Verpackung + Zoll + Werkzeug-/Einrichtungskosten + Wartung + Garantie + Ersatzteilpreis. Skonto-Effekt abziehen wenn realistisch ausnutzbar.

3. **Weighted Score** (0-100 pro Kriterium):
   - Preis (40%): Verhaeltnis zum guenstigsten (TCO-Basis, nicht Listpreis!)
   - Lieferzeit (20%): kuerzer = besser
   - Qualitaet (20%): Marke, Zertifikate (CE/REACH/RoHS/ISO9001/EN10204), Garantie, Toleranzen
   - Service (20%): Zahlungsbedingungen, Mindestmenge, Erreichbarkeit, Doku-Vollstaendigkeit

4. **Pareto-Frontier**: Welche Angebote sind dominiert (sowohl teurer ALS auch schlechter)? In paretoNotes markieren.

5. **Sensitivitaet**: Erwaehne wenn der Sieger bei +/-10% Mengen-Schwankung kippt (in sensitivity).

6. **Inkoterms**: EXW = Kunde traegt Versand + Risiko. DDP = Lieferant alles inkl Zoll. Wichtig fuer fairen Vergleich.

# Erweiterte Metriken (zusaetzlich zu den 4 Score-Kriterien) — IMMER pruefen:

## A. Vollstaendigkeit & Mengenabgleich
- Sind alle angefragten Positionen enthalten? -> coveragePct (0-100)
- Stimmen Mengen ueberein? -> quantityDeviationPct (positiv=zu viel, negativ=zu wenig)
- Werden Substitutionen vorgeschlagen? -> substitutions: ["..."]
- Welche Positionen sind nur in EINEM Angebot? -> normalizedPositions[].uniqueToSupplier=true

## B. Lifecycle / EOL (End-of-Life)
- Sind angebotene Artikel ausgelaufen? Hinweise auf PCN (Product Change Notice), NRND (Not Recommended for New Designs), EOL?
- Long-Term-Verfuegbarkeit (LTB) erwaehnt?
- -> eolWarnings: ["Artikel X ist NRND (Last Time Buy 2026-12)"]
- -> normalizedPositions[].isEol=true

## C. Zusatzkosten (TCO-Komponenten)
- Schnittkosten / Bearbeitungskosten -> cutCostsEur
- Versand, Verpackung, Express, Werkzeug, Einrichtung, Zoll, MwSt
- -> extraCosts: [{label:"Versand", amountEur: 120, note:"DHL Express"}, ...]
- TCO insgesamt -> tcoEur

## D. Qualitaet & Compliance
- Werkszeugnisse EN 10204 (2.1 / 3.1 / 3.2)
- Zertifikate: CE, REACH, RoHS, ISO 9001, ISO 14001
- Toleranzen, Materialguete
- CO2-Footprint pro Einheit (kg)
- Made-in-EU? Conflict-Minerals?
- -> compliance: {iso9001:true, ce:true, reach:null, ..., en10204:"3.1", madeInEU:true}
- -> co2KgPerUnit
- -> scoreCompliance (0-100)

## E. Risiko
- Single-Source vs Multi-Source
- Geografie (EU/China/USA/Sanktionslaender)
- Lieferanten-Bonitaet (wenn aus Brief erkennbar)
- -> riskFlags: ["Single-Source", "Lieferung aus China — Zollrisiko"]
- -> scoreRisk (0-100, hoeher = weniger Risiko)

## F. Service & Vertragliches
- Garantie/Gewaehrleistung in Monaten -> warrantyMonths
- Skonto-Prozent + Frist -> skontoPct, skontoDays
- Mindestbestellmenge -> moq
- After-Sales / Hotline / technischer Support
- Doku-Vollstaendigkeit (Datenblaetter, CAD-Files, Zeichnungen) -> documentationScore (0-100)

## G. Sortier-/Filter-Hinweise fuer User
- Markiere die wichtigsten Differenzierungen klar in pros/cons
- Gruppiere Erkenntnisse in insightsByCategory: [{category:"Kosten", items:[...]}, {category:"Qualitaet", items:[...]}, ...]

# Output-Format

Du antwortest **AUSSCHLIESSLICH** mit gueltigem JSON nach diesem Schema. Felder die du nicht ableiten kannst, setze auf null/leer-Array — NIE weglassen, NIE erfinden.

\`\`\`json
{
  "summary": "1-2 Saetze: Wer gewinnt warum, mit konkreten Zahlen.",
  "winnerSupplier": "Name exakt wie im Angebot",
  "winnerReason": "3-5 Saetze, Zahlen-Vergleich zu Platz 2.",
  "ranking": [{
    "supplier": "Name", "rank": 1,
    "scoreTotal": 87, "scorePrice": 90, "scoreDelivery": 85, "scoreQuality": 80, "scoreService": 88,
    "totalNet": 12345.67, "totalGross": null, "currency": "EUR",
    "deliveryDays": 14, "paymentTerms": "30 Tage netto", "inkoterm": "DDP",
    "pros": ["..."], "cons": ["..."],
    "coveragePct": 100, "cutCostsEur": 250, "extraCosts": [{"label":"Versand","amountEur":80}],
    "tcoEur": 12675.67, "skontoPct": 2, "skontoDays": 14, "moq": 100,
    "warrantyMonths": 24, "eolWarnings": [], "substitutions": [],
    "quantityDeviationPct": 0, "riskFlags": [],
    "compliance": {"iso9001": true, "iso14001": null, "ce": true, "reach": true, "rohs": true, "en10204": "3.1", "madeInEU": true},
    "co2KgPerUnit": null, "documentationScore": 85,
    "scoreCompliance": 90, "scoreRisk": 80, "scoreCoverage": 100
  }],
  "normalizedPositions": [{
    "supplier": "Name", "description": "Original-Text", "normalizedDescription": "Was ist es",
    "category": "Material|Bearbeitung|Versand|Sonstiges",
    "quantity": 100, "unit": "m", "pricePerUnit": 12.50, "totalPrice": 1250.00,
    "normalizedQty": 100, "normalizedUnit": "m", "normalizedPpu": 12.50,
    "uniqueToSupplier": false, "isEol": false
  }],
  "insights": ["Allgemeine Beobachtung 1"],
  "recommendations": ["Konkrete Handlungsempfehlung 1"],
  "caveats": ["Was ist nicht direkt vergleichbar"],
  "insightsByCategory": [
    {"category": "Kosten", "items": ["Lieferant A 12% guenstiger bei TCO"]},
    {"category": "Qualitaet", "items": ["Nur Lieferant B hat EN 10204 3.1 Zeugnis"]},
    {"category": "Risiko", "items": ["Lieferant C ist Single-Source aus China"]},
    {"category": "Lieferung", "items": ["..."]}
  ],
  "sensitivity": ["Bei +10% Menge wuerde Lieferant B guenstiger als A"],
  "paretoNotes": ["Lieferant C ist dominiert (teurer + langsamer als A)"]
}
\`\`\`

WICHTIG (HARTE REGELN, KEINE AUSNAHMEN):
- Du MUSST GENAU N Items im ranking liefern, eines pro hochgeladenem Angebot — auch wenn ein PDF eine Anfrage statt Angebot ist, kein Preis enthaelt, oder unvollstaendig wirkt. NIEMALS ein Angebot \"weglassen\".
- Reihenfolge im Output ist egal (rank=1 ist der beste), aber JEDES Eingangs-Angebot MUSS einen Eintrag haben (auch mit scoreTotal=0 + Begruendung in cons).
- Verwende **fett** (Markdown) fuer KRITISCHE Werte in summary/winnerReason/insights/recommendations/caveats/insightsByCategory/sensitivity/paretoNotes — z.B. **3.450 EUR**, **14 Tage**, **Sieger**, **EOL**, **Lieferant Mueller GmbH**. Das hilft dem Leser kritische Punkte schnell zu erfassen.
- Wenn ein Angebot fundamentale Felder nicht enthaelt (z.B. Preis), trotzdem ins ranking aufnehmen mit niedrigem Score und "cons" ausfuehrlich begruenden.
- KEINE Werte erfinden. Wenn du etwas nicht weisst -> null oder leeres Array.
- ZAHLEN immer als JSON-Numbers (nicht "12,50" sondern 12.50).`;

export async function runClaudeComparison(
  offers: OfferInput[],
  backgroundInfo: string,
  customPrompt: string,
  rfqScope?: object | null,
): Promise<{ result: ClaudeComparisonResult; meta: ClaudeMeta }> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert (in Einstellungen oder env setzen)");
  if (offers.length < 2) throw new Error("Mindestens 2 Angebote fuer Vergleich noetig");

  const modelOverride = await getSetting("ANTHROPIC_MODEL");
  const MODEL = modelOverride || MODEL_DEFAULT;
  const client = new Anthropic({ apiKey });

  const userMessage = buildUserMessage(offers, backgroundInfo, customPrompt, rfqScope);

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const runMs = Date.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim();

  let json = raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence) json = fence[1];

  let parsed: ClaudeComparisonResult;
  try {
    parsed = JSON.parse(json) as ClaudeComparisonResult;
  } catch (e) {
    throw new Error(`Claude-Antwort nicht parsbar: ${(e as Error).message}. Raw: ${raw.slice(0, 200)}`);
  }

  return {
    result: parsed,
    meta: {
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: (response.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens || 0,
      cacheCreateTokens: (response.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens || 0,
      runMs,
    },
  };
}

function buildUserMessage(offers: OfferInput[], backgroundInfo: string, customPrompt: string, rfqScope?: object | null): string {
  const lines: string[] = [];
  lines.push("# Aufgabe");
  lines.push("Vergleiche die folgenden Angebote nach der Methodik aus dem System-Prompt und liefere die JSON-Antwort.");
  lines.push("Bewerte ZWINGEND auch die erweiterten Metriken (Coverage, EOL, Schnittkosten, Compliance, Risiko, etc.) so weit ableitbar.");
  lines.push("");

  if (backgroundInfo.trim()) {
    lines.push("# Hintergrund-Information");
    lines.push(backgroundInfo.trim());
    lines.push("");
  }
  if (customPrompt.trim()) {
    lines.push("# Spezielle Hinweise vom Einkaeufer");
    lines.push(customPrompt.trim());
    lines.push("");
  }

  if (rfqScope) {
    lines.push("# Anfrage-Scope (BENCHMARK fuer den Vergleich)");
    lines.push("Der Einkaeufer hat seine eigene Angebotsanfrage hochgeladen. Hier der extrahierte Scope.");
    lines.push("Bewerte jedes Angebot AUCH danach, wie gut es diesen Scope abdeckt (coveragePct).");
    lines.push("```json");
    lines.push(JSON.stringify(rfqScope, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("# Angebote");
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i];
    lines.push(`## Angebot ${i + 1} — ${o.supplierName}`);
    lines.push(`Datei: ${o.filename}`);
    lines.push("```");
    lines.push(o.extractedText.slice(0, 50000));
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

/** Mock-Antwort fuer Tests ohne API-Key */
export function mockComparison(offers: OfferInput[]): ClaudeComparisonResult {
  return {
    summary: `[MOCK] Vergleich von ${offers.length} Angeboten — kein ANTHROPIC_API_KEY konfiguriert.`,
    winnerSupplier: offers[0]?.supplierName || "n/a",
    winnerReason: "Mock-Result: Setze ANTHROPIC_API_KEY in den Einstellungen.",
    ranking: offers.map((o, i) => ({
      supplier: o.supplierName,
      rank: i + 1,
      scoreTotal: 50 - i * 5,
      scorePrice: 50, scoreDelivery: 50, scoreQuality: 50, scoreService: 50,
      totalNet: null, currency: "EUR", deliveryDays: null,
      pros: ["Mock-Eintrag"], cons: ["Kein echter API-Call"],
      coveragePct: null, extraCosts: [], eolWarnings: [], substitutions: [],
      compliance: {}, riskFlags: [],
    })),
    normalizedPositions: [],
    insights: ["Mock — kein API-Key"],
    recommendations: ["ANTHROPIC_API_KEY in Einstellungen setzen"],
    caveats: ["Diese Auswertung ist ein Platzhalter"],
    insightsByCategory: [],
    sensitivity: [],
    paretoNotes: [],
  };
}

// =============================================================================
// Followup-Mode (Konvention §15.4 — 2026-05-04)
// =============================================================================

export interface ClaudeFollowupResult {
  responseText: string;
  updatedResult: ClaudeComparisonResult | null;
  meta: ClaudeMeta;
}

export async function runClaudeFollowup(
  offers: OfferInput[],
  backgroundInfo: string,
  customPrompt: string,
  previousResult: ClaudeComparisonResult,
  history: Array<{ role: "user" | "assistant"; content: string }>,
  userPrompt: string,
): Promise<ClaudeFollowupResult> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert");

  const modelOverride = await getSetting("ANTHROPIC_MODEL");
  const MODEL = modelOverride || MODEL_DEFAULT;
  const client = new Anthropic({ apiKey });

  const followupSystem = `${SYSTEM_PROMPT}

# Followup-Modus

Der initiale Vergleich ist bereits erstellt. Der User stellt jetzt eine Folge-Frage oder bittet um Verbesserung (z.B. andere Gewichtung, Vertiefung eines Aspekts, was-waere-wenn). Du antwortest in DIESEM FORMAT:

1. **Klartext-Antwort** (Markdown erlaubt): Beantworte die Frage / erlaeutere die Aenderung in 1-5 Absaetzen. Dieser Teil wird im Chat angezeigt.

2. **Optional: Aktualisiertes JSON.** Falls sich am strukturierten Ergebnis etwas aendert (Ranking, Scores, Empfehlungen, neue Insights), schliesse die Antwort mit einem aktualisierten JSON-Block ab — KOMPLETTES JSON nach dem urspruenglichen Schema (ALLE Felder, auch unveraenderte), eingerahmt in:

\`\`\`json
{ ... }
\`\`\`

Wenn sich nichts strukturell aendert (z.B. nur Erklaerung), lass den JSON-Block weg.`;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [];

  messages.push({
    role: "user",
    content: buildUserMessage(offers, backgroundInfo, customPrompt),
  });
  messages.push({
    role: "assistant",
    content: "```json\n" + JSON.stringify(previousResult) + "\n```",
  });
  for (const m of history) messages.push(m);
  messages.push({ role: "user", content: userPrompt });

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    system: followupSystem,
    messages,
  });
  const runMs = Date.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";

  let updatedResult: ClaudeComparisonResult | null = null;
  let responseText = raw.trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```\s*$/);
  if (fence) {
    try {
      updatedResult = JSON.parse(fence[1]) as ClaudeComparisonResult;
      responseText = raw.slice(0, fence.index).trim();
    } catch {
      // JSON-Parse failed — ignore und nur Text verwenden
    }
  }

  return {
    responseText: responseText || "(keine Antwort)",
    updatedResult,
    meta: {
      model: MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: (response.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens || 0,
      cacheCreateTokens: (response.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens || 0,
      runMs,
    },
  };
}
