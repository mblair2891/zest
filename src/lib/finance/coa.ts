import type { Account } from "./types.ts";

/** Restaurant chart of accounts. One copy per selling entity. */
export function chartTemplate(): Account[] {
  return [
    { code: "1000", name: "Cash on hand", type: "asset", group: "cash" },
    { code: "1010", name: "Card clearing", type: "asset", group: "cash" },
    { code: "1020", name: "Bank", type: "asset", group: "cash" },
    { code: "1030", name: "Safe", type: "asset", group: "cash" },
    { code: "1040", name: "Other tenders", type: "asset", group: "cash" },
    { code: "1200", name: "Food inventory", type: "asset", group: "inventory" },
    { code: "1210", name: "Beverage inventory", type: "asset", group: "inventory" },
    { code: "1220", name: "Supplies inventory", type: "asset", group: "inventory" },
    { code: "1250", name: "Received not invoiced", type: "asset", group: "inventory" },
    { code: "1400", name: "Due from peers", type: "asset", group: "clearing" },
    { code: "2000", name: "Accounts payable", type: "liability", group: "ap" },
    { code: "2100", name: "Tips payable", type: "liability", group: "labor" },
    { code: "2110", name: "Wages payable", type: "liability", group: "labor" },
    { code: "2200", name: "Sales tax payable", type: "liability", group: "tax" },
    { code: "2300", name: "Gift card liability", type: "liability", group: "gift" },
    { code: "2400", name: "Revenue share payable", type: "liability", group: "share" },
    { code: "2500", name: "Accrued occupancy", type: "liability", group: "occupancy" },
    { code: "3000", name: "Owner equity", type: "equity", group: "equity" },
    { code: "4000", name: "Food sales", type: "income", group: "sales" },
    { code: "4010", name: "Beverage sales", type: "income", group: "sales" },
    { code: "4100", name: "Discounts", type: "income", group: "sales" },
    { code: "4110", name: "Comps", type: "income", group: "sales" },
    { code: "4200", name: "Revenue share income", type: "income", group: "share" },
    { code: "5000", name: "Food COGS", type: "expense", group: "cogs" },
    { code: "5010", name: "Beverage COGS", type: "expense", group: "cogs" },
    { code: "5050", name: "Waste", type: "expense", group: "cogs" },
    { code: "5100", name: "Inventory variance", type: "expense", group: "cogs" },
    { code: "6000", name: "Labor", type: "expense", group: "labor" },
    { code: "6100", name: "Occupancy", type: "expense", group: "occupancy" },
    { code: "6200", name: "Controllable operating", type: "expense", group: "operating" },
    { code: "6300", name: "Revenue share expense", type: "expense", group: "share" },
    { code: "6900", name: "Cash over/short", type: "expense", group: "cash" },
  ];
}

const DEBIT_NORMAL = new Set([
  "1000",
  "1010",
  "1020",
  "1030",
  "1040",
  "1200",
  "1210",
  "1220",
  "1250",
  "1400",
  "4100",
  "4110",
  "5000",
  "5010",
  "5050",
  "5100",
  "6000",
  "6100",
  "6200",
  "6300",
  "6900",
]);

export function debitNormal(code: string): boolean {
  return DEBIT_NORMAL.has(code);
}

export function inventoryAccount(category: "food" | "bev" | "supplies" | "other"): string {
  if (category === "food") return "1200";
  if (category === "bev") return "1210";
  return "1220";
}

export function cogsAccount(kind: "food" | "bev"): string {
  return kind === "food" ? "5000" : "5010";
}
