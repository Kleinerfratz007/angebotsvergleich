/**
 * Konvention §15.5 (2026-05-04): PDF-Bericht via @react-pdf/renderer.
 * Wird vom Server gerendert (renderToBuffer) und als application/pdf
 * gestreamt.
 */
/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import type { ClaudeComparisonResult, RankingItem, NormalizedPosition } from "./claude";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: "Helvetica", color: "#111" },
  header: { borderBottom: "2 solid #5b21b6", paddingBottom: 8, marginBottom: 12 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#5b21b6" },
  subtitle: { fontSize: 10, color: "#555", marginTop: 2 },
  meta: { fontSize: 8, color: "#777", marginTop: 4 },
  section: { marginTop: 12 },
  sectionTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#5b21b6", marginBottom: 4, borderBottom: "1 solid #ddd", paddingBottom: 2 },
  paragraph: { marginBottom: 4, lineHeight: 1.4 },
  winnerBox: { backgroundColor: "#fef3c7", border: "1 solid #f59e0b", padding: 8, borderRadius: 4, marginTop: 4 },
  winnerLabel: { fontSize: 8, color: "#92400e", textTransform: "uppercase", fontFamily: "Helvetica-Bold" },
  winnerName: { fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 2 },
  winnerScore: { fontSize: 9, color: "#666", marginTop: 2 },
  table: { width: "100%", marginTop: 6 },
  tableHead: { flexDirection: "row", backgroundColor: "#f3f4f6", borderBottom: "1 solid #ccc", paddingVertical: 4, paddingHorizontal: 4 },
  tableRow: { flexDirection: "row", borderBottom: "0.5 solid #eee", paddingVertical: 3, paddingHorizontal: 4 },
  th: { fontFamily: "Helvetica-Bold", fontSize: 8 },
  td: { fontSize: 8 },
  rank: { width: 16, textAlign: "center" },
  supplier: { flex: 2 },
  num: { flex: 1, textAlign: "right" },
  numWide: { flex: 1.3, textAlign: "right" },
  badge: { padding: 2, borderRadius: 2, fontSize: 7, color: "white" },
  badgeOk: { backgroundColor: "#10b981" },
  badgeBad: { backgroundColor: "#ef4444" },
  badgeWarn: { backgroundColor: "#f59e0b" },
  badgeNeutral: { backgroundColor: "#6b7280" },
  twoCol: { flexDirection: "row", gap: 6 },
  col: { flex: 1 },
  bullet: { flexDirection: "row", marginBottom: 2 },
  bulletDot: { width: 8 },
  bulletText: { flex: 1, fontSize: 8 },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, textAlign: "center", fontSize: 7, color: "#999", borderTop: "0.5 solid #ddd", paddingTop: 4 },
});

export interface ReportProps {
  comparisonId: string;
  title: string;
  customerName?: string | null;
  projectRef?: string | null;
  backgroundInfo?: string | null;
  customPrompt?: string | null;
  createdAt: Date;
  user: { name: string; email: string };
  result: ClaudeComparisonResult;
  meta: { model: string; inputTokens: number; outputTokens: number; runMs: number; costEur: number };
  followups: Array<{ prompt: string; response: string; createdAt: Date; userName: string; costEur: number }>;
}

