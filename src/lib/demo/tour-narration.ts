import { createServerFn } from "@tanstack/react-start";

type OutlineStep = { id: string; title: string; outline: string };

const cache = new Map<string, Record<string, string>>();

export const getTourNarrationFn = createServerFn({ method: "POST" })
  .validator((d: { tourId: string; steps: OutlineStep[] }) => ({
    tourId: String(d.tourId ?? "").slice(0, 80),
    steps: Array.isArray(d.steps)
      ? d.steps.slice(0, 40).map((s) => ({
          id: String(s.id ?? "").slice(0, 64),
          title: String(s.title ?? "").slice(0, 80),
          outline: String(s.outline ?? "").slice(0, 400),
        }))
      : [],
  }))
  .handler(async ({ data }): Promise<{ scripts: Record<string, string>; source: "ai" | "fallback" }> => {
    const cached = cache.get(data.tourId);
    if (cached) return { scripts: cached, source: "ai" };
    const key =
      typeof process !== "undefined"
        ? process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
        : "";
    if (!key || data.steps.length === 0) {
      return { scripts: {}, source: "fallback" };
    }
    const openai = Boolean(process.env.OPENAI_API_KEY?.trim()) && !process.env.XAI_API_KEY?.trim();
    const url = openai
      ? "https://api.openai.com/v1/chat/completions"
      : "https://api.x.ai/v1/chat/completions";
    const model = openai ? "gpt-4o-mini" : "grok-4.5";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.3,
          max_tokens: 1800,
          messages: [
            {
              role: "system",
              content:
                "You write spoken tour narration for Summex, a hospitality OS powered by Quantum Reach. Guest cards are Quantum Payments only. Tone: premium, clear, sales-ready, accurate. Two or three short sentences per step. No hype. Return JSON: {\"scripts\":{\"id\":\"spoken text\"}}",
            },
            {
              role: "user",
              content: JSON.stringify({
                tourId: data.tourId,
                facts: [
                  "Demo rooms are isolated from live tenants.",
                  "The Laundry: Steam Distillery bar + Diamond House BBQ kitchen, one guest check.",
                  "Never mention Zest or Stripe or Square as a POS processor.",
                ],
                steps: data.steps,
              }),
            },
          ],
        }),
      });
      if (!res.ok) return { scripts: {}, source: "fallback" };
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) return { scripts: {}, source: "fallback" };
      const parsed = JSON.parse(json) as { scripts?: Record<string, string> };
      const scripts: Record<string, string> = {};
      for (const s of data.steps) {
        const t = parsed.scripts?.[s.id];
        if (typeof t === "string" && t.trim()) scripts[s.id] = t.trim().slice(0, 500);
      }
      if (Object.keys(scripts).length) cache.set(data.tourId, scripts);
      return { scripts, source: "ai" };
    } catch {
      return { scripts: {}, source: "fallback" };
    }
  });
