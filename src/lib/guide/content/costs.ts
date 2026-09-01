import { p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const COST_TOPICS: GuideTopic[] = [
  topic({
    id: "cost-control",
    chapterId: "costs",
    title: "Cost control loop",
    summary: "Invoices, recipes, variance, POs, and price recs — confirm every write.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["cost", "invoice", "cogs", "variance", "po", "supplier", "par", "recipe"],
    openView: "inventory",
    blocks: [
      why(
        "Purchases, pours, and menu price have to live in one loop or you fly blind. Summex flags and recommends. It does not auto-accuse staff or auto-change prices.",
      ),
      steps(
        "Costs → Invoices: upload an image/PDF or paste text. Extract maps vendor, date, lines.",
        "Map each line to a SKU, cost category, and entity (host / operator). Confirm, then Post receipt + GL.",
        "Recipes: oz/ml/units of each SKU per sale, optional waste factor.",
        "Scan exceptions. Manager records a required response code + note (event, take-home, spillage, count error, investigating, other).",
        "PAR POs: draft from min/max, send email/CSV (API stub available). Receive partial. Match to invoice.",
        "Price recs: Accept opens Menu with the suggested price prefilled. You still Save.",
      ),
      ul(
        "Cost categories: liquor, beer, wine, food, paper, supplies, other.",
        "Vendor-SKU mappings remembered on post.",
        "Open urgent variance blocks auto-reorder unless you override.",
        "Guest operators stay on their entity. Host sees shared supplies.",
        "No API key → guided extract and guided cost narrative.",
      ),
      warn(
        "Copy never says theft to the floor. Investigate pours, waste, events, or counts.",
      ),
      related("cost-invoices", "cost-variance", "cost-ordering", "menu-modifiers", "recipes-prep"),
    ],
  }),
  topic({
    id: "recipes-prep",
    chapterId: "costs",
    title: "Recipes, allergens, floor prep",
    summary: "AI or templates create recipes. Servers see ingredients; bar/kitchen see full prep.",
    roles: ["owner_manager", "server", "kitchen_bar", "vendor_operator"],
    keywords: ["recipe", "prep", "allergen", "garnish", "voice", "upload"],
    openView: "recipes",
    blocks: [
      why(
        "The floor should not guess what’s in a plate. Prep lives with the item; cost lives with the SKU.",
      ),
      steps(
        "Menu or Costs → Recipes → Describe recipe. Type, speak, or upload a card/PDF.",
        "Preview ingredients, steps, allergens, glassware. Map SKUs when the catalog has a match. Confirm — never auto-save.",
        "No API key: templates (margarita, burger, salad) plus the manual yield form still work.",
        "Order: book icon on a tile, or Recipe / ingredients on a selected line. Server sees names + allergens. Bartender/cook sees quantities and steps in large type.",
        "ODS tickets show the same Recipe control for the cook.",
      ),
      ul(
        "Recipes save to the location so every paired tablet can look them up. Go live keeps recipes.",
        "One recipe can link to a menu item (and more ids). Entity-scoped for host vs operators.",
        "Theoretical cost = ingredient qty × latest SKU cost. Feeds price recs (human Save on Menu).",
        "Sales × recipe qty feeds variance when the costs module is on. Voids default off; comps default on (Settings → Scheduled AI ops jobs).",
      ),
      related("cost-control", "cost-variance", "role-server", "role-kitchen-bar", "menu-modifiers"),
    ],
  }),
  topic({
    id: "cost-invoices",
    chapterId: "costs",
    title: "Invoices, GL, spend",
    summary: "Upload, extract, map, post. Spend by vendor, category, entity.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["invoice", "ocr", "gl", "sku", "category"],
    openView: "purchasing",
    blocks: [
      why("A posted invoice is both a receipt into on-hand and an operating cost by category."),
      steps(
        "Upload or paste. Extract (AI when keyed, else guided).",
        "Map Tito’s (or any line) to a catalog SKU — Create SKU from this line if needed.",
        "Set category and entity. Post receipt + GL.",
        "Cost picture and spend tiles show posted amounts.",
      ),
      tip("The next invoice from the same vendor auto-maps remembered line names."),
      related("cost-control", "cost-ordering"),
    ],
  }),
  topic({
    id: "cost-variance",
    chapterId: "costs",
    title: "Recipes, theoretical use, exceptions",
    summary: "Opening + receipts − sales theoretical vs count. Required manager response.",
    roles: ["owner_manager", "kitchen_bar", "vendor_operator"],
    keywords: ["recipe", "theoretical", "variance", "alert", "waste", "count"],
    openView: "inventory_ai",
    blocks: [
      why(
        "If bottles received far exceed pours sold, something is off — event, overpour, count, or worse. The house records a response. Silent dismiss is blocked.",
      ),
      steps(
        "Put a recipe on the drink (e.g. 45ml Tito’s per sale).",
        "Sell from the floor. Post invoices.",
        "Scan last 7 days. Open exceptions show receipts vs theoretical.",
        "Pick a response code and a note. That writes the audit and the AI ops learning log.",
      ),
      p("Counts (full/partial) and waste/breakage logs feed expected on-hand."),
      related("cost-control", "ops-jobs-cost", "ai-ops-learning"),
    ],
  }),
  topic({
    id: "cost-ordering",
    chapterId: "costs",
    title: "Suppliers, POs, price recs",
    summary: "PAR drafts, email/CSV or API stub, receive, human-confirmed price changes.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["supplier", "po", "par", "price", "margin"],
    openView: "purchasing",
    blocks: [
      why("Ordering without PAR and variance checks restocks the leak."),
      ul(
        "Suppliers: contacts, account #, terms, entity scope, email or API stub connector.",
        "Draft PAR PO. Approve if over the $ threshold. Send email/CSV; print/PDF via browser.",
        "Receive remaining (partial OK). Price changes vs last PO raise an info exception.",
        "Price recs from recipe cost vs target % (raise, lower, adjust pour, 86). Accept → Menu save.",
      ),
      tip("Operator B can own liquor suppliers; Operator A food; host paper. Permissions gate create / approve / receive."),
      related("cost-control", "cost-invoices", "menu-modifiers"),
    ],
  }),
];
