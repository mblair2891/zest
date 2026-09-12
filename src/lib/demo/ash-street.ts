/**
 * Isolated demo: Ash Street Coffee — standalone counter.
 * DEMO ONLY. Not a subscriber.
 */
import type { EmployeeRole, MenuCategory, MenuItem } from "@/lib/pos/types";

export const ASH_ORG_ID = "org_ash_street";
export const ASH_LOCATION_ID = "loc_ash_street";
export const ASH_SLUG = "ash-street-coffee";
export const ASH_NAME = "Ash Street Coffee";
export const ASH_OP_ID = "opr_ash_street";

export type AshStaff = {
  id: string;
  pin: string;
  name: string;
  role: EmployeeRole;
  operatorId: string | null;
  color: string;
  title: string;
};

export const ASH_STAFF: readonly AshStaff[] = [
  { id: "emp_ash_cashier", pin: "2222", name: "Cashier", role: "cashier", operatorId: ASH_OP_ID, color: "#1F7A4C", title: "Counter" },
  { id: "emp_ash_cook", pin: "3333", name: "Barista / ODS", role: "kitchen", operatorId: ASH_OP_ID, color: "#A61B1B", title: "Bar ODS" },
  { id: "emp_ash_supervisor", pin: "7777", name: "Supervisor", role: "manager", operatorId: ASH_OP_ID, color: "#5C5C5C", title: "Supervisor" },
  { id: "emp_ash_manager", pin: "9999", name: "Manager", role: "owner", operatorId: ASH_OP_ID, color: "#2C4A6E", title: "Manager" },
];

export const ASH_CATEGORIES: MenuCategory[] = [
  { id: "cat_ash_coffee", name: "Coffee", sort: 0, color: "#7C2D12", station: "bar" },
  { id: "cat_ash_tea", name: "Tea + other", sort: 1, color: "#065F46", station: "bar" },
  { id: "cat_ash_food", name: "Pastry", sort: 2, color: "#9A6700", station: "kitchen" },
];

function item(
  id: string,
  name: string,
  categoryId: string,
  priceCents: number,
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
    vendorId: ASH_OP_ID,
  };
}

export const ASH_MENU: MenuItem[] = [
  item("itm_ash_drip", "Drip coffee", "cat_ash_coffee", 350, "bar", "drink"),
  item("itm_ash_americano", "Americano", "cat_ash_coffee", 400, "bar", "drink"),
  item("itm_ash_latte", "Latte", "cat_ash_coffee", 550, "bar", "drink"),
  item("itm_ash_cap", "Cappuccino", "cat_ash_coffee", 500, "bar", "drink"),
  item("itm_ash_mocha", "Mocha", "cat_ash_coffee", 600, "bar", "drink"),
  item("itm_ash_cold", "Cold brew", "cat_ash_coffee", 500, "bar", "drink"),
  item("itm_ash_tea", "House tea", "cat_ash_tea", 350, "bar", "drink"),
  item("itm_ash_choc", "Hot chocolate", "cat_ash_tea", 450, "bar", "drink"),
  item("itm_ash_croissant", "Butter croissant", "cat_ash_food", 400, "kitchen", "side"),
  item("itm_ash_muffin", "Morning muffin", "cat_ash_food", 375, "kitchen", "side"),
];

export const ASH_DEVICES = [
  { id: "dev_ash_order", label: "Counter order", type: "tablet_pos" as const, fn: "cashier" as const, operatorId: ASH_OP_ID },
  { id: "dev_ash_ods", label: "Bar ODS", type: "kds" as const, fn: "bar_kds" as const, operatorId: ASH_OP_ID },
];
