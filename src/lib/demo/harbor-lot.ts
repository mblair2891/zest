/**
 * Isolated demo: Harbor Lot — host merchant + six trucks.
 * DEMO ONLY. Not a subscriber.
 */
import type { EmployeeRole, MenuCategory, MenuItem } from "@/lib/pos/types";
import type { LocationFloorPlan } from "@/lib/saas/location-catalog";
import { HOST_SCOPE } from "@/lib/access/entity-grants";

export const HARBOR_ORG_ID = "org_harbor_lot";
export const HARBOR_LOCATION_ID = "loc_harbor_lot";
export const HARBOR_SLUG = "harbor-lot";
export const HARBOR_NAME = "Harbor Lot";
export const HARBOR_HOST_OP_ID = "opr_harbor_host";

export const HARBOR_TRUCKS = [
  { id: "opr_harbor_ember", dba: "Ember Tacos", kind: "kitchen" as const },
  { id: "opr_harbor_northline", dba: "Northline Noodles", kind: "kitchen" as const },
  { id: "opr_harbor_tide", dba: "Tide Sliders", kind: "kitchen" as const },
  { id: "opr_harbor_pine", dba: "Pine Box BBQ", kind: "kitchen" as const },
  { id: "opr_harbor_mesa", dba: "Mesa Verde", kind: "kitchen" as const },
  { id: "opr_harbor_hail", dba: "Sweet Hail", kind: "kitchen" as const },
] as const;

export type HarborStaff = {
  id: string;
  pin: string;
  name: string;
  role: EmployeeRole;
  operatorId: string | null;
  color: string;
  title: string;
};

export const HARBOR_STAFF: readonly HarborStaff[] = [
  { id: "emp_harbor_host", pin: "1111", name: "Host", role: "host", operatorId: HARBOR_HOST_OP_ID, color: "#9A6700", title: "Host stand" },
  { id: "emp_harbor_cashier", pin: "2222", name: "Cashier", role: "cashier", operatorId: HARBOR_HOST_OP_ID, color: "#1F7A4C", title: "Lot cashier" },
  { id: "emp_harbor_cook", pin: "3333", name: "Cook", role: "kitchen", operatorId: HARBOR_HOST_OP_ID, color: "#A61B1B", title: "Host ODS" },
  { id: "emp_harbor_runner", pin: "4444", name: "Runner", role: "busser", operatorId: HARBOR_HOST_OP_ID, color: "#4A5568", title: "Window / runner" },
  { id: "emp_harbor_busser", pin: "5555", name: "Busser", role: "busser", operatorId: null, color: "#57534E", title: "Shared seating" },
  { id: "emp_harbor_supervisor", pin: "7777", name: "Supervisor", role: "manager", operatorId: HARBOR_HOST_OP_ID, color: "#5C5C5C", title: "Supervisor" },
  { id: "emp_harbor_manager", pin: "9999", name: "Manager", role: "owner", operatorId: HARBOR_HOST_OP_ID, color: "#2C4A6E", title: "Manager" },
];

const TRUCK_ITEMS: Record<string, Array<[string, string, number]>> = {
  opr_harbor_ember: [
    ["itm_ember_al_pastor", "Al pastor taco", 450],
    ["itm_ember_carnitas", "Carnitas taco", 450],
    ["itm_ember_chicken", "Pollo asado taco", 450],
    ["itm_ember_veg", "Roasted squash taco", 400],
    ["itm_ember_queso", "Queso fundido", 700],
    ["itm_ember_elote", "Elote cup", 500],
    ["itm_ember_chips", "Chips + salsa", 350],
    ["itm_ember_horchata", "Horchata", 400],
  ],
  opr_harbor_northline: [
    ["itm_nl_ramen", "Shoyu ramen", 1400],
    ["itm_nl_tan", "Tantanmen", 1500],
    ["itm_nl_udon", "Curry udon", 1300],
    ["itm_nl_gyoza", "Pork gyoza", 800],
    ["itm_nl_rice", "Garlic fried rice", 900],
    ["itm_nl_bao", "Pork bao", 600],
    ["itm_nl_cuc", "Cucumber salad", 500],
    ["itm_nl_tea", "Jasmine tea", 300],
  ],
  opr_harbor_tide: [
    ["itm_tide_smash", "Smash slider", 700],
    ["itm_tide_cheese", "Cheddar slider", 750],
    ["itm_tide_double", "Double slider", 1100],
    ["itm_tide_crispy", "Crispy chicken slider", 800],
    ["itm_tide_fries", "Lot fries", 450],
    ["itm_tide_rings", "Onion rings", 500],
    ["itm_tide_shake", "Vanilla shake", 600],
    ["itm_tide_soda", "Fountain soda", 300],
  ],
  opr_harbor_pine: [
    ["itm_pine_brisket", "Brisket tray", 1800],
    ["itm_pine_rib", "Ribs tray", 1700],
    ["itm_pine_chop", "Chopped sandwich", 1200],
    ["itm_pine_sausage", "Sausage link", 800],
    ["itm_pine_beans", "Pit beans", 450],
    ["itm_pine_slaw", "Slaw", 350],
    ["itm_pine_pickle", "Pickle spears", 250],
    ["itm_pine_tea", "Sweet tea", 300],
  ],
  opr_harbor_mesa: [
    ["itm_mesa_burrito", "Green chile burrito", 1300],
    ["itm_mesa_bowl", "Adovada bowl", 1400],
    ["itm_mesa_taco", "Street taco trio", 1100],
    ["itm_mesa_nachos", "Mesa nachos", 900],
    ["itm_mesa_tamale", "Red chile tamale", 700],
    ["itm_mesa_rice", "Cilantro rice", 400],
    ["itm_mesa_chips", "Chile chips", 350],
    ["itm_mesa_agua", "Agua fresca", 400],
  ],
  opr_harbor_hail: [
    ["itm_hail_soft", "Soft serve cup", 450],
    ["itm_hail_cone", "Waffle cone", 500],
    ["itm_hail_sundae", "Harbor sundae", 700],
    ["itm_hail_cookie", "Ice cream sandwich", 600],
    ["itm_hail_float", "Root beer float", 650],
    ["itm_hail_churro", "Churro bites", 550],
    ["itm_hail_brownie", "Brownie square", 400],
    ["itm_hail_coffee", "Iced coffee", 400],
  ],
};

