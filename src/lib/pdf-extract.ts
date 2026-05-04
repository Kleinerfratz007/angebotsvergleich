/**
 * Konvention §15.1 (2026-05-04): PDF-Text-Extraktion fuer KI-Auswertung.
 * Nutzt pdf-parse — funktioniert fuer text-basierte PDFs (NICHT scan/bild-basiert).
 * Bei Bild-PDFs: leerer Text, KI bekommt nur dateiname als Hinweis.
 */
import pdfParse from "pdf-parse";

export async function extractText(buffer: Buffer, mimeType: string, filename: string): Promise<string> {
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    try {
      const result = await pdfParse(buffer);
      return result.text || "";
    } catch (e) {
      return `[PDF-Extraktion fehlgeschlagen: ${(e as Error).message}]`;
    }
  }
  if (mimeType.startsWith("text/") || filename.match(/\.(txt|csv|md)$/i)) {
    return buffer.toString("utf8");
  }
  // .docx etc nicht unterstuetzt im MVP
  return `[Dateityp ${mimeType} nicht unterstuetzt — bitte als PDF oder TXT hochladen]`;
}
