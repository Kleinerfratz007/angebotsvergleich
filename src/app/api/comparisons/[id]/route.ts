import { NextRequest, NextResponse } from "next/server";
import { withIdempotency } from "@/lib/idempotency";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { deleteOfferFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/comparisons/[id]
 * Body: { archived: boolean }   -> setzt/löscht archivedAt
 *
 * (Andere Felder erlauben wir hier nicht — fuer das ist die UI-Form vorgesehen)
 */
async function _PATCH_handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const body = await req.json().catch(() => null) as { archived?: boolean } | null;
  if (!body || typeof body.archived !== "boolean") {
    return NextResponse.json({ error: "body.archived (boolean) erforderlich" }, { status: 400 });
  }

  const c = await prisma.comparison.findUnique({ where: { id }, select: { userId: true } });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.comparison.update({
    where: { id },
    data: { archivedAt: body.archived ? new Date() : null },
    select: { id: true, archivedAt: true },
  });

  return NextResponse.json({ ok: true, archived: updated.archivedAt !== null, archivedAt: updated.archivedAt });
}

/**
 * DELETE /api/comparisons/[id]
 * Hard-Delete: Comparison + Offers + Followups + AiUsage + Files.
 * Nur erlaubt fuer eigene Comparisons; AiUsage bleibt fuer Audit
 * mit comparisonId=null (SetNull-Cascade laut Schema).
 */
async function _DELETE_handler(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const c = await prisma.comparison.findUnique({
    where: { id },
    include: { offers: { select: { id: true, storageKey: true } } },
  });
  if (!c || c.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 1) Files auf Disk loeschen
  for (const o of c.offers) {
    try { await deleteOfferFile(o.storageKey); } catch { /* ignore */ }
  }

  // 2) Cascade-Delete: Offers + Followups via Schema onDelete: Cascade
  //    AiUsage bleibt mit comparisonId=null (SetNull) als Audit-Trail
  await prisma.comparison.delete({ where: { id } });

  return NextResponse.json({ ok: true, deleted: id, filesDeleted: c.offers.length });
}

export const PATCH = withIdempotency(_PATCH_handler, { appName: "angebotsvergleich" });

export const DELETE = withIdempotency(_DELETE_handler, { appName: "angebotsvergleich" });
