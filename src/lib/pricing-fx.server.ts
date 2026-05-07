/**
 * Konvention §15.3 (2026-05-07): Server-only FX-rate loader.
 *
 * Liest /data/fx-rate.json (gepflegt vom daily-cron fetch-fx-rate.sh).
 * NICHT von Client-Components importieren — node:fs ist server-only.
 *
 * Fallback: FX_USD_EUR_DEFAULT (0.92) bei Datei-Miss oder Parse-Fehler.
 */
import { readFileSync, statSync } from "node:fs";
import { FX_USD_EUR_DEFAULT } from "./pricing";

const FX_PATH = "/data/fx-rate.json";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage

interface FxFile {
  usd_to_eur: number;
  date: string;
}

/**
 * Liest die aktuelle USD->EUR-Rate vom Disk-Cache.
 * Fail-soft: bei jedem Fehler -> FX_USD_EUR_DEFAULT.
 */
export function getServerFxRate(): number {
  try {
    const stat = statSync(FX_PATH);
    if (Date.now() - stat.mtimeMs > MAX_AGE_MS) {
      // alte Datei — verwende, aber warne
      console.warn("[pricing-fx] /data/fx-rate.json older than 7 days, using anyway");
    }
    const raw = readFileSync(FX_PATH, "utf-8");
    const parsed = JSON.parse(raw) as FxFile;
    const rate = Number(parsed.usd_to_eur);
    if (!Number.isFinite(rate) || rate <= 0 || rate > 2) {
      console.warn("[pricing-fx] invalid rate, using default:", parsed.usd_to_eur);
      return FX_USD_EUR_DEFAULT;
    }
    return rate;
  } catch (err) {
    console.warn("[pricing-fx] read failed, using default:", (err as Error).message);
    return FX_USD_EUR_DEFAULT;
  }
}
