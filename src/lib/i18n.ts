/**
 * Konvention §4 (UI Design): i18n DE + EN.
 *
 * Lightweight eigene Lib (keine Extra-Dependency), Cookie-basiert.
 * Server-Components: `await getServerT()` -> sync `t(key)` Funktion.
 * Client-Components: `useT()` Hook (siehe i18n-provider.tsx).
 *
 * Default: DE. User kann via LanguageToggle in Sidebar zu EN wechseln.
 */
export type Locale = "de" | "en";
export const LOCALES: Locale[] = ["de", "en"];
export const DEFAULT_LOCALE: Locale = "de";
export const COOKIE_NAME = "angebot.locale";

// ---- Translation Dictionary ----
// Pro Key ein Eintrag fuer beide Sprachen.
// Konvention: dot-notation als key (z.B. "nav.portal", "list.title")
const DICT: Record<string, Record<Locale, string>> = {
  // Sidebar
  "nav.portal": { de: "Zurueck zum Portal", en: "Back to portal" },
  "nav.comparisons": { de: "Meine Vergleiche", en: "My comparisons" },
  "nav.new": { de: "Neuer Vergleich", en: "New comparison" },
  "nav.costs": { de: "Total API AI-Costs", en: "Total API AI-Costs" },
  "nav.archive": { de: "Archiv", en: "Archive" },
  "nav.notifications": { de: "Benachrichtigungen", en: "Notifications" },
  "nav.export": { de: "Daten-Export", en: "Data export" },
  "nav.settings": { de: "Einstellungen", en: "Settings" },
  "app.title": { de: "Angebotsvergleich", en: "Offer comparison" },
  "app.subtitle": { de: "KI-gestuetzt mit Claude", en: "AI-powered with Claude" },

  // List page
  "list.title": { de: "Meine Vergleiche", en: "My comparisons" },
  "list.archived_hint": { de: "{n} archiviert", en: "{n} archived" },
  "list.archived_link": { de: "Archiv ansehen", en: "View archive" },
  "list.empty": { de: "Noch keine Vergleiche. Lege deinen ersten an.", en: "No comparisons yet. Create your first one." },
  "list.empty_archive": { de: "Archiv ist leer.", en: "Archive is empty." },
  "list.create_first": { de: "Ersten Vergleich anlegen", en: "Create first comparison" },
  "list.offers": { de: "{n} Angebote", en: "{n} offers" },
  "list.archived_at": { de: "archiviert {date}", en: "archived {date}" },

  // Buttons
  "btn.new": { de: "Neuer Vergleich", en: "New comparison" },
  "btn.archive": { de: "Archivieren", en: "Archive" },
  "btn.restore": { de: "Wiederherstellen", en: "Restore" },
  "btn.delete": { de: "Loeschen", en: "Delete" },
  "btn.delete_permanent": { de: "Endgueltig loeschen", en: "Delete permanently" },
  "btn.save": { de: "Speichern", en: "Save" },
  "btn.cancel": { de: "Abbrechen", en: "Cancel" },
  "btn.run": { de: "KI-Analyse starten", en: "Start AI analysis" },
  "btn.rerun": { de: "Erneut analysieren", en: "Re-analyze" },
  "btn.send": { de: "Senden", en: "Send" },
  "btn.export_pdf": { de: "Als PDF", en: "As PDF" },
  "btn.export_csv": { de: "CSV", en: "CSV" },

  // Status badges
  "status.draft": { de: "Entwurf", en: "Draft" },
  "status.processing": { de: "KI laeuft", en: "AI running" },
  "status.done": { de: "Fertig", en: "Done" },
  "status.error": { de: "Fehler", en: "Error" },

  // Detail page
  "detail.winner": { de: "Sieger", en: "Winner" },
  "detail.score": { de: "Score", en: "Score" },
  "detail.delivery_days": { de: "Tage Lieferzeit", en: "days lead time" },
  "detail.eingaben": { de: "Eingaben fuer KI", en: "AI inputs" },
  "detail.background_info": { de: "Hintergrund-Info", en: "Background info" },
  "detail.custom_prompt": { de: "Spezielle Hinweise", en: "Special notes" },
  "detail.uploaded_offers": { de: "Hochgeladene Angebote", en: "Uploaded offers" },
  "detail.cost_label": { de: "Kosten dieses Vergleichs:", en: "Cost of this comparison:" },
  "detail.all_costs": { de: "Alle Kosten", en: "All costs" },
  "detail.followups": { de: "Follow-ups", en: "Follow-ups" },
  "detail.processing_text": { de: "Claude analysiert deine Anfrage", en: "Claude is analyzing your request" },
  "detail.processing_hint": { de: "Das kann 20-90 Sekunden dauern bei {n} Angeboten.", en: "This may take 20-90 seconds for {n} offers." },
  "detail.refresh_status": { de: "Status aktualisieren", en: "Refresh status" },
  "detail.error_title": { de: "Fehler bei der KI-Analyse", en: "Error during AI analysis" },
  "detail.draft_min2": { de: "Mindestens 2 Angebote werden fuer einen Vergleich benoetigt. Aktuell: {n}.", en: "At least 2 offers are needed for a comparison. Currently: {n}." },
  "detail.draft_ready": { de: "Bereit zur KI-Analyse — {n} Angebote vorbereitet.", en: "Ready for AI analysis — {n} offers prepared." },
  "detail.ranking": { de: "Ranking", en: "Ranking" },
  "detail.insights": { de: "Erkenntnisse", en: "Insights" },
  "detail.recommendations": { de: "Empfehlungen", en: "Recommendations" },
  "detail.caveats": { de: "Vorbehalte", en: "Caveats" },
  "detail.sensitivity": { de: "Sensitivitaet", en: "Sensitivity" },
  "detail.pareto": { de: "Pareto-Analyse", en: "Pareto analysis" },
  "detail.normalized_positions": { de: "Normalisierte Positionen", en: "Normalized positions" },
  "detail.rerun_question": { de: "Komplette Neu-Analyse?", en: "Full re-analysis?" },
  "detail.rerun_explain": { de: "Falls Angebote getauscht oder Hintergrund-Info geaendert wurde — startet einen frischen KI-Lauf (kostet ca. {cost}). Bestehender Run wird ueberschrieben.", en: "If offers were swapped or background info changed — starts a fresh AI run (costs about {cost}). Existing run will be overwritten." },
  "detail.warning_partial": { de: "Nur {n} von {total} Angeboten im Ranking.", en: "Only {n} of {total} offers in the ranking." },
  "detail.warning_partial_hint": { de: "Ein aelterer Run hat ein PDF moeglicherweise als Anfrage statt Angebot eingestuft. Klicke \"Erneut analysieren\".", en: "An older run may have classified a PDF as request instead of offer. Click \"Re-analyze\"." },

  // Followup chat
  "chat.title": { de: "Follow-up Chat · Ergebnis verfeinern", en: "Follow-up chat · Refine result" },
  "chat.subtitle": { de: "stelle Folgefragen, lass neu gewichten, lass tiefer analysieren", en: "ask follow-ups, re-weight, dive deeper" },
  "chat.placeholder": { de: "Was willst du verfeinern? z.B. andere Gewichtung, was-wenn-Analyse, vertiefe einen Aspekt, korrigiere KI-Fehler...", en: "What do you want to refine? e.g. different weights, what-if analysis, deepen an aspect, correct AI errors..." },
  "chat.thinking": { de: "KI denkt nach...", en: "AI thinking..." },
  "chat.cost_hint": { de: "Strg+Enter sendet · Folgefragen kosten meist 0,5-5 ct.", en: "Ctrl+Enter to send · Follow-ups usually cost 0.5-5 ct." },

  // Costs page
  "costs.title": { de: "KI-Kosten", en: "AI costs" },
  "costs.period.day": { de: "Heute", en: "Today" },
  "costs.period.month": { de: "Monat", en: "Month" },
  "costs.period.year": { de: "Jahr", en: "Year" },
  "costs.period.all": { de: "Gesamt", en: "All" },
  "costs.scope.mine": { de: "Nur ich", en: "Only me" },
  "costs.scope.all": { de: "Alle User", en: "All users" },
  "costs.total_eur": { de: "Gesamt EUR", en: "Total EUR" },
  "costs.calls": { de: "Calls", en: "Calls" },
  "costs.tokens": { de: "Tokens", en: "Tokens" },
  "costs.avg": { de: "Ø/Call", en: "avg/call" },
  "costs.by_month": { de: "Verlauf nach Monaten", en: "Monthly history" },
  "costs.by_user": { de: "Pro Nutzer", en: "Per user" },
  "costs.single_calls": { de: "Einzel-Calls", en: "Individual calls" },
  "costs.no_entries": { de: "Keine Eintraege im gewaehlten Zeitraum", en: "No entries in selected period" },

  // Common
  "common.loading": { de: "Laedt...", en: "Loading..." },
  "common.optional": { de: "optional", en: "optional" },
  "common.recommended": { de: "Empfohlen", en: "Recommended" },
  "common.active": { de: "aktiv", en: "active" },
  "common.inactive": { de: "inaktiv", en: "inactive" },
  "common.user": { de: "User", en: "User" },
  "common.email": { de: "Email", en: "Email" },
  "common.name": { de: "Name", en: "Name" },
  "common.date": { de: "Datum", en: "Date" },
  "common.action": { de: "Aktion", en: "Action" },
  "common.details": { de: "Details", en: "Details" },
  "common.close": { de: "Schliessen", en: "Close" },
  "common.open": { de: "oeffnen", en: "open" },
};


/** Standalone Translator (sync) fuer einen gegebenen Locale */
export function makeT(locale: Locale) {
  return function t(key: string, vars?: Record<string, string | number>): string {
    const entry = DICT[key];
    if (!entry) return key; // fallback: key sichtbar machen
    let s = entry[locale] || entry[DEFAULT_LOCALE] || key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return s;
  };
}


/** Export DICT damit Client den ganzen Block bekommt */
export function getDict() {
  return DICT;
}
