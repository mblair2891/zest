import type { FloorSection, MenuCategory, MenuItem, ModifierGroup, Table, TableKind } from "@/lib/pos/types";
import type { ItemRecipe } from "@/lib/costs/types";

export type FloorPlanTable = {
  id: string;
  label: string;
  section: string;
  seats: number;
  x: number;
  y: number;
  w: number;
  h: number;
  shape: Table["shape"];
  kind?: TableKind;
};

export type LocationFloorPlan = {
  tables: FloorPlanTable[];
  sections: FloorSection[];
};

export type LocationMenuCatalog = {
  categories: MenuCategory[];
  items: MenuItem[];
  modifiers: ModifierGroup[];
};

function asObj(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const SHAPES = new Set(["rect", "round", "bar", "booth", "other"]);
const KINDS = new Set(["table", "booth", "barstool", "other"]);

export function parseFloorPlan(raw: unknown): LocationFloorPlan | undefined {
  const o = asObj(raw);
  if (!o) return undefined;
  const tablesRaw = Array.isArray(o.tables) ? o.tables : [];
  const sectionsRaw = Array.isArray(o.sections) ? o.sections : [];
  const tables: FloorPlanTable[] = [];
  for (const t of tablesRaw) {
    const r = asObj(t);
    if (!r) continue;
    const id = str(r.id).slice(0, 80);
    if (!id) continue;
    const shape = SHAPES.has(str(r.shape)) ? (str(r.shape) as FloorPlanTable["shape"]) : "round";
    const kind = KINDS.has(str(r.kind)) ? (str(r.kind) as TableKind) : undefined;
    tables.push({
      id,
      label: str(r.label, id).slice(0, 40),
      section: str(r.section, "Dining").slice(0, 40),
      seats: Math.max(1, Math.round(num(r.seats, 4))),
      x: Math.min(90, Math.max(0, num(r.x))),
      y: Math.min(90, Math.max(0, num(r.y))),
      w: Math.min(40, Math.max(6, num(r.w, 12))),
      h: Math.min(40, Math.max(6, num(r.h, 12))),
      shape,
      kind,
    });
  }
  const sections: FloorSection[] = [];
  for (const s of sectionsRaw) {
    const r = asObj(s);
    if (!r) continue;
    const id = str(r.id).slice(0, 80);
    if (!id) continue;
    sections.push({
      id,
      name: str(r.name, id).slice(0, 40),
      color: str(r.color, "sec-1").slice(0, 20),
      sort: Math.round(num(r.sort)),
    });
  }
  if (!tables.length && !sections.length) return undefined;
  return { tables, sections };
}

export function floorPlanFromPos(tables: Table[], sections: FloorSection[]): LocationFloorPlan {
  return {
    tables: tables
      .filter((t) => !t.mergedIntoId)
      .map((t) => ({
        id: t.id,
        label: t.label,
        section: t.section,
        seats: t.seats,
        x: t.x,
        y: t.y,
        w: t.w,
        h: t.h,
        shape: t.shape,
        kind: t.kind,
      })),
    sections: sections.map((s) => ({ ...s })),
  };
}

export function tablesFromFloorPlan(plan: LocationFloorPlan): Table[] {
  return plan.tables.map((t) => ({
    id: t.id,
    label: t.label,
    section: t.section,
    seats: t.seats,
    x: t.x,
    y: t.y,
    w: t.w,
    h: t.h,
    shape: t.shape,
    kind: t.kind,
    status: "empty",
  }));
}

export function parseMenuCatalog(raw: unknown): LocationMenuCatalog | undefined {
  const o = asObj(raw);
  if (!o) return undefined;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  const catsRaw = Array.isArray(o.categories) ? o.categories : [];
  const modsRaw = Array.isArray(o.modifiers) ? o.modifiers : [];
  const categories: MenuCategory[] = [];
  for (const c of catsRaw) {
    const r = asObj(c);
    if (!r) continue;
    const id = str(r.id).slice(0, 80);
    if (!id) continue;
    categories.push({
      id,
      name: str(r.name, "Category").slice(0, 80),
      sort: Math.round(num(r.sort)),
      color: str(r.color, "#2C4A6E").slice(0, 20),
      station: r.station === "bar" || r.station === "expo" || r.station === "dessert" ? r.station : "kitchen",
    });
  }
  const items: MenuItem[] = [];
  for (const it of itemsRaw) {
    const r = asObj(it);
    if (!r) continue;
    const id = str(r.id).slice(0, 80);
    if (!id) continue;
    items.push({
      id,
      name: str(r.name, "Item").slice(0, 120),
      categoryId: str(r.categoryId).slice(0, 80),
      priceCents: Math.max(0, Math.round(num(r.priceCents))),
      happyHourPriceCents:
        r.happyHourPriceCents == null ? undefined : Math.max(0, Math.round(num(r.happyHourPriceCents))),
      course: (str(r.course, "entree") as MenuItem["course"]) || "entree",
      station: r.station === "bar" || r.station === "expo" || r.station === "dessert" ? r.station : "kitchen",
      description: str(r.description).slice(0, 400) || undefined,
      modifierGroupIds: Array.isArray(r.modifierGroupIds)
        ? r.modifierGroupIds.filter((x): x is string => typeof x === "string").slice(0, 24)
        : [],
      available: r.available !== false,
      prepMinutes: r.prepMinutes == null ? undefined : Math.max(0, Math.round(num(r.prepMinutes))),
      taxExempt: Boolean(r.taxExempt),
      trackStock: Boolean(r.trackStock),
      stock: r.stock == null ? undefined : Math.max(0, num(r.stock)),
      online: r.online !== false,
      vendorId: str(r.vendorId).slice(0, 80) || undefined,
      allergens: Array.isArray(r.allergens)
        ? r.allergens.filter((x): x is string => typeof x === "string").slice(0, 20)
        : undefined,
    });
  }
  const modifiers: ModifierGroup[] = [];
  for (const m of modsRaw) {
    const r = asObj(m);
    if (!r) continue;
    const id = str(r.id).slice(0, 80);
    if (!id) continue;
    const options = Array.isArray(r.options)
      ? r.options
          .map((op) => asObj(op))
          .filter((op): op is Record<string, unknown> => Boolean(op))
          .map((op) => ({
            id: str(op.id).slice(0, 80),
            name: str(op.name).slice(0, 80),
            priceCents: Math.round(num(op.priceCents)),
            default: Boolean(op.default),
          }))
          .filter((op) => op.id)
      : [];
    modifiers.push({
      id,
      name: str(r.name, "Modifiers").slice(0, 80),
      required: Boolean(r.required),
      min: Math.max(0, Math.round(num(r.min))),
      max: Math.max(0, Math.round(num(r.max, 1))),
      options,
    });
  }
  if (!items.length && !categories.length) return undefined;
  return { categories, items, modifiers };
}

export function parseRecipes(raw: unknown): ItemRecipe[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const out: ItemRecipe[] = [];
  for (const row of raw.slice(0, 400)) {
    const r = asObj(row);
    if (!r) continue;
    const id = str(r.id).slice(0, 80);
    if (!id) continue;
    const menuItemIds = Array.isArray(r.menuItemIds)
      ? r.menuItemIds.filter((x): x is string => typeof x === "string").slice(0, 40)
      : [];
    const menuItemId = str(r.menuItemId) || menuItemIds[0] || "";
    out.push({
      id,
      menuItemId,
      menuItemIds: menuItemIds.length ? menuItemIds : menuItemId ? [menuItemId] : [],
      name: str(r.name, "Recipe").slice(0, 120),
      entityId: str(r.entityId).slice(0, 80),
      station: r.station === "bar" || r.station === "expo" || r.station === "dessert" ? r.station : "kitchen",
      wasteFactor: num(r.wasteFactor),
      yieldQty: num(r.yieldQty, 1) || 1,
      yieldUnit: str(r.yieldUnit, "portion").slice(0, 24),
      glassware: str(r.glassware).slice(0, 40) || undefined,
      garnish: str(r.garnish).slice(0, 80) || undefined,
      allergens: Array.isArray(r.allergens)
        ? r.allergens.filter((x): x is string => typeof x === "string").slice(0, 20)
        : [],
      dietary: Array.isArray(r.dietary)
        ? r.dietary.filter((x): x is string => typeof x === "string").slice(0, 20)
        : [],
      notes: str(r.notes).slice(0, 800) || undefined,
      steps: Array.isArray(r.steps)
        ? r.steps
            .map((st) => (typeof st === "string" ? { text: st } : asObj(st)))
            .filter((st): st is Record<string, unknown> => Boolean(st))
            .map((st) => ({
              text: str(st.text).slice(0, 400),
              seconds: st.seconds == null ? undefined : Math.max(0, Math.round(num(st.seconds))),
            }))
            .filter((st) => st.text)
        : [],
      lines: Array.isArray(r.lines)
        ? r.lines
            .map((ln) => asObj(ln))
            .filter((ln): ln is Record<string, unknown> => Boolean(ln))
            .map((ln) => ({
              name: str(ln.name).slice(0, 80),
              skuId: str(ln.skuId).slice(0, 80) || undefined,
              qty: num(ln.qty),
              unit: str(ln.unit, "each").slice(0, 24),
            }))
        : [],
    });
  }
  return out.length ? out : undefined;
}
