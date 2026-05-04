import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import KostenClient from "./client";

export const dynamic = "force-dynamic";

export default async function KostenPage() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  return <KostenClient isAdmin={user.isAdmin} userName={user.name || user.email} />;
}
