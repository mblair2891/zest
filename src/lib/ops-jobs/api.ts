import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { JOB_CADENCES, type JobCadence, type OpsJobFacts } from "./types";
import { parseDataGaps, parseOpsJobRows, sanitizeOpsText } from "./sanitize";

const SYSTEM = `You are an operations analyst for Summex, a hospitality OS powered by Quantum Reach.
Guest cards are Quantum Payments only (Finix is the rail — never invent Finix, Visa, or card charges that are not in the facts).
Gift cards are the first-party Summex ledger, not the card processor.
Return JSON only: { "narrative": string, "rows": [{"type","severity","subject","amountCents","pct","suggestedAction","entityId","entityName"}], "dataGaps": string[] }.
severity is info|watch|urgent. type must be one of the seed row types already used.
Rules:
- Never accuse theft, stealing, or name anyone a thief. Exceptions are a review queue, not verdicts.
- Never recommend auto clock-out. Staffing language is recommend_cut | hold | add only; the manager decides.
- Never invent processor fees, captures, chargebacks, or $35 splits. If capture/fee facts are missing, put that in dataGaps.
- Cost recs: count SKU, confirm waste, change par, change pour/plate, change menu price. Human Save required for prices.
- Scope: host sees the house pack; bar entities (e.g. Steam) see bar cost/sales; food entities (e.g. Diamond) see food.
- Keep narrative under 600 characters. At most 24 rows. Prefer the seed rows; add only if facts support them.
- Tone: precise, operator-facing, no hype.`;

function clipFacts(raw: unknown): OpsJobFacts | null {
  if (!raw || typeof raw !== "object") return null;
  const f = raw as OpsJobFacts;
  if (!JOB_CADENCES.includes(f.cadence as JobCadence)) return null;
  if (!f.location || typeof f.location.name !== "string") return null;
  return f;
}

export const runOpsJobFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { facts: unknown; locationId?: string; isDemo?: boolean }) => ({
    facts: d.facts,
    locationId: String(d.locationId ?? "").slice(0, 80),
    isDemo: Boolean(d.isDemo),
  }))
  .handler(async ({ context, data }): Promise<{
    status: "ok" | "skipped" | "error";
    skipReason?: string;
    narrative: string;
    rows: ReturnType<typeof parseOpsJobRows>;
    dataGaps: string[];
  }> => {
    const facts = clipFacts(data.facts);
    if (!facts) {
      return {
        status: "error",
        skipReason: "Invalid facts payload",
        narrative: "Job could not run — facts were invalid.",
        rows: [],
        dataGaps: ["Invalid facts payload"],
      };
    }
    if (!data.isDemo && data.locationId) {
      const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
      await bindTenant(context.userId, { locationId: data.locationId });
    }

    const seedRows = parseOpsJobRows(facts.seedRows, 40);
    const seedGaps = parseDataGaps(facts.dataGaps, 8);
    const apiKey = process.env.XAI_API_KEY?.trim();
    if (!apiKey) {
      return {
        status: "skipped",
        skipReason: "XAI_API_KEY is not configured. Job queued as skipped — no insights invented.",
        narrative:
          "Skipped: no xAI key. Factual floor and exception rows below are from the house, not a model. Nothing was invented.",
        rows: seedRows,
        dataGaps: [
          ...seedGaps,
          "XAI_API_KEY missing — narrative skipped, seed rows only.",
        ].slice(0, 8),
      };
    }

    const maxTokens =
      facts.cadence === "service_hourly" ? 1200 : facts.cadence === "nightly" ? 1800 : 2200;
    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.15,
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: SYSTEM },
            {
              role: "user",
              content: JSON.stringify({
                cadence: facts.cadence,
                location: facts.location,
                config: facts.config,
                house: facts.house,
                entities: facts.entities,
                seedRows,
                dataGaps: seedGaps,
              }),
            },
          ],
        }),
      });
      if (!res.ok) {
        return {
          status: "error",
          skipReason: `xAI API error ${res.status}`,
          narrative: sanitizeOpsText(
            `xAI returned ${res.status}. Showing house facts only — no invented insights.`,
          ),
          rows: seedRows,
          dataGaps: [...seedGaps, `xAI HTTP ${res.status}`].slice(0, 8),
        };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content ?? "";
      const json = text.match(/\{[\s\S]*\}/)?.[0];
      if (!json) {
        return {
          status: "error",
          skipReason: "xAI returned no JSON",
          narrative: "Model response was not JSON. House fact rows only.",
          rows: seedRows,
          dataGaps: [...seedGaps, "Unparseable model output"].slice(0, 8),
        };
      }
      const parsed = JSON.parse(json) as {
        narrative?: string;
        rows?: unknown;
        dataGaps?: unknown;
      };
      const rows = parseOpsJobRows(parsed.rows, 24);
      return {
        status: "ok",
        narrative: sanitizeOpsText(parsed.narrative || "Operations pack.", 800),
        rows: rows.length ? rows : seedRows,
        dataGaps: parseDataGaps(parsed.dataGaps ?? seedGaps, 8),
      };
    } catch (e) {
      return {
        status: "error",
        skipReason: e instanceof Error ? e.message.slice(0, 180) : "xAI call failed",
        narrative: "Job failed to reach xAI. House fact rows only — nothing invented.",
        rows: seedRows,
        dataGaps: [...seedGaps, "xAI call failed"].slice(0, 8),
      };
    }
  });
