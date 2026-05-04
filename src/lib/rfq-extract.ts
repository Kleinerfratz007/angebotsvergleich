/**
 * Konvention §15.6 (2026-05-04): RFQ / Angebotsanfrage-Scope-Extraktion.
 *
 * KI bekommt den extrahierten PDF-Text der EIGENEN Anfrage (nicht eines Angebots)
 * und liefert ein strukturiertes Scope-JSON. Das wird beim spaeteren
 * Angebotsvergleich als BENCHMARK genutzt: "Wie gut erfuellt jedes Angebot
 * den Scope der Anfrage?"
 */
import Anthropic from "@anthropic-ai/sdk";
import { getSetting } from "./settings-store";

const MODEL_DEFAULT = process.env.ANTHROPIC_MODEL || "claude-opus-4-7";

export interface RfqScope {
  /** 1-2 Saetze: Was ist diese Anfrage in einem Satz? */
  summary: string;
  /** Was wird konkret angefragt (Produkte, Dienstleistungen, Systeme) */
  whatIsRequested: string;
  /** Welches Problem soll geloest werden, was ist der Anwendungszweck */
  problemToSolve: string;
  /** Kontext: Projekt, Branche, Anwendung */
  context: { project?: string | null; industry?: string | null; application?: string | null };
  /** Konkrete Positionen mit Mengen+Spezifikationen */
  scopeItems: Array<{
    description: string;
    quantity?: number | null;
    unit?: string | null;
    specs?: string | null;
    isOptional?: boolean;
  }>;
  /** Technische Anforderungen (Material, Toleranz, Funktion) */
  technicalRequirements: string[];
  /** Qualitaets-Anforderungen (Zertifikate, Zeugnisse, ISO etc.) */
  qualityRequirements: string[];
  /** Liefer-Anforderungen */
  deliveryRequirements: { deadline?: string | null; location?: string | null; inkoterm?: string | null; deliveryNotes?: string | null };
  /** Budget (falls genannt) */
  budget: { amount?: number | null; currency?: string | null; notes?: string | null };
  /** Zertifizierungen die gefordert sind (CE, REACH, RoHS, ISO9001, EN10204 3.1, ...) */
  certifications: string[];
  /** Zahlungsbedingungen / Skonto-Anforderungen */
  paymentRequirements: string[];
  /** Sonstige Rahmenbedingungen / Constraints */
  otherConstraints: string[];
  /** Was die KI NICHT eindeutig aus dem Text extrahieren konnte */
  caveats: string[];
}

