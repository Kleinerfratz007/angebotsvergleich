import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Public-Health fuer Portal-Tile-Healthcheck (ohne Auth). */
export async function GET() {
  return NextResponse.json({ status: "ok", app: "angebotsvergleich" });
}
