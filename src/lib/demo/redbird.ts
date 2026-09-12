/**
 * Isolated demo: Redbird Chicken — standalone drive-through.
 * DEMO ONLY. Not a subscriber.
 */
import type { EmployeeRole, MenuCategory, MenuItem } from "@/lib/pos/types";

export const REDBIRD_ORG_ID = "org_redbird";
export const REDBIRD_LOCATION_ID = "loc_redbird";
export const REDBIRD_SLUG = "redbird-chicken";
export const REDBIRD_NAME = "Redbird Chicken";
export const REDBIRD_OP_ID = "opr_redbird";

export type RedbirdStaff = {
  id: string;
  pin: string;
  name: string;
  role: EmployeeRole;
  operatorId: string | null;
  color: string;
  title: string;
};

export const REDBIRD_STAFF: readonly RedbirdStaff[] = [
  { id: "emp_redbird_window", pin: "1111", name: "Window", role: "host", operatorId: REDBIRD_OP_ID, color: "#9A6700", title: "Window" },
  { id: "emp_redbird_order", pin: "2222", name: "Order-taker", role: "cashier", operatorId: REDBIRD_OP_ID, color: "#1F7A4C", title: "Order lane" },
  { id: "emp_redbird_cook", pin: "3333", name: "Cook", role: "kitchen", operatorId: REDBIRD_OP_ID, color: "#A61B1B", title: "Kitchen ODS" },
  { id: "emp_redbird_runner", pin: "4444", name: "Window runner", role: "busser", operatorId: REDBIRD_OP_ID, color: "#4A5568", title: "Bump to window" },
  { id: "emp_redbird_supervisor", pin: "7777", name: "Supervisor", role: "manager", operatorId: REDBIRD_OP_ID, color: "#5C5C5C", title: "Supervisor" },
  { id: "emp_redbird_manager", pin: "9999", name: "Manager", role: "owner", operatorId: REDBIRD_OP_ID, color: "#2C4A6E", title: "Manager" },
];

export const REDBIRD_CATEGORIES: MenuCategory[] = [
  { id: "cat_rb_chicken", name: "Chicken", sort: 0, color: "#B91C1C", station: "kitchen" },
  { id: "cat_rb_sides", name: "Sides", sort: 1, color: "#9A6700", station: "kitchen" },
  { id: "cat_rb_drinks", name: "Drinks", sort: 2, color: "#1E3A5F", station: "bar" },
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
    vendorId: REDBIRD_OP_ID,
  };
}

export const REDBIRD_MENU: MenuItem[] = [
  item("itm_rb_2pc", "2-piece meal", "cat_rb_chicken", 799, "kitchen", "entree"),
  item("itm_rb_3pc", "3-piece meal", "cat_rb_chicken", 999, "kitchen", "entree"),
  item("itm_rb_tenders", "Tender box", "cat_rb_chicken", 899, "kitchen", "entree"),
  item("itm_rb_sandwich", "Crispy sandwich", "cat_rb_chicken", 749, "kitchen", "entree"),
  item("itm_rb_spicy", "Spicy sandwich", "cat_rb_chicken", 799, "kitchen", "entree"),
  item("itm_rb_nuggets", "Nuggets 8-pc", "cat_rb_chicken", 599, "kitchen", "entree"),
  item("itm_rb_fries", "Fries", "cat_rb_sides", 299, "kitchen", "side"),
  item("itm_rb_slaw", "Slaw", "cat_rb_sides", 249, "kitchen", "side"),
  item("itm_rb_mac", "Mac cup", "cat_rb_sides", 349, "kitchen", "side"),
  item("itm_rb_soda", "Fountain drink", "cat_rb_drinks", 249, "bar", "drink"),
];

export const REDBIRD_DEVICES = [
  { id: "dev_rb_order", label: "Order-taker", type: "tablet_pos" as const, fn: "floor_pos" as const, operatorId: REDBIRD_OP_ID },
  { id: "dev_rb_window", label: "Window", type: "host_stand" as const, fn: "host_stand" as const, operatorId: REDBIRD_OP_ID },
  { id: "dev_rb_ods", label: "Kitchen ODS", type: "kds" as const, fn: "kitchen_kds" as const, operatorId: REDBIRD_OP_ID },
];
