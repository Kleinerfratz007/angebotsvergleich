import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getSetting } from "@/lib/settings-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/settings/test — testet einen Provider mit minimal-Request.
 * Body: { provider: "claude" | "gemini" }
 */
export async function POST(req: NextRequest) {
  const { user } = await getSession();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!user.isAdmin) return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => null) as { provider?: string } | null;
  const provider = body?.provider === "gemini" ? "gemini" : "claude";

  try {
    if (provider === "claude") {
      const apiKey = await getSetting("ANTHROPIC_API_KEY");
      if (!apiKey) return NextResponse.json({ ok: false, error: "Kein ANTHROPIC_API_KEY gesetzt" });
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const modelOverride = await getSetting("ANTHROPIC_MODEL");
      const model = modelOverride || "claude-opus-4-7";
      const client = new Anthropic({ apiKey });
      const r = await client.messages.create({
        model, max_tokens: 50,
        messages: [{ role: "user", content: "Antworte mit genau einem Wort: OK" }],
      });
      const text = r.content.find((b) => b.type === "text");
      const txt = text && text.type === "text" ? text.text : "";
      return NextResponse.json({ ok: true, provider, model, response: txt.slice(0, 100), tokens: r.usage });
    }
    // gemini
    const apiKey = await getSetting("GOOGLE_API_KEY");
    if (!apiKey) return NextResponse.json({ ok: false, error: "Kein GOOGLE_API_KEY gesetzt" });
    const modelOverride = await getSetting("GEMINI_MODEL");
    const model = modelOverride || "gemini-3.1-pro";
    const mod = await import("@google/generative-ai");
    const client = new mod.GoogleGenerativeAI(apiKey);
    const m = client.getGenerativeModel({ model });
    const r = await m.generateContent("Antworte mit genau einem Wort: OK");
    return NextResponse.json({ ok: true, provider, model, response: r.response.text().slice(0, 100), tokens: r.response.usageMetadata });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message });
  }
}
