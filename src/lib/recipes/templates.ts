import type { RecipeExtract } from "@/lib/costs/types";

export const RECIPE_TEMPLATES: RecipeExtract[] = [
  {
    name: "Margarita",
    yieldQty: 1,
    yieldUnit: "cocktail",
    glassware: "Rocks",
    garnish: "Salt rim, lime wheel",
    station: "bar",
    allergens: [],
    dietary: [],
    steps: [
      { text: "Salt the rim if requested" },
      { text: "Shake tequila, lime, and orange liqueur with ice", seconds: 12 },
      { text: "Strain over fresh ice" },
      { text: "Garnish with lime" },
    ],
    lines: [
      { name: "Blanco tequila", qty: 2, unit: "oz" },
      { name: "Lime juice", qty: 1, unit: "oz" },
      { name: "Triple sec", qty: 0.75, unit: "oz" },
    ],
    source: "guided",
  },
  {
    name: "House burger",
    yieldQty: 1,
    yieldUnit: "plate",
    station: "kitchen",
    allergens: ["gluten", "dairy"],
    dietary: [],
    garnish: "Pickle spear",
    steps: [
      { text: "Season patty; griddle to temp", seconds: 180 },
      { text: "Toast bun" },
      { text: "Stack cheese, sauce, veg; plate with pickle" },
    ],
    lines: [
      { name: "Burger patty", qty: 1, unit: "each" },
      { name: "Brioche bun", qty: 1, unit: "each" },
      { name: "American cheese", qty: 1, unit: "each" },
    ],
    source: "guided",
  },
  {
    name: "House salad",
    yieldQty: 1,
    yieldUnit: "plate",
    station: "kitchen",
    allergens: [],
    dietary: ["vegetarian"],
    steps: [
      { text: "Wash and dry greens" },
      { text: "Toss with dressing; plate" },
    ],
    lines: [
      { name: "Mixed greens", qty: 80, unit: "g" },
      { name: "House vinaigrette", qty: 1, unit: "oz" },
    ],
    source: "guided",
  },
];

export function matchRecipeTemplate(text: string): RecipeExtract | undefined {
  const t = text.toLowerCase();
  if (/\bmargarita|tequila\b/.test(t)) return RECIPE_TEMPLATES[0];
  if (/\bburger|smash|patty\b/.test(t)) return RECIPE_TEMPLATES[1];
  if (/\bsalad|greens\b/.test(t)) return RECIPE_TEMPLATES[2];
  return undefined;
}