export const HARBOR_CATEGORIES: MenuCategory[] = [
  { id: "cat_harbor_host_drinks", name: "Lot drinks", sort: 0, color: "#2C4A6E", station: "bar" },
  { id: "cat_harbor_host_snacks", name: "Lot snacks", sort: 1, color: "#9A6700", station: "kitchen" },
  ...HARBOR_TRUCKS.map((t, i) => ({
    id: `cat_${t.id}`,
    name: t.dba,
    sort: 10 + i,
    color: ["#B45309", "#1D4ED8", "#B91C1C", "#7C2D12", "#047857", "#BE185D"][i]!,
    station: "kitchen" as const,
  })),
];

function item(
  id: string,
  name: string,
  categoryId: string,
  priceCents: number,
  vendorId: string,
  station: MenuItem["station"],
  course: MenuItem["course"],
): MenuItem {
  return {
    id,
    name,
    categoryId,
    priceCents,
    course,
    station,
    description: name,
    modifierGroupIds: [],
    available: true,
    online: true,
    vendorId,
  };
}

export const HARBOR_MENU: MenuItem[] = [
  item("itm_harbor_lager", "Lot lager", "cat_harbor_host_drinks", 700, HARBOR_HOST_OP_ID, "bar", "drink"),
  item("itm_harbor_ipa", "Lot IPA", "cat_harbor_host_drinks", 800, HARBOR_HOST_OP_ID, "bar", "drink"),
  item("itm_harbor_wine", "Canned wine", "cat_harbor_host_drinks", 900, HARBOR_HOST_OP_ID, "bar", "drink"),
  item("itm_harbor_soda", "Fountain soda", "cat_harbor_host_drinks", 300, HARBOR_HOST_OP_ID, "bar", "drink"),
  item("itm_harbor_water", "Bottled water", "cat_harbor_host_drinks", 250, HARBOR_HOST_OP_ID, "bar", "drink"),
  item("itm_harbor_tea", "Iced tea", "cat_harbor_host_drinks", 300, HARBOR_HOST_OP_ID, "bar", "drink"),
  item("itm_harbor_pretzel", "Soft pretzel", "cat_harbor_host_snacks", 500, HARBOR_HOST_OP_ID, "kitchen", "side"),
  item("itm_harbor_nachos", "Lot nachos", "cat_harbor_host_snacks", 800, HARBOR_HOST_OP_ID, "kitchen", "side"),
  ...HARBOR_TRUCKS.flatMap((t) =>
    (TRUCK_ITEMS[t.id] ?? []).map(([id, name, price]) =>
      item(id, name, `cat_${t.id}`, price, t.id, "kitchen", "entree"),
    ),
  ),
];

export function harborFloorPlan(): LocationFloorPlan {
  const tables = [];
  for (let i = 0; i < 8; i += 1) {
    tables.push({
      id: `tbl_harbor_${i + 1}`,
      label: `P${i + 1}`,
      section: "Picnic",
      seats: 4,
      x: 8 + (i % 4) * 18,
      y: 18 + Math.floor(i / 4) * 22,
      w: 14,
      h: 12,
      shape: "rect" as const,
      kind: "table" as const,
    });
  }
  return {
    sections: [{ id: "sec_harbor_picnic", name: "Picnic", color: "sec-1", sort: 0 }],
    tables,
  };
}

export const HARBOR_DEVICES = [
  { id: "dev_harbor_host", label: "Host stand", type: "host_stand" as const, fn: "host_stand" as const, operatorId: HARBOR_HOST_OP_ID },
  { id: "dev_harbor_order", label: "Lot order tablet", type: "tablet_pos" as const, fn: "floor_pos" as const, operatorId: HOST_SCOPE },
  { id: "dev_harbor_ods_host", label: "Host ODS", type: "kds" as const, fn: "kitchen_kds" as const, operatorId: HARBOR_HOST_OP_ID },
  ...HARBOR_TRUCKS.map((t) => ({
    id: `dev_harbor_ods_${t.id.slice(11)}`,
    label: `${t.dba} ODS`,
    type: "kds" as const,
    fn: "kitchen_kds" as const,
    operatorId: t.id,
  })),
];
