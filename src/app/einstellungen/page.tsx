import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import SettingsClient from "./client";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  if (!user.isAdmin) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold mb-2">Einstellungen</h1>
        <p className="text-sm opacity-70">Nur fuer Admins.</p>
      </div>
    );
  }
  return <SettingsClient />;
}
