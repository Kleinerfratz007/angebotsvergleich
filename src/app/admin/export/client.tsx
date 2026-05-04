"use client";

import { Download, Calendar, FileText, AlertTriangle } from "lucide-react";

interface YearStats { year: number; comparisons: number; offers: number; followups: number; usage: number }

export default function ExportClient({ years }: { years: YearStats[] }) {
  const currentYear = new Date().getFullYear();
  const minRetentionYear = currentYear - 10;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Download size={22} /> Daten-Export pro Jahr</h1>
        <p className="text-sm opacity-70 mt-1">
          Konvention §15.9 — Daten werden 10 Jahre vorgehalten. Admin kann ein Jahr als ZIP-Archiv exportieren
          (Vergleiche + Angebote + Follow-ups + AiUsage + PDFs).
        </p>
      </div>

      <div className="card text-xs flex items-start gap-2" style={{ background: "rgb(254 243 199)", color: "rgb(146 64 14)" }}>
        <AlertTriangle size={16} className="shrink-0 mt-0.5" />
        <div>
          <strong>10-Jahre-Aufbewahrung:</strong> Daten von Jahren <strong>vor {minRetentionYear}</strong> dürfen nach
          Sicherung gelöscht werden. Aktuelle 10 Jahre (<strong>{minRetentionYear}–{currentYear}</strong>) müssen
          erhalten bleiben.
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold text-sm uppercase opacity-70 mb-3">Verfügbare Jahre</h2>
        {years.length === 0 ? (
          <p className="text-sm opacity-60">Noch keine Daten in der DB.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                <th className="text-left p-2"><Calendar size={12} className="inline" /> Jahr</th>
                <th className="text-right p-2">Vergleiche</th>
                <th className="text-right p-2">Angebote</th>
                <th className="text-right p-2">Follow-ups</th>
                <th className="text-right p-2">AI-Calls</th>
                <th className="text-right p-2">Status</th>
                <th className="text-right p-2">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y) => {
                const isOldEnoughToDelete = y.year < minRetentionYear;
                return (
                  <tr key={y.year} style={{ borderBottom: "1px solid rgb(var(--border))" }}>
                    <td className="p-2 font-mono font-bold">{y.year}</td>
                    <td className="p-2 text-right">{y.comparisons}</td>
                    <td className="p-2 text-right">{y.offers}</td>
                    <td className="p-2 text-right">{y.followups}</td>
                    <td className="p-2 text-right">{y.usage}</td>
                    <td className="p-2 text-right text-xs">
                      {isOldEnoughToDelete ? (
                        <span className="badge" style={{ background: "rgb(220 252 231)", color: "rgb(21 128 61)" }}>löschbar</span>
                      ) : (
                        <span className="badge" style={{ background: "rgb(243 232 255)", color: "rgb(88 28 135)" }}>10J-Aufbewahrung</span>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      <a
                        href={`/angebotsvergleich/api/admin/export-year?year=${y.year}`}
                        download
                        className="btn btn-primary btn-sm"
                      >
                        <FileText size={12} /> ZIP
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card text-xs opacity-70">
        <strong>Inhalt jedes ZIPs:</strong>
        <ul className="list-disc pl-5 mt-1 space-y-1">
          <li><code>README.txt</code> — Metadaten zum Pack</li>
          <li><code>comparisons.json</code> — alle Vergleiche des Jahres</li>
          <li><code>offers.json</code> — alle Angebote</li>
          <li><code>followups.json</code> — alle Folge-Fragen</li>
          <li><code>usage.json</code> — alle KI-Calls mit Tokens + Kosten</li>
          <li><code>pdfs/<em>{"{comparisonId}"}</em>/<em>{"{originalFilename}"}</em></code> — alle PDF-Dateien</li>
          <li><code>rfq/<em>{"{comparisonId}"}</em>.txt</code> — extrahierte RFQ-Texte</li>
        </ul>
      </div>
    </div>
  );
}
