import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import NewComparisonClient from "./client";

export const dynamic = "force-dynamic";

export default async function NewComparisonPage() {
  const { user } = await getSession();
  if (!user) redirect("/portal/");
  return <NewComparisonClient />;
}