const SYSTEM_PROMPT = `Du bist ein erfahrener Einkaufsanalyst und Beschaffungsexperte.

# WICHTIG: Kontext der Aufgabe

Der User hat dieses Dokument bewusst als **Angebotsanfrage / RFQ / Lastenheft / Spezifikation** hochgeladen.
Akzeptiere diese Klassifikation — auch wenn das Dokument in einem fuer dich ungewohnten Format
vorliegt (z.B. interne Anfrage-Nummer wie "0073-26-SM", Lastenheft, technische Spezifikation,
E-Mail-Anfrage, oder einfach nur eine Liste von benoetigten Artikeln). 

ZWEIFLE NICHT daran, dass es eine Anfrage ist. Extrahiere stattdessen so viel wie moeglich.

# Deine Aufgabe

**Analysiere dieses Dokument als Angebotsanfrage. Was ist der Scope?**

Welche Anforderungen, Mengen, Spezifikationen und Rahmenbedingungen werden gestellt?
Verstehe den GESAMTEN Kontext — auch implizit:

- **WAS** wird angefragt (Produkte? Dienstleistungen? Komplettsystem?)
  - Auch wenn nur Artikel-Nummern stehen: nimm sie als Position auf
  - Auch wenn nur Material/Abmessungen stehen: das IST die Anfrage
- **WELCHES** Problem soll geloest werden / Anwendungszweck (oft im Briefkopf/Betreff/Projekt-Hinweis)
- **TECHNISCHE** Anforderungen (Material, Toleranzen, Funktionen, Schnittstellen, Normen)
- **QUALITAETS**-Anforderungen (Zertifikate, Werkszeugnisse EN 10204, ISO 9001, etc.)
- **LIEFER**-Anforderungen (Termin, Ort, Inkoterm — oft in Fusszeile/Lieferadresse)
- **BUDGET** (falls genannt)
- **ZAHLUNGS**-Bedingungen (Skonto, Zahlungsziel)
- **KONTEXT** (Projekt-Nummer, Branche, Anwendung, Kunde)
- **SONSTIGE** Rahmenbedingungen (Geheimhaltung, Compliance, Made-in-EU, ESG, …)

Auch wenn ein Feld nicht explizit drinsteht: wenn aus dem Kontext (Briefkopf, Adresse, Projekt-Nummer)
etwas ableitbar ist, nimm es auf. Sei pragmatisch — der Einkaeufer braucht den Scope, nicht eine
Diskussion ueber Vollstaendigkeit.

# Worauf du KEINESFALLS reagieren sollst

- Schreibe NIEMALS "das ist keine Anfrage" oder "das ist ein Angebot"
- Lehne NIEMALS ab das Dokument zu analysieren
- Wenn das Dokument unstrukturiert ist: trotzdem extrahieren was geht
- Wenn das Dokument SEHR knapp ist: alle vorhandenen Informationen abbilden, Rest in caveats notieren

Sei vollstaendig — alles was im Text steht und fuer einen Lieferanten relevant waere.

# Output-Format

Du antwortest **AUSSCHLIESSLICH** mit JSON nach diesem Schema (kein Markdown, kein Vor-/Nachtext):

\`\`\`json
{
  "summary": "1-2 Saetze: Worum geht es in dieser Anfrage in einem Satz?",
  "whatIsRequested": "Konkret: Was wird angefragt (Produkte/Dienstleistungen/System).",
  "problemToSolve": "Welches Problem soll geloest werden / Anwendungszweck (Hintergrund).",
  "context": { "project": "Projekt-Name oder null", "industry": "Branche oder null", "application": "Anwendung oder null" },
  "scopeItems": [
    { "description": "Position 1", "quantity": 100, "unit": "Stk", "specs": "Material, Toleranzen, etc.", "isOptional": false }
  ],
  "technicalRequirements": ["Anforderung 1", "..."],
  "qualityRequirements": ["EN 10204 3.1 Zeugnis", "ISO 9001"],
  "deliveryRequirements": { "deadline": "KW 32 / 2026", "location": "Werk Duisburg", "inkoterm": "DDP", "deliveryNotes": "Anlieferung Mo-Fr 7-15 Uhr" },
  "budget": { "amount": 50000, "currency": "EUR", "notes": "Zielbudget, nicht hart" },
  "certifications": ["CE", "REACH", "RoHS"],
  "paymentRequirements": ["30 Tage netto", "2% Skonto innerhalb 14 Tagen erwuenscht"],
  "otherConstraints": ["Made-in-EU bevorzugt", "Geheimhaltung NDA erforderlich"],
  "caveats": ["Genaue Toleranzen waren nicht im Text — bitte beim Lieferanten erfragen"]
}
\`\`\`

WICHTIG:
- Erfinde NICHTS. Wenn ein Feld nicht im Text steht: leerer String/null/leeres Array.
- Mengen als JSON-Numbers (100, nicht "100").
- caveats: notiere offen was unklar ist — wertvoll fuer den User.`;

export interface RfqExtractResult {
  scope: RfqScope;
  meta: { model: string; inputTokens: number; outputTokens: number; runMs: number };
}

export async function extractRfqScope(extractedText: string): Promise<RfqExtractResult> {
  const apiKey = await getSetting("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY nicht konfiguriert");

  const modelOverride = await getSetting("ANTHROPIC_MODEL");
  const MODEL = modelOverride || MODEL_DEFAULT;
  const client = new Anthropic({ apiKey });

  const start = Date.now();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{
      role: "user",
      content: `# Angebotsanfrage (RFQ) / Eigene Anfrage\n\nExtrahiere den Scope dieser Anfrage. Liefere JSON nach Schema.\n\n\`\`\`\n${extractedText.slice(0, 60000)}\n\`\`\``,
    }],
  });
  const runMs = Date.now() - start;

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Claude returned no text");
  const raw = textBlock.text.trim();

  let json = raw;
  const fence = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence) json = fence[1];

  let parsed: RfqScope;
  try {
    parsed = JSON.parse(json) as RfqScope;
  } catch (e) {
    throw new Error(`RFQ-Scope nicht parsbar: ${(e as Error).message}. Raw: ${raw.slice(0, 200)}`);
  }

  return {
    scope: parsed,
    meta: { model: MODEL, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens, runMs },
  };
}
