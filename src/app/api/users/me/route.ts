import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/** §0.2.7 DSGVO Anonymisierung. */
export async function DELETE(req: NextRequest) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  if (body?.confirmText !== "DELETE") {
    return NextResponse.json({ error: "confirmText must be 'DELETE'" }, { status: 400 });
  }

  const stamp = new Date().toISOString();
  const userId = user.id;
  const anon = `deleted-${userId.slice(0, 8)}@anonymous.local`;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { email: anon, name: "[geloeschter Nutzer]" },
    });
  });

  return NextResponse.json({
    deletedAt: stamp,
    anonymized: ["User.email", "User.name"],
    reason: body.reason ?? null,
  });
}
