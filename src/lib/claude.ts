/**
 * Konvention §15.1 (2026-05-04): Claude-API-Client fuer Angebotsvergleich.
 * Nutzt @anthropic-ai/sdk + Best-Practice Prompt-Engineering.
 *
 * System-Prompt enthaelt:
 *  - Rolle (erfahrener Einkaufsanalyst)
 *  - Methodik (TCO, Pareto, Weighted Score, Inkoterms, …)
 *  - Output-Schema (JSON fuer maschinelle Weiterverarbeitung)
 *
 * User-Prompt enthaelt:
 *  - Hintergrund-Info aus dem Form
 *  - Custom-Prompt vom User
 *  - Alle Angebots-Texte als <documents>
 */
import Anthropic from "@anthropic-ai/sdk";

const API_KEY = process.env.ANTHROPIC_API_KEY || "";
// Konvention: Best Model laut User = Opus 4.7 (Stand 2026-05). Fallback zu sonnet.
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-5";

export const isClaudeConfigured = (): boolean => Boolean(API_KEY);

export interface OfferInput {
  supplierName: string;
  filename: string;
  extractedText: string;
}

export interface ClaudeComparisonResult {
  summary: string;
  winnerSupplier: string;
  winnerReason: string;
  ranking: Array<{
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
  }>;
  normalizedPositions: Array<{
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
  }>;
  insights: string[];     // Allgemeine Beobachtungen
  recommendations: string[];  // Konkrete Handlungsempfehlungen
  caveats: string[];      // Vorbehalte / nicht vergleichbare Aspekte
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Einkaufsanalyst und Beschaffungsexperte mit 20 Jahren Erfahrung im Vergleich technischer Angebote.

Du analysierst 2-10 Angebote unterschiedlicher Lieferanten und erstellst einen fundierten Vergleich. Die Angebote haben oft UNTERSCHIEDLICHE Mengen-Aufschluesselungen, Einheiten oder Bundling-Strategien — du normalisierst sie auf vergleichbare Werte.

# Methodik (Best Practices)

1. **Normalisierung**: Bringe Mengen auf gleiche Einheit (z.B. EUR/m, EUR/kg, EUR/Stk). Bei kg/m-Diskrepanz: nutze die Dichte oder Standardwerte. Wenn nicht moeglich: dokumentiere als "nicht direkt vergleichbar".

2. **Total Cost of Ownership (TCO)**: Liste-Preis + Versand + Zoll + ggf. Wartung + Garantie. Bei Inkoterms-Unterschieden (EXW vs DDP): rechne auf einheitliche Basis.

3. **Weighted Score** (0-100 pro Kriterium):
   - Preis (40%): Verhaeltnis zum guenstigsten
   - Lieferzeit (20%): kuerzer = besser
   - Qualitaet (20%): Marke, Zertifikate (CE/REACH/RoHS/ISO9001), Garantie
   - Service (20%): Zahlungsbedingungen, Mindestmenge, Erreichbarkeit

4. **Pareto-Frontier**: Welche Angebote sind dominiert (sowohl teurer ALS auch schlechter)? Markiere sie.

5. **Soft-Faktoren**: Reputation des Lieferanten, Erfahrung mit Kunde, Referenzen, Made-in-EU, Compliance.

6. **Sensitivitaet**: Erwaehne wenn der Sieger bei +/-10% Mengen-Schwankung kippt.

7. **Inkoterms**: EXW = Kunde traegt Versandkosten + Risiko. DDP = Lieferant alles inkl Zoll. Wichtig fuer fairen Vergleich.

8. **Zahlungsbedingungen**: Skonto innerhalb 14 Tagen ist Bargeld-Rabatt — beruecksichtige bei TCO.

# Output-Format

Du antwortest **AUSSCHLIESSLICH** mit gueltigem JSON nach diesem Schema (keine Markdown-Wrapper, kein Text drumherum):

\`\`\`
{
  "summary": "1-2 Saetze: Wer gewinnt warum, mit konkreten Zahlen.",
  "winnerSupplier": "Name des Sieger-Lieferanten exakt wie im Angebot",
  "winnerReason": "3-5 Saetze warum dieser Lieferant. Inkl. konkrete Zahlen + Vergleich zu Platz 2.",
  "ranking": [{
    "supplier": "Name", "rank": 1, "scoreTotal": 87, "scorePrice": 90, "scoreDelivery": 85, "scoreQuality": 80, "scoreService": 88,
    "totalNet": 12345.67, "totalGross": null, "currency": "EUR", "deliveryDays": 14, "paymentTerms": "30 Tage netto", "inkoterm": "DDP",
    "pros": ["..."], "cons": ["..."]
  }],
  "normalizedPositions": [{
    "supplier": "Name", "description": "Original-Text", "normalizedDescription": "Was ist das wirklich",
    "category": "Material|Bearbeitung|Versand|Sonstiges", "quantity": 100, "unit": "m",
    "pricePerUnit": 12.50, "totalPrice": 1250.00,
    "normalizedQty": 100, "normalizedUnit": "m", "normalizedPpu": 12.50
  }],
  "insights": ["Allgemeine Beobachtung 1", "..."],
  "recommendations": ["Konkrete Handlungsempfehlung 1", "..."],
  "caveats": ["Was ist nicht direkt vergleichbar oder unsicher", "..."]
}
\`\`\`

WICHTIG: Wenn ein Angebot fundamentale Felder (z.B. Preis) nicht enthaelt, nimm es trotzdem ins ranking auf mit niedrigem Score und erklaere im "cons" was fehlt.`;

export async function runClaudeComparison(
  offers: OfferInput[],
  backgroundInfo: string,
  customPrompt: string,
): Promise<{ result: ClaudeComparisonResult; meta: { model: string; inputTokens: number; outputTokens: number; runMs: number } }> {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert");
  if (offers.length < 2) throw new Error("Mindestens 2 Angebote fuer Vergleich noetig");

  const client = new Anthropic({ apiKey: API_KEY });

  const userMessage = buildUserMessage(offers, backgroundInfo, customPrompt);

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const runMs = Date.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim();

  // JSON extrahieren (ggf. von ```json ... ``` umrahmt)
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
      runMs,
    },
  };
}

function buildUserMessage(offers: OfferInput[], backgroundInfo: string, customPrompt: string): string {
  const lines: string[] = [];
  lines.push("# Aufgabe");
  lines.push("Vergleiche die folgenden Angebote nach der Methodik aus dem System-Prompt und liefere die JSON-Antwort.");
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

  lines.push("# Angebote");
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i];
    lines.push(`## Angebot ${i + 1} — ${o.supplierName}`);
    lines.push(`Datei: ${o.filename}`);
    lines.push("```");
    lines.push(o.extractedText.slice(0, 30000));  // safety cap
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
    winnerReason: "Mock-Result: Setze ANTHROPIC_API_KEY in /root/.id-portal-secrets.env damit echte KI-Auswertung laeuft.",
    ranking: offers.map((o, i) => ({
      supplier: o.supplierName,
      rank: i + 1,
      scoreTotal: 50 - i * 5,
      scorePrice: 50, scoreDelivery: 50, scoreQuality: 50, scoreService: 50,
      totalNet: null, currency: "EUR", deliveryDays: null,
      pros: ["Mock-Eintrag"], cons: ["Kein echter API-Call"],
    })),
    normalizedPositions: [],
    insights: ["Mock — kein API-Key"],
    recommendations: ["ANTHROPIC_API_KEY in /root/.id-portal-secrets.env setzen + Container restart"],
    caveats: ["Diese Auswertung ist ein Platzhalter"],
  };
}
