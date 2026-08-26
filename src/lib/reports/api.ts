import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { guidedInsights } from "./rules";
import type { LocationInsights, LocationMetrics } from "./types";

function clipMetrics(raw: unknown): LocationMetrics | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as LocationMetrics;
  if (typeof m.locationId !== "string" || typeof m.locationName !== "string") return null;
  if (typeof m.sales?.netCents !== "number") return null;
  return m;
}

async function llmInsights(m: LocationMetrics): Promise<LocationInsights | null> {
  const key =
    typeof process !== "undefined"
      ? process.env.XAI_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim()
      : "";
  if (!key) return null;
  const openai = Boolean(process.env.OPENAI_API_KEY?.trim()) && !process.env.XAI_API_KEY?.trim();
  const url = openai
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.x.ai/v1/chat/completions";
  const model = openai ? "gpt-4o-mini" : "grok-4.5";
  const fallback = guidedInsights(m);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 1400,
      messages: [
        {
          role: "system",
          content:
            "You are an operations analyst for Summex, a hospitality OS powered by Quantum Reach. Guest cards are Quantum Payments only. Never invent inventory counts. If cost data is missing, say so. Return JSON only matching: {summary, healthScore, findings:[{area,severity,observation,evidence}], costVsOrdering:[{itemOrCategory,salesTrend,costSignal,issue,recommendation}], recommendations:[{priority,action,expectedImpact,ownerRole,applyView}], risks:[], dataGaps:[]}. severity is info|watch|urgent. priority is now|soon|later. applyView one of reports,settings,menu,kitchen,bar,waitlist,employees,settlement. Tone: precise, premium, no hype.",
        },
        {
          role: "user",
          content: JSON.stringify({
            facts: [
              "Do not mention Zest. Do not recommend a second card processor.",
              "Demo locations are isolated from live tenants.",
            ],
            metrics: m,
            guided: fallback,
          }),
        },
      ],
    }),
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  const parsed = JSON.parse(json) as Partial<LocationInsights>;
  if (!parsed.summary || !Array.isArray(parsed.findings)) return null;
  return {
    summary: String(parsed.summary).slice(0, 800),
    healthScore: Math.max(0, Math.min(100, Number(parsed.healthScore) || fallback.healthScore)),
    findings: (parsed.findings ?? fallback.findings).slice(0, 10) as LocationInsights["findings"],
    costVsOrdering: (parsed.costVsOrdering ?? fallback.costVsOrdering).slice(0, 8) as LocationInsights["costVsOrdering"],
    recommendations: (parsed.recommendations ?? fallback.recommendations).slice(
      0,
      8,
    ) as LocationInsights["recommendations"],
    risks: (parsed.risks ?? fallback.risks).slice(0, 6).map((r) => String(r).slice(0, 240)),
    source: "ai",
    dataGaps: (parsed.dataGaps ?? fallback.dataGaps).slice(0, 6).map((r) => String(r).slice(0, 240)),
  };
}

const cache = new Map<string, LocationInsights>();

export const analyzeLocationPerformanceFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { metrics: unknown; isDemo?: boolean }) => ({
    metrics: d.metrics,
    isDemo: Boolean(d.isDemo),
  }))
  .handler(async ({ context, data }): Promise<LocationInsights> => {
    const m = clipMetrics(data.metrics);
    if (!m) throw new Error("Invalid metrics payload");
    if (!data.isDemo && !m.isDemo) {
      const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
      await bindTenant(context.userId, { locationId: m.locationId });
    }
    const key = `${m.locationId}:${m.range}:${m.from}:${m.to}:${m.operatorId ?? ""}:${m.serverId ?? ""}`;
    const hit = cache.get(key);
    if (hit) return hit;
    let out: LocationInsights;
    try {
      out = (await llmInsights(m)) ?? guidedInsights(m);
    } catch {
      out = guidedInsights(m);
    }
    cache.set(key, out);
    if (cache.size > 40) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    return out;
  });
