import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import NewComparisonClient from "./client";
import { getSetting } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

export default async function NewComparisonPage() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  const geminiKey = await getSetting("GOOGLE_API_KEY");
  return <NewComparisonClient geminiAvailable={Boolean(geminiKey)} />;
}
