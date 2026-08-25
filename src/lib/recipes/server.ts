import { heuristicRecipeExtract } from "./parse";
import type { RecipeExtract } from "@/lib/costs/types";

function aiCredentials(): { key: string; base: string; model: string } | null {
  const xai = process.env.XAI_API_KEY?.trim();
  if (xai) return { key: xai, base: "https://api.x.ai/v1", model: "grok-4.5" };
  const openai = process.env.OPENAI_API_KEY?.trim();
  if (openai) {
    return { key: openai, base: "https://api.openai.com/v1", model: "gpt-4o-mini" };
  }
  return null;
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence?.[1]?.trim() ?? trimmed;
  const start = body.search(/[{[]/);
  if (start < 0) return null;
  try {
    return JSON.parse(body.slice(start));
  } catch {
    const end = body.lastIndexOf("}");
    if (end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function asExtract(raw: unknown, fallback: RecipeExtract): RecipeExtract {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const linesRaw = Array.isArray(o.lines) ? o.lines : [];
  const lines = linesRaw
    .map((x) => {
      const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const name = String(r.name ?? "").trim();
      if (!name) return null;
      return {
        name,
        qty: Number(r.qty) || 1,
        unit: String(r.unit ?? "each").slice(0, 12),
        skuHint: r.skuHint ? String(r.skuHint) : undefined,
      };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .slice(0, 24);
  const stepsRaw = Array.isArray(o.steps) ? o.steps : [];
  const steps = stepsRaw
    .map((x) => {
      if (typeof x === "string") return { text: x.trim() };
      const r = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
      const text = String(r.text ?? "").trim();
      if (!text) return null;
      const seconds = r.seconds != null ? Number(r.seconds) : undefined;
      return { text, seconds: Number.isFinite(seconds) ? seconds : undefined };
    })
    .filter((v): v is NonNullable<typeof v> => Boolean(v))
    .slice(0, 16);
  const st = String(o.station ?? fallback.station ?? "kitchen");
  const station =
    st === "bar" || st === "expo" || st === "dessert" || st === "kitchen" ? st : fallback.station;
  return {
    name: String(o.name ?? fallback.name).slice(0, 80),
    yieldQty: Number(o.yieldQty) || fallback.yieldQty,
    yieldUnit: String(o.yieldUnit ?? fallback.yieldUnit).slice(0, 24),
    glassware: o.glassware ? String(o.glassware) : fallback.glassware,
    garnish: o.garnish ? String(o.garnish) : fallback.garnish,
    station,
    allergens: Array.isArray(o.allergens)
      ? o.allergens.map((a) => String(a)).filter(Boolean).slice(0, 12)
      : fallback.allergens,
    dietary: Array.isArray(o.dietary)
      ? o.dietary.map((a) => String(a)).filter(Boolean).slice(0, 8)
      : fallback.dietary,
    notes: o.notes ? String(o.notes) : fallback.notes,
    steps: steps.length ? steps : fallback.steps,
    lines: lines.length ? lines : fallback.lines,
    source: "ai",
    note: o.note ? String(o.note) : undefined,
  };
}

export async function parseRecipeExtract(opts: {
  text: string;
  fileName?: string;
  imageDataUrl?: string;
}): Promise<RecipeExtract> {
  const fallback = heuristicRecipeExtract(opts.text, opts.fileName);
  const creds = aiCredentials();
  if (!creds) return fallback;

  const userContent: unknown[] = [
    {
      type: "text",
      text: `Extract a bar/kitchen recipe as JSON:
{"name":"","yieldQty":1,"yieldUnit":"cocktail","glassware":"","garnish":"","station":"bar","allergens":[],"dietary":[],"notes":"","steps":[{"text":"","seconds":null}],"lines":[{"name":"","qty":1,"unit":"oz","skuHint":""}]}
station is kitchen|bar|expo|dessert. Units: oz, ml, g, each, dash, tsp.
Text/filename:\n${(opts.text || opts.fileName || "").slice(0, 4000)}`,
    },
  ];
  if (opts.imageDataUrl?.startsWith("data:image")) {
    userContent.push({
      type: "image_url",
      image_url: { url: opts.imageDataUrl.slice(0, 1_500_000) },
    });
  }

  try {
    const res = await fetch(`${creds.base}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.key}`,
      },
      body: JSON.stringify({
        model: creds.model,
        temperature: 0.15,
        max_tokens: 1100,
        messages: [
          {
            role: "system",
            content:
              "You extract hospitality recipes for Summex. Return JSON only. Do not invent SKU ids. Keep allergen tags honest — only list what the text or photo supports.",
          },
          { role: "user", content: userContent },
        ],
      }),
    });
    if (!res.ok) return fallback;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const parsed = extractJson(body.choices?.[0]?.message?.content ?? "");
    if (!parsed) return fallback;
    return asExtract(parsed, fallback);
  } catch {
    return fallback;
  }
}

export function recipeAiEnabled(): boolean {
  return Boolean(aiCredentials());
}
