import type { MenuItemDraft } from "./types";

export type TemplateModifier = {
  name: string;
  required?: boolean;
  min?: number;
  max?: number;
  options: Array<{ name: string; priceCents: number }>;
};

export type MenuCategoryTemplate = {
  id: string;
  label: string;
  match: RegExp;
  categoryName: string;
  station: MenuItemDraft["station"];
  course: MenuItemDraft["course"];
  modifiers: TemplateModifier[];
  omits: string[];
  adds: Array<{ name: string; priceCents: number }>;
};

function opt(name: string, cents = 0) {
  return { name, priceCents: cents };
}

export const MENU_CATEGORY_TEMPLATES: MenuCategoryTemplate[] = [
  {
    id: "burger",
    label: "Burger",
    match: /\bburger|smash|cheeseburger|patty melt\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Doneness",
        required: true,
        min: 1,
        max: 1,
        options: [
          opt("Medium rare"),
          opt("Medium"),
          opt("Medium well"),
          opt("Well"),
        ],
      },
      {
        name: "Cheese",
        required: false,
        min: 0,
        max: 1,
        options: [opt("American"), opt("Cheddar"), opt("Swiss", 100)],
      },
    ],
    omits: ["No onion", "No pickle", "No lettuce", "No tomato", "No bun"],
    adds: [opt("Bacon", 200), opt("Extra patty", 400), opt("Avocado", 150)],
  },
  {
    id: "steak",
    label: "Steak",
    match: /\bsteak|ribeye|filet|sirloin|ny strip|new york strip|brisket plate\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Temp",
        required: true,
        min: 1,
        max: 1,
        options: [
          opt("Rare"),
          opt("Medium rare"),
          opt("Medium"),
          opt("Medium well"),
          opt("Well"),
        ],
      },
      {
        name: "Starch",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Mashed"), opt("Fries"), opt("Baked potato")],
      },
    ],
    omits: ["No butter", "No sauce", "No salt"],
    adds: [opt("Oscar", 600), opt("Extra veg", 200), opt("Peppercorn", 0)],
  },
  {
    id: "pizza",
    label: "Pizza",
    match: /\bpizza|flatbread|pie\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Size",
        required: true,
        min: 1,
        max: 1,
        options: [opt("10\""), opt("12\"", 300), opt("16\"", 600)],
      },
      {
        name: "Crust",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Regular"), opt("Thin"), opt("Gluten-free", 250)],
      },
    ],
    omits: ["No sauce", "No cheese", "Light cheese", "Well done"],
    adds: [opt("Pepperoni", 200), opt("Mushroom", 150), opt("Extra cheese", 200)],
  },
  {
    id: "pasta",
    label: "Pasta",
    match: /\bpasta|spaghetti|linguine|fettuccine|ravioli|lasagna|mac\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Sauce",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Red"), opt("White"), opt("Pesto"), opt("Oil & garlic")],
      },
    ],
    omits: ["No cheese", "No garlic", "No cream"],
    adds: [opt("Chicken", 400), opt("Shrimp", 500), opt("Meatball", 350)],
  },
  {
    id: "salad",
    label: "Salad",
    match: /\bsalad|caesar|greens|wedge\b/i,
    categoryName: "Starters",
    station: "kitchen",
    course: "salad",
    modifiers: [
      {
        name: "Dressing",
        required: true,
        min: 1,
        max: 1,
        options: [
          opt("House"),
          opt("Ranch"),
          opt("Caesar"),
          opt("Vinaigrette"),
          opt("On the side"),
        ],
      },
    ],
    omits: ["No croutons", "No cheese", "No onion", "No tomato"],
    adds: [opt("Chicken", 400), opt("Shrimp", 500), opt("Avocado", 150)],
  },
  {
    id: "sandwich",
    label: "Sandwich",
    match: /\bsandwich|melt|panini|wrap|club|blt\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Bread",
        required: false,
        min: 0,
        max: 1,
        options: [opt("White"), opt("Wheat"), opt("Sourdough"), opt("Gluten-free", 150)],
      },
    ],
    omits: ["No mayo", "No onion", "No tomato", "No pickle"],
    adds: [opt("Bacon", 200), opt("Cheese", 100), opt("Avocado", 150)],
  },
  {
    id: "taco",
    label: "Tacos",
    match: /\btaco|burrito|quesadilla|nacho|fajita\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Tortilla",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Corn"), opt("Flour"), opt("Crispy")],
      },
      {
        name: "Heat",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Mild"), opt("Medium"), opt("Hot")],
      },
    ],
    omits: ["No onion", "No cilantro", "No cheese", "No sour cream"],
    adds: [opt("Guacamole", 200), opt("Extra meat", 300), opt("Queso", 150)],
  },
  {
    id: "wings",
    label: "Wings",
    match: /\bwing|tender|fried chicken|nugget\b/i,
    categoryName: "Starters",
    station: "kitchen",
    course: "appetizer",
    modifiers: [
      {
        name: "Sauce",
        required: true,
        min: 1,
        max: 2,
        options: [
          opt("Buffalo"),
          opt("BBQ"),
          opt("Garlic parm"),
          opt("Dry rub"),
          opt("Naked"),
        ],
      },
      {
        name: "Heat",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Mild"), opt("Medium"), opt("Hot"), opt("XXX")],
      },
    ],
    omits: ["No celery", "No ranch", "No blue cheese"],
    adds: [opt("Extra sauce", 100), opt("Fries", 300)],
  },
  {
    id: "seafood",
    label: "Seafood",
    match: /\bfish|salmon|tuna|shrimp|scallop|lobster|crab|cod|halibut\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Cook",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Grilled"), opt("Blackened"), opt("Fried"), opt("Broiled")],
      },
    ],
    omits: ["No butter", "No lemon", "No sauce"],
    adds: [opt("Extra lemon", 0), opt("Side of cocktail", 150)],
  },
  {
    id: "dessert",
    label: "Dessert",
    match: /\bdessert|cake|pie|ice cream|brownie|cookie|tiramisu|cheesecake|pudding\b/i,
    categoryName: "Dessert",
    station: "dessert",
    course: "dessert",
    modifiers: [
      {
        name: "Finish",
        required: false,
        min: 0,
        max: 1,
        options: [opt("As is"), opt("A la mode", 200), opt("Whipped cream")],
      },
    ],
    omits: ["No whipped cream", "No nuts"],
    adds: [opt("Extra scoop", 200), opt("Chocolate sauce", 0)],
  },
  {
    id: "coffee",
    label: "Coffee",
    match: /\bcoffee|espresso|latte|cappuccino|mocha|americano|cold brew\b/i,
    categoryName: "Bar",
    station: "bar",
    course: "drink",
    modifiers: [
      {
        name: "Size",
        required: true,
        min: 1,
        max: 1,
        options: [opt("Small"), opt("Regular", 50), opt("Large", 100)],
      },
      {
        name: "Milk",
        required: false,
        min: 0,
        max: 1,
        options: [
          opt("Whole"),
          opt("Oat", 75),
          opt("Almond", 75),
          opt("Skim"),
        ],
      },
    ],
    omits: ["No foam", "Decaf", "No whip"],
    adds: [opt("Extra shot", 125), opt("Vanilla", 50), opt("Caramel", 50)],
  },
  {
    id: "cocktail",
    label: "Cocktail",
    match: /\bcocktail|martini|old fashioned|negroni|margarita|highball|spritz|sour|smash\b/i,
    categoryName: "Bar",
    station: "bar",
    course: "drink",
    modifiers: [
      {
        name: "Serve",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Up"), opt("Rocks"), opt("Neat")],
      },
      {
        name: "Spirit",
        required: false,
        min: 0,
        max: 1,
        options: [opt("House"), opt("Call", 200), opt("Top shelf", 400)],
      },
    ],
    omits: ["No garnish", "No sugar", "No salt", "Easy ice"],
    adds: [opt("Double", 400), opt("Float", 250), opt("Spicy", 0)],
  },
  {
    id: "beer",
    label: "Beer / wine",
    match: /\bbeer|lager|ipa|stout|pilsner|wine|prosecco|champagne|cider\b/i,
    categoryName: "Bar",
    station: "bar",
    course: "drink",
    modifiers: [
      {
        name: "Pour",
        required: false,
        min: 0,
        max: 1,
        options: [opt("Draft"), opt("Bottle"), opt("Glass"), opt("Bottle 750", 1800)],
      },
    ],
    omits: ["No glass", "No citrus"],
    adds: [opt("Chaser", 200)],
  },
  {
    id: "breakfast",
    label: "Breakfast",
    match: /\begg|omelet|omelette|pancake|waffle|benedict|breakfast|hash\b/i,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [
      {
        name: "Eggs",
        required: false,
        min: 0,
        max: 1,
        options: [
          opt("Scrambled"),
          opt("Fried"),
          opt("Over easy"),
          opt("Poached"),
        ],
      },
    ],
    omits: ["No toast", "No potato", "No meat"],
    adds: [opt("Bacon", 200), opt("Avocado", 150), opt("Extra egg", 150)],
  },
  {
    id: "generic",
    label: "Kitchen plate",
    match: /.*/,
    categoryName: "Mains",
    station: "kitchen",
    course: "entree",
    modifiers: [],
    omits: ["No onion", "No garlic", "No sauce", "No salt"],
    adds: [opt("Side of fries", 300), opt("Extra sauce", 100)],
  },
];

