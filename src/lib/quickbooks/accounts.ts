/** Summex accounts that can post to QuickBooks Online. One chart for every entity. */

export type SummexAccount = {
  code: string;
  name: string;
  qboType: string;
};

export const SUMMEX_ACCOUNTS: SummexAccount[] = [
  { code: "1000", name: "Cash on hand", qboType: "Bank" },
  { code: "1010", name: "Card clearing", qboType: "Other Current Asset" },
  { code: "1040", name: "Other tenders", qboType: "Other Current Asset" },
  { code: "1400", name: "Due from other entity", qboType: "Other Current Asset" },
  { code: "2100", name: "Tips payable", qboType: "Other Current Liability" },
  { code: "2200", name: "Sales tax payable", qboType: "Other Current Liability" },
  { code: "2300", name: "Gift card liability", qboType: "Other Current Liability" },
  { code: "2400", name: "Due to other entity", qboType: "Other Current Liability" },
  { code: "4000", name: "Food sales", qboType: "Income" },
  { code: "4010", name: "Beverage sales", qboType: "Income" },
  { code: "4020", name: "Other sales", qboType: "Income" },
  { code: "4100", name: "Discounts", qboType: "Income" },
  { code: "4110", name: "Comps", qboType: "Income" },
  { code: "6900", name: "Cash over/short", qboType: "Expense" },
];

export function parentCode(code: string): string {
  const cut = code.indexOf(":");
  return cut === -1 ? code : code.slice(0, cut);
}

export function accountTitle(code: string): string {
  const parent = parentCode(code);
  const known = SUMMEX_ACCOUNTS.find((row) => row.code === parent);
  return known?.name ?? code;
}