function fmtNum(n: number | null | undefined, suffix = ""): string {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("de-DE", { maximumFractionDigits: 2 }) + suffix;
}
function fmtDate(d: Date): string {
  return d.toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

export function ComparisonReport(p: ReportProps) {
  const r = p.result;
  return (
    <Document title={`Angebotsvergleich – ${p.title}`} author={p.user.name} subject="KI-gestuetzter Angebotsvergleich">
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Angebotsvergleich</Text>
          <Text style={styles.subtitle}>{p.title}</Text>
          <Text style={styles.meta}>
            {p.customerName ? `Kunde: ${p.customerName}` : ""}
            {p.projectRef ? ` · Projekt: ${p.projectRef}` : ""}
            {` · Erstellt: ${fmtDate(p.createdAt)}`}
            {` · Von: ${p.user.name}`}
            {` · ID: ${p.comparisonId}`}
          </Text>
        </View>

        {/* Winner */}
        {r.ranking && r.ranking[0] && (
          <View style={styles.winnerBox}>
            <Text style={styles.winnerLabel}>Empfohlener Sieger</Text>
            <Text style={styles.winnerName}>{r.ranking[0].supplier}</Text>
            <Text style={styles.winnerScore}>
              Score {r.ranking[0].scoreTotal}/100
              {r.ranking[0].totalNet ? ` · ${fmtNum(r.ranking[0].totalNet)} ${r.ranking[0].currency || "EUR"} netto` : ""}
              {r.ranking[0].deliveryDays ? ` · ${r.ranking[0].deliveryDays} Tage Lieferzeit` : ""}
            </Text>
          </View>
        )}

        {/* Summary + Reason */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zusammenfassung</Text>
          <Text style={styles.paragraph}>{r.summary}</Text>
          {r.winnerReason && <Text style={styles.paragraph}>{r.winnerReason}</Text>}
        </View>

        {/* Ranking-Tabelle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ranking ({r.ranking?.length || 0} Angebote)</Text>
          <View style={styles.table}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, styles.rank]}>#</Text>
              <Text style={[styles.th, styles.supplier]}>Lieferant</Text>
              <Text style={[styles.th, styles.numWide]}>Total netto</Text>
              <Text style={[styles.th, styles.num]}>TCO</Text>
              <Text style={[styles.th, styles.num]}>Liefer.</Text>
              <Text style={[styles.th, styles.num]}>Coverage</Text>
              <Text style={[styles.th, styles.num]}>Score</Text>
            </View>
            {(r.ranking || []).map((row) => (
              <View key={row.supplier + row.rank} style={styles.tableRow}>
                <Text style={[styles.td, styles.rank]}>{row.rank}</Text>
                <Text style={[styles.td, styles.supplier]}>{row.supplier}</Text>
                <Text style={[styles.td, styles.numWide]}>{row.totalNet ? `${fmtNum(row.totalNet)} ${row.currency || "EUR"}` : "—"}</Text>
                <Text style={[styles.td, styles.num]}>{row.tcoEur ? fmtNum(row.tcoEur) : "—"}</Text>
                <Text style={[styles.td, styles.num]}>{row.deliveryDays ? `${row.deliveryDays}d` : "—"}</Text>
                <Text style={[styles.td, styles.num]}>{row.coveragePct !== null && row.coveragePct !== undefined ? `${row.coveragePct}%` : "—"}</Text>
                <Text style={[styles.td, styles.num, { fontFamily: "Helvetica-Bold" }]}>{row.scoreTotal}/100</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Pro/Contra je Lieferant */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pro &amp; Contra je Lieferant</Text>
          {(r.ranking || []).map((row) => (
            <View key={row.supplier + "-prc"} style={{ marginBottom: 8 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 }}>
                #{row.rank} {row.supplier}
              </Text>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Text style={{ color: "#16a34a", fontFamily: "Helvetica-Bold", fontSize: 8 }}>+ Pro</Text>
                  {(row.pros || []).map((s, i) => (
                    <View key={i} style={styles.bullet}><Text style={styles.bulletDot}>·</Text><Text style={styles.bulletText}>{s}</Text></View>
                  ))}
                </View>
                <View style={styles.col}>
                  <Text style={{ color: "#dc2626", fontFamily: "Helvetica-Bold", fontSize: 8 }}>– Contra</Text>
                  {(row.cons || []).map((s, i) => (
                    <View key={i} style={styles.bullet}><Text style={styles.bulletDot}>·</Text><Text style={styles.bulletText}>{s}</Text></View>
                  ))}
                </View>
              </View>
              {((row.eolWarnings && row.eolWarnings.length > 0) || (row.riskFlags && row.riskFlags.length > 0)) && (
                <View style={{ marginTop: 2 }}>
                  {(row.eolWarnings || []).map((s, i) => (
                    <Text key={"eol" + i} style={{ fontSize: 7, color: "#dc2626" }}>⚠ EOL: {s}</Text>
                  ))}
                  {(row.riskFlags || []).map((s, i) => (
                    <Text key={"risk" + i} style={{ fontSize: 7, color: "#f59e0b" }}>⚠ Risiko: {s}</Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Insights / Recommendations / Caveats */}
        {r.insights && r.insights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Erkenntnisse</Text>
            {r.insights.map((s, i) => (
              <View key={i} style={styles.bullet}><Text style={styles.bulletDot}>·</Text><Text style={styles.bulletText}>{s}</Text></View>
            ))}
          </View>
        )}
        {r.recommendations && r.recommendations.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Empfehlungen</Text>
            {r.recommendations.map((s, i) => (
              <View key={i} style={styles.bullet}><Text style={styles.bulletDot}>·</Text><Text style={styles.bulletText}>{s}</Text></View>
            ))}
          </View>
        )}
        {r.caveats && r.caveats.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vorbehalte</Text>
            {r.caveats.map((s, i) => (
              <View key={i} style={styles.bullet}><Text style={styles.bulletDot}>·</Text><Text style={styles.bulletText}>{s}</Text></View>
            ))}
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer} render={({ pageNumber, totalPages }) => (
          `KI-Modell: ${p.meta.model} · ${p.meta.inputTokens} in / ${p.meta.outputTokens} out tokens · ${p.meta.runMs}ms · ` +
          `Kosten: ${p.meta.costEur < 0.01 ? (p.meta.costEur * 100).toFixed(2) + " ct" : p.meta.costEur.toFixed(4) + " EUR"} · ` +
          `Seite ${pageNumber}/${totalPages}`
        )} fixed />
      </Page>

      {/* Seite 2: Normalisierte Positionen + Followups */}
      {(r.normalizedPositions && r.normalizedPositions.length > 0) || p.followups.length > 0 ? (
        <Page size="A4" style={styles.page}>
          {r.normalizedPositions && r.normalizedPositions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Normalisierte Positionen</Text>
              <View style={styles.table}>
                <View style={styles.tableHead}>
                  <Text style={[styles.th, { flex: 2 }]}>Lieferant</Text>
                  <Text style={[styles.th, { flex: 3 }]}>Beschreibung</Text>
                  <Text style={[styles.th, { flex: 1 }]}>Kategorie</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Menge</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>EUR/Einh.</Text>
                  <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Total</Text>
                </View>
                {r.normalizedPositions.map((pos: NormalizedPosition, i: number) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.td, { flex: 2 }]}>{pos.supplier}</Text>
                    <Text style={[styles.td, { flex: 3 }]}>{pos.normalizedDescription || pos.description}</Text>
                    <Text style={[styles.td, { flex: 1 }]}>{pos.category || "—"}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{fmtNum(pos.quantity)} {pos.unit || ""}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{fmtNum(pos.pricePerUnit)}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{fmtNum(pos.totalPrice)}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {p.followups.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Folgefragen &amp; Verfeinerungen</Text>
              {p.followups.map((f, i) => (
                <View key={i} style={{ marginBottom: 8, paddingBottom: 6, borderBottom: "0.5 solid #eee" }}>
                  <Text style={{ fontSize: 8, color: "#666" }}>{fmtDate(f.createdAt)} · {f.userName} · {fmtNum(f.costEur, " EUR")}</Text>
                  <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginTop: 2 }}>F: {f.prompt}</Text>
                  <Text style={{ fontSize: 9, marginTop: 2 }}>A: {f.response}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={styles.footer} render={({ pageNumber, totalPages }) => `Seite ${pageNumber}/${totalPages}`} fixed />
        </Page>
      ) : null}
    </Document>
  );
}

// Helper-Variable damit eslint nicht ueber unbenutzten RankingItem-Import meckert
export type { RankingItem };
