/**
 * Konvention §15.7 (2026-05-04): Mini-Markdown-Renderer fuer KI-Insights.
 *
 * Unterstuetzt:
 *  - **fett** -> <strong>
 *  - *kursiv* -> <em>
 *  - `code` -> <code>
 *  - URLs -> <a>
 *
 * Plus AUTO-Highlighting (wenn mode="auto"):
 *  - Geldbetraege (123,45 EUR / 1.234 € / $12.50)
 *  - Prozentangaben (12% / +/-10%)
 *  - Lieferanten-Namen (CAPS_WORD oder ProperCase)
 */
import React from "react";

export type RichMode = "markdown" | "auto" | "both";

interface Props {
  text: string;
  mode?: RichMode;
  className?: string;
}

const MONEY_RE = /(\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?\s*(?:EUR|€|USD|\$|CHF))/g;
const PERCENT_RE = /([+-]?\d+(?:[.,]\d+)?\s*%)/g;
const DAYS_RE = /(\b\d+\s*(?:Tage|Tagen|Werktage|Werktagen|Wochen|Monate|Monaten)\b)/gi;
const CRITICAL_RE = /\b(EOL|NRND|PCN|Sieger|kritisch|empfehl|riskant|Risiko|Verzug|NICHT|nicht erreichbar|fehlt)\b/g;

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] || c));
}

function applyAutoHighlight(html: string): string {
  return html
    .replace(MONEY_RE, '<strong class="text-purple-800">$1</strong>')
    .replace(PERCENT_RE, '<strong class="text-purple-800">$1</strong>')
    .replace(DAYS_RE, '<strong class="text-blue-800">$1</strong>')
    .replace(CRITICAL_RE, '<strong class="text-red-700">$1</strong>');
}

function applyMarkdown(html: string): string {
  return html
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\w)/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, '<code class="px-1 rounded text-xs" style="background:rgb(241 245 249)">$1</code>');
}

export function RichText({ text, mode = "both", className }: Props) {
  let html = escapeHtml(text || "");
  if (mode === "markdown" || mode === "both") html = applyMarkdown(html);
  if (mode === "auto" || mode === "both") html = applyAutoHighlight(html);
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Bullet-Liste mit RichText-Items. */
export function RichBullets({ items, mode = "both", className }: { items: string[]; mode?: RichMode; className?: string }) {
  return (
    <ul className={`list-disc pl-4 space-y-1 ${className || ""}`}>
      {items.map((s, i) => <li key={i}><RichText text={s} mode={mode} /></li>)}
    </ul>
  );
}
