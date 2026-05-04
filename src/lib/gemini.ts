/**
 * Konvention §15.2 (2026-05-04): Gemini-Pro-3.1 Provider fuer Angebotsvergleich.
 *
 * Vorbereitung — wird aktiv sobald GOOGLE_API_KEY gesetzt ist.
 * Nutzt @google/generative-ai SDK (lazy import damit kein Build-Hard-Dep).
 *
 * Liefert die gleiche ClaudeComparisonResult-Struktur damit das UI
 * Provider-agnostisch bleibt.
 */
import type { OfferInput, ClaudeComparisonResult } from "./claude";

const API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.1-pro";

export const isGeminiConfigured = (): boolean => Boolean(API_KEY);

const SYSTEM_PROMPT = `Du bist ein erfahrener Einkaufsanalyst und Beschaffungsexperte mit 20 Jahren Erfahrung im Vergleich technischer Angebote.

Du analysierst 2-10 Angebote unterschiedlicher Lieferanten und erstellst einen fundierten Vergleich. Die Angebote haben oft UNTERSCHIEDLICHE Mengen-Aufschluesselungen, Einheiten oder Bundling-Strategien — du normalisierst sie auf vergleichbare Werte.

# Methodik (Best Practices)

1. Normalisierung auf gleiche Einheit (€/m, €/kg, €/Stk).
2. Total Cost of Ownership (Listpreis + Versand + Zoll + Wartung + Garantie).
3. Weighted Score 0-100: Preis 40%, Lieferzeit 20%, Qualitaet 20%, Service 20%.
4. Pareto-Frontier: dominierte Angebote markieren.
5. Soft-Faktoren: Reputation, ISO 9001, REACH, RoHS, CE.
6. Inkoterms: EXW vs DDP fair vergleichen.
7. Zahlungsbedingungen + MOQ + Staffelpreise.
8. Sensitivitaet bei Mengen-Schwankung +/-10%.

# Output

Antworte AUSSCHLIESSLICH mit gueltigem JSON dieser Struktur (kein Markdown-Wrapper):

{
  "summary": "1-2 Saetze ueber Sieger + Begruendung mit Zahlen",
  "winnerSupplier": "Exakter Name aus Angebot",
  "winnerReason": "3-5 Saetze mit Zahlen-Vergleich zu Platz 2",
  "ranking": [{ "supplier": "Name", "rank": 1, "scoreTotal": 87, "scorePrice": 90, "scoreDelivery": 85, "scoreQuality": 80, "scoreService": 88, "totalNet": 12345.67, "currency": "EUR", "deliveryDays": 14, "paymentTerms": "30 Tage netto", "inkoterm": "DDP", "pros": ["..."], "cons": ["..."] }],
  "normalizedPositions": [{ "supplier": "Name", "description": "Original", "normalizedDescription": "Was ist es", "category": "Material|Bearbeitung|Versand|Sonstiges", "quantity": 100, "unit": "m", "pricePerUnit": 12.50, "totalPrice": 1250.00, "normalizedQty": 100, "normalizedUnit": "m", "normalizedPpu": 12.50 }],
  "insights": ["Beobachtung 1"],
  "recommendations": ["Empfehlung 1"],
  "caveats": ["Vorbehalt 1"]
}`;

export async function runGeminiComparison(
  offers: OfferInput[],
  backgroundInfo: string,
  customPrompt: string,
): Promise<{ result: ClaudeComparisonResult; meta: { model: string; inputTokens: number; outputTokens: number; runMs: number } }> {
  if (!API_KEY) throw new Error("GOOGLE_API_KEY (oder GEMINI_API_KEY) nicht konfiguriert");
  if (offers.length < 2) throw new Error("Mindestens 2 Angebote noetig");

  // Lazy import — package wird erst bei aktiver Nutzung benoetigt
  let mod: typeof import("@google/generative-ai");
  try {
    mod = await import("@google/generative-ai");
  } catch (e) {
    throw new Error(
      `@google/generative-ai SDK nicht installiert. Bitte ausfuehren: npm install @google/generative-ai. (${(e as Error).message})`,
    );
  }
  const { GoogleGenerativeAI } = mod;
  const client = new GoogleGenerativeAI(API_KEY);
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { responseMimeType: "application/json", maxOutputTokens: 8192 },
  });

  const userMessage = buildUserMessage(offers, backgroundInfo, customPrompt);

  const start = Date.now();
  const response = await model.generateContent(userMessage);
  const runMs = Date.now() - start;

  const text = response.response.text();
  let parsed: ClaudeComparisonResult;
  try {
    // responseMimeType=json sollte sauberes JSON zurueck geben
    parsed = JSON.parse(text) as ClaudeComparisonResult;
  } catch (e) {
    // Fallback: code-fence stripping
    const fence = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (fence) parsed = JSON.parse(fence[1]) as ClaudeComparisonResult;
    else throw new Error(`Gemini-Antwort nicht parsbar: ${(e as Error).message}`);
  }

  const usage = response.response.usageMetadata;
  return {
    result: parsed,
    meta: {
      model: MODEL,
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: usage?.candidatesTokenCount ?? 0,
      runMs,
    },
  };
}

function buildUserMessage(offers: OfferInput[], backgroundInfo: string, customPrompt: string): string {
  const lines: string[] = ["# Aufgabe", "Vergleiche die folgenden Angebote nach der Methodik aus den System-Instructions und liefere JSON.", ""];
  if (backgroundInfo.trim()) {
    lines.push("# Hintergrund-Information", backgroundInfo.trim(), "");
  }
  if (customPrompt.trim()) {
    lines.push("# Spezielle Hinweise vom Einkaeufer", customPrompt.trim(), "");
  }
  lines.push("# Angebote");
  for (let i = 0; i < offers.length; i++) {
    const o = offers[i];
    lines.push(`## Angebot ${i + 1} — ${o.supplierName}`);
    lines.push(`Datei: ${o.filename}`);
    lines.push("```");
    lines.push(o.extractedText.slice(0, 30000));
    lines.push("```", "");
  }
  return lines.join("\n");
}
