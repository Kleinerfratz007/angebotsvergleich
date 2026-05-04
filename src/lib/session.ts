/**
 * Konvention §4 (2026-05-04): Authentik-OIDC Login fuer App-Subpath.
 *
 * Pragmatischer Auth-Helper: Liest Authentik-Auth-Cookie das vom nginx
 * outpost gesetzt wird (X-Authentik-Username, -Email, -Groups, -Name Header).
 * Bei lokalem Dev: dev-User Fallback wenn LOCAL_DEV=1.
 *
 * Konvention §15.6 (2026-05-04): Authorization-Filter — Angebotsvergleich
 * ist nur fuer Admin (sartor.m) ODER alle User in Authentik-Group "Einkauf"
 * sichtbar. Andere bekommen eine "Kein Zugriff"-Page.
 */
import { headers } from "next/headers";
import { prisma } from "./db";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  groups: string[];
  /** Hat Berechtigung diese App zu nutzen (Admin oder Group "Einkauf") */
  hasAccess: boolean;
}

const LOCAL_DEV = process.env.LOCAL_DEV === "1";

const ADMIN_EMAILS = new Set(["sartor.m@id-engineering.com"]);
const ALLOWED_GROUPS = new Set(["Einkauf", "einkauf", "Purchasing", "purchasing"]);
/** Zusaetzliche Whitelist falls Authentik-Group fehlt — pflegen via env ANGEBOT_USER_WHITELIST="a@x.de,b@y.de" */
const EXTRA_WHITELIST = new Set(
  (process.env.ANGEBOT_USER_WHITELIST || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export async function getSession(): Promise<{ user: SessionUser | null }> {
  const h = await headers();
  let email = h.get("x-authentik-email") || "";
  let username = h.get("x-authentik-username") || "";
  let displayName = h.get("x-authentik-name") || username;
  let sub = h.get("x-authentik-uid") || "";
  const groupsHeader = h.get("x-authentik-groups") || "";

  if (!email && LOCAL_DEV) {
    email = "dev@id-engineering.com";
    username = "dev";
    displayName = "Dev User";
    sub = "dev-uid-1";
  }

  if (!email) return { user: null };

  // Groups parsen (Authentik liefert kommaseparierte oder JSON-Array — beide handhaben)
  let groups: string[] = [];
  if (groupsHeader.startsWith("[")) {
    try { groups = JSON.parse(groupsHeader) as string[]; } catch { /* ignore */ }
  } else {
    groups = groupsHeader.split(/[,;|]/).map((s) => s.trim()).filter(Boolean);
  }

  const isAdmin = ADMIN_EMAILS.has(email.toLowerCase());

  // Access-Berechtigung pruefen
  const inAllowedGroup = groups.some((g) => ALLOWED_GROUPS.has(g));
  const inWhitelist = EXTRA_WHITELIST.has(email.toLowerCase());
  const hasAccess = isAdmin || inAllowedGroup || inWhitelist;

  // JIT-Provision in DB (auch User ohne Access werden gespeichert — fuer Audit)
  const user = await prisma.user.upsert({
    where: { email },
    update: { name: displayName },
    create: {
      authentikSub: sub || email,
      email,
      name: displayName,
      isAdmin,
    },
    select: { id: true, email: true, name: true, isAdmin: true },
  });

  return {
    user: {
      ...user,
      groups,
      hasAccess,
    },
  };
}

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s.user) {
    throw new Error("Unauthorized");
  }
  return s.user;
}
