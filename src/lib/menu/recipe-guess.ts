/**
 * Recipe proposals for a menu upload.
 * A guess is not a recipe until the user approves it.
 * A known well pour is filled in, and the user can still edit the ounces.
 */
import { formatWellPour, knownWellPour, type WellPourLine } from "../pos/well-book.ts";

export type RecipeGuessLine = { name: string; qty: number; unit: string };

export type ItemRecipeGuess = {
  /** guess waits for approve or discard. known is a well pour, not a guess. */
  status: "guess" | "known" | "approved" | "discarded";
  lines: RecipeGuessLine[];
  /** Spirit ounces on a known well. The mixer stays one each. */
  pourOz?: number;
};

const UNIT_WORD =
  "oz|ounce|ounces|ml|g|kg|lb|lbs|cup|cups|tbsp|tsp|dash|dashes|splash|splashes|slice|slices|piece|pieces|each|cl";

function cleanName(raw: string): string {
  return raw
    .replace(/^[^a-z0-9]+|[^a-z0-9)]+$/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function normalizeUnit(raw: string | undefined): string {
  const unit = (raw || "each").trim().toLowerCase();
  if (unit === "ounce" || unit === "ounces") return "oz";
  return unit || "each";
}

function clampQty(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return 1;
  return Math.round(n * 100) / 100;
}

/** Model recipe array. Missing or empty means the description can still propose one. */
export function recipeLinesFromUnknown(raw: unknown): RecipeGuessLine[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const lines: RecipeGuessLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const rec = row as { name?: unknown; qty?: unknown; amount?: unknown; unit?: unknown };
    const name = cleanName(String(rec.name ?? ""));
    if (name.length < 2) continue;
    lines.push({
      name,
      qty: clampQty(rec.qty ?? rec.amount),
      unit: normalizeUnit(typeof rec.unit === "string" ? rec.unit : "each"),
    });
  }
  return lines.length ? lines.slice(0, 24) : undefined;
}

/** Split a printed description into ingredients. "beef patty, american cheese, brioche" is three lines. */
export function linesFromDescription(description: string): RecipeGuessLine[] {
  let body = description.trim();
  if (!body) return [];
  const dashed = body.split(/\s+[—–-]\s+/);
  if (dashed.length > 1) body = dashed.slice(1).join(", ");
  const parts = body
    .split(/\n|\/|;|,|\band\b|\bwith\b/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  const lines: RecipeGuessLine[] = [];
  const qty = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*(${UNIT_WORD})?\\s+(.+)$`, "i");
  for (const part of parts) {
    const match = part.match(qty);
    if (match) {
      const name = cleanName(match[3] ?? "");
      if (name.length < 2) continue;
      lines.push({ name, qty: clampQty(match[1]), unit: normalizeUnit(match[2]) });
      continue;
    }
    const name = cleanName(part);
    if (name.length < 2) continue;
    lines.push({ name, qty: 1, unit: "each" });
  }
  return lines.slice(0, 24);
}

function asGuessLines(lines: readonly WellPourLine[]): RecipeGuessLine[] {
  return lines.map((line) => ({ name: line.name, qty: line.qty, unit: line.unit }));
}

/**
 * Known wells fill themselves and are not a guess.
 * Otherwise the model recipe wins, then a split of the description.
 */
export function proposeItemRecipe(input: {
  name: string;
  description?: string;
  modelLines?: RecipeGuessLine[] | null;
}): ItemRecipeGuess | undefined {
  const known = knownWellPour(input.name);
  if (known) {
    const oz = known.lines.find((line) => line.unit === "oz");
    return {
      status: "known",
      lines: asGuessLines(known.lines),
      pourOz: oz?.qty,
    };
  }
  const model = input.modelLines?.filter((line) => line.name.trim().length > 1) ?? [];
  if (model.length) {
    return { status: "guess", lines: model.slice(0, 24) };
  }
  const described = linesFromDescription(input.description ?? "");
  if (described.length) return { status: "guess", lines: described };
  return undefined;
}

/** Approved and known pours can be written. A pending guess or a discard writes nothing. */
export function recipeLinesToStore(recipe: ItemRecipeGuess | undefined | null): RecipeGuessLine[] | null {
  if (!recipe) return null;
  if (recipe.status !== "approved" && recipe.status !== "known") return null;
  const lines = recipe.lines.filter((line) => line.name.trim() && line.qty > 0);
  return lines.length ? lines : null;
}

export function formatRecipeGuess(lines: readonly RecipeGuessLine[]): string {
  return lines.map((line) => `${line.qty} ${line.unit} ${line.name}`).join(", ");
}

export function knownPourPhrase(recipe: ItemRecipeGuess | undefined | null): string {
  if (!recipe) return "";
  return formatWellPour(recipe.lines);
}

/** Change the spirit ounces on a known well. The mixer line stays. */
export function setKnownPour(recipe: ItemRecipeGuess, oz: number): ItemRecipeGuess {
  const n = Number(oz);
  if (!Number.isFinite(n) || n <= 0 || n > 12) return recipe;
  const qty = Math.round(n * 100) / 100;
  return {
    ...recipe,
    pourOz: qty,
    lines: recipe.lines.map((line) => (line.unit === "oz" ? { ...line, qty } : line)),
  };
}
