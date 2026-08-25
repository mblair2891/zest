import type { RecipeExtract } from "@/lib/costs/types";
import { matchRecipeTemplate } from "./templates";

const UNIT =
  /\b(oz|ml|g|kg|lb|each|ea|dash|barspoon|tsp|tbsp|cup|pint|shot|count)\b/i;

function parseLine(raw: string): RecipeExtract["lines"][number] | null {
  const t = raw.replace(/^[-*•]\s*/, "").trim();
  if (t.length < 2) return null;
  const m = t.match(
    /^(\d+(?:\.\d+)?)\s*(oz|ml|g|kg|lb|each|ea|dash|tsp|tbsp|cup|pint|shot)?\s+(.+)$/i,
  );
  if (m) {
    return {
      name: m[3]!.trim(),
      qty: parseFloat(m[1]!),
      unit: (m[2] || "each").toLowerCase(),
    };
  }
  const m2 = t.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(oz|ml|g|kg|lb|each|ea)?$/i);
  if (m2) {
    return {
      name: m2[1]!.trim(),
      qty: parseFloat(m2[2]!),
      unit: (m2[3] || "each").toLowerCase(),
    };
  }
  return { name: t, qty: 1, unit: "each" };
}

export function heuristicRecipeExtract(text: string, fileName?: string): RecipeExtract {
  const blob = `${fileName ?? ""}\n${text}`.trim();
  const tmpl = matchRecipeTemplate(blob);
  const name =
    blob.match(/^(?:recipe:?\s*)?([A-Z][^\n,]{2,40})/m)?.[1]?.trim() ||
    tmpl?.name ||
    fileName?.replace(/\.[a-z0-9]+$/i, "") ||
    "House recipe";

  const lines: RecipeExtract["lines"] = [];
  for (const row of blob.split(/\n|;/)) {
    if (!UNIT.test(row) && !/^\s*[-*•]/.test(row)) continue;
    const parsed = parseLine(row);
    if (parsed && parsed.name.length > 1) lines.push(parsed);
    if (lines.length >= 20) break;
  }

  const steps = blob
    .split(/\n/)
    .map((s) => s.replace(/^\d+[.)]\s*/, "").trim())
    .filter((s) => /^(shake|stir|strain|build|grill|plate|garnish|salt|toast|pour|muddle|add)\b/i.test(s))
    .slice(0, 12)
    .map((text) => ({ text }));

  const allergens = ["gluten", "dairy", "nuts", "egg", "soy", "shellfish", "fish", "sesame"].filter(
    (a) => new RegExp(`\\b${a}\\b`, "i").test(blob),
  );

  if (!lines.length && tmpl) {
    return { ...tmpl, name, source: "guided", note: "Template fill — confirm quantities and SKUs." };
  }

  return {
    name: name.slice(0, 80),
    yieldQty: tmpl?.yieldQty ?? 1,
    yieldUnit: tmpl?.yieldUnit ?? (/cocktail|drink|martini/i.test(blob) ? "cocktail" : "portion"),
    glassware: blob.match(/glass(?:ware)?:?\s*([^\n]+)/i)?.[1]?.trim() || tmpl?.glassware,
    garnish: blob.match(/garnish:?\s*([^\n]+)/i)?.[1]?.trim() || tmpl?.garnish,
    station: /\b(bar|cocktail|shake|stir)\b/i.test(blob) ? "bar" : tmpl?.station ?? "kitchen",
    allergens: allergens.length ? allergens : tmpl?.allergens ?? [],
    dietary: /\bvegan\b/i.test(blob) ? ["vegan"] : tmpl?.dietary ?? [],
    notes: undefined,
    steps: steps.length ? steps : tmpl?.steps ?? [],
    lines: lines.length ? lines : tmpl?.lines ?? [{ name: "Ingredient", qty: 1, unit: "each" }],
    source: "guided",
    note: "Guided extract — confirm quantities, SKUs, and steps before save.",
  };
}
