/**
 * Konvention §4 (2026-05-04): Authentik-OIDC Login fuer App-Subpath.
 *
 * Pragmatischer Auth-Helper: Liest Authentik-Auth-Cookie das vom nginx
 * outpost gesetzt wird (X-Authentik-Username Header).
 * Bei lokalem Dev: dev-User Fallback wenn LOCAL_DEV=1.
 */
import { headers } from "next/headers";
import { prisma } from "./db";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

const LOCAL_DEV = process.env.LOCAL_DEV === "1";

export async function getSession(): Promise<{ user: SessionUser | null }> {
  const h = await headers();
  let email = h.get("x-authentik-email") || "";
  let username = h.get("x-authentik-username") || "";
  let displayName = h.get("x-authentik-name") || username;
  let sub = h.get("x-authentik-uid") || "";

  if (!email && LOCAL_DEV) {
    email = "dev@id-engineering.com";
    username = "dev";
    displayName = "Dev User";
    sub = "dev-uid-1";
  }

  if (!email) return { user: null };

  // JIT-Provision in DB
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: displayName },
    create: {
      authentikSub: sub || email,
      email,
      name: displayName,
      isAdmin: email === "sartor.m@id-engineering.com",
    },
    select: { id: true, email: true, name: true, isAdmin: true },
  });
  return { user };
}

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s.user) {
    throw new Error("Unauthorized");
  }
  return s.user;
}