export function matchMenuTemplate(text: string): MenuCategoryTemplate {
  const blob = text.trim() || "item";
  return (
    MENU_CATEGORY_TEMPLATES.find((t) => t.id !== "generic" && t.match.test(blob)) ??
    MENU_CATEGORY_TEMPLATES[MENU_CATEGORY_TEMPLATES.length - 1]!
  );
}

function toGroups(t: MenuCategoryTemplate): NonNullable<MenuItemDraft["modifierGroups"]> {
  return t.modifiers.map((m) => ({
    name: m.name,
    required: Boolean(m.required),
    min: m.min ?? (m.required ? 1 : 0),
    max: m.max ?? Math.max(1, m.options.length),
    options: m.options.map((o) => ({ name: o.name, priceCents: o.priceCents })),
  }));
}

/** Fill missing modifiers / omits / adds from a category template. Never overwrites staff/AI groups. */
export function applyMenuTemplate(
  draft: MenuItemDraft,
  narrative: string,
): MenuItemDraft {
  const hasGroups = Boolean(draft.modifierGroups?.length);
  const hasOmits = Boolean(draft.omitPresets?.length);
  const hasAdds = Boolean(draft.addPresets?.length);
  if (hasGroups && hasOmits && hasAdds && draft.description) return draft;
  const t = matchMenuTemplate(
    `${narrative} ${draft.name} ${draft.categoryName} ${draft.description}`,
  );
  return {
    ...draft,
    description:
      draft.description.trim() ||
      `${draft.name} — ${t.label.toLowerCase()} from the house menu.`,
    categoryName: draft.categoryName || t.categoryName,
    station: draft.station || t.station,
    course: draft.course === "other" ? t.course : draft.course,
    modifierGroups: hasGroups ? draft.modifierGroups : toGroups(t),
    omitPresets: hasOmits ? draft.omitPresets : t.omits,
    addPresets: hasAdds ? draft.addPresets : t.adds,
  };
}
