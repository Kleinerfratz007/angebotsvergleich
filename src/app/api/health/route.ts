import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Konvention §24.9 - Public-Health fuer Portal-Tile-Healthcheck.
 *   { status, app, db, latency_ms, timestamp }
 */
export async function GET() {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      app: "angebotsvergleich",
      db: "ok",
      latency_ms: Date.now() - t0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        status: "degraded",
        app: "angebotsvergleich",
        db: "error",
        latency_ms: Date.now() - t0,
        timestamp: new Date().toISOString(),
        error: String(err),
      },
      { status: 503 },
    );
  }
}
