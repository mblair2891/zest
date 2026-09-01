import type { EmployeeRole, VenueEntityId } from "@/lib/pos/types";
import type { ReportDef, ReportGroup, ReportId } from "./types";

export const REPORT_CATALOG: ReportDef[] = [
  {
    id: "sales-summary",
    group: "sales",
    title: "Sales summary",
    summary: "Net sales, covers, average check.",
    roles: ["owner", "manager", "accountant", "vendor_operator", "server", "cashier"],
  },
  {
    id: "sales-daypart",
    group: "sales",
    title: "By hour / daypart",
    summary: "When the house rings.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "sales-items",
    group: "sales",
    title: "Category & item mix",
    summary: "What sold, and concentration risk.",
    roles: ["owner", "manager", "accountant", "vendor_operator"],
  },
  {
    id: "sales-channel",
    group: "sales",
    title: "By channel",
    summary: "Dine-in, takeout, kiosk, online.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "payments-tenders",
    group: "payments",
    title: "Tender mix",
    summary: "Card, cash, gift. Quantum Payments is the card.",
    roles: ["owner", "manager", "accountant", "cashier"],
  },
  {
    id: "payments-cash-discount",
    group: "payments",
    title: "Cash discount",
    summary: "Discount cost vs printed/card prices.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "payments-voids",
    group: "payments",
    title: "Voids, comps, refunds",
    summary: "Revenue quality.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "lp-exceptions",
    group: "payments",
    title: "Loss-prevention exceptions",
    summary: "Employee vs house vs same weekday. Flags queue for review — never an accusation.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "payments-chargebacks",
    group: "payments",
    title: "Chargebacks",
    summary: "$35 fee splits on multi-operator checks.",
    venues: ["food_hall", "truck_pod"],
    roles: ["owner", "manager", "accountant", "vendor_operator"],
  },
  {
    id: "gift-liability",
    group: "payments",
    title: "Gift liability by issuer",
    summary: "Outstanding issuer liability on the Summex ledger — not seller merch.",
    roles: ["owner", "manager", "accountant", "vendor_operator"],
  },
  {
    id: "gift-redemptions",
    group: "payments",
    title: "Gift redemptions",
    summary: "Redeemed amounts and issuer → fulfiller remits.",
    roles: ["owner", "manager", "accountant", "vendor_operator"],
  },
  {
    id: "staff-servers",
    group: "staff",
    title: "By server / section",
    summary: "Sales and tips. Server sees only their own.",
    roles: ["owner", "manager", "accountant", "server"],
  },
  {
    id: "staff-payroll",
    group: "staff",
    title: "Payroll export",
    summary: "Hours, OT, declared/CC tips for ADP, Intuit, or CSV. Summex does not process payroll.",
    roles: ["owner", "manager", "accountant", "vendor_operator"],
  },
  {
    id: "staff-aging",
    group: "staff",
    title: "Open / aging checks",
    summary: "Checks still open and how long.",
    roles: ["owner", "manager", "server", "cashier"],
  },
  {
    id: "kitchen-tickets",
    group: "kitchen",
    title: "Ticket times & 86s",
    summary: "Kitchen/bar throughput and unavailable items.",
    roles: ["owner", "manager", "kitchen", "bartender", "vendor_operator"],
  },
  {
    id: "close-eod",
    group: "close",
    title: "End of day",
    summary: "Shift recap; cash expected vs counted if tracked.",
    roles: ["owner", "manager", "accountant", "cashier"],
  },
  {
    id: "close-nightly",
    group: "close",
    title: "Nightly exception pack",
    summary: "Open checks, table/check mismatches, holds, cash-not-closed, late-comp cash. Required before house Z.",
    roles: ["owner", "manager", "accountant", "cashier", "host"],
  },
  {
    id: "ops-jobs",
    group: "close",
    title: "Scheduled AI ops jobs",
    summary: "Hourly / nightly / weekly / pay period / monthly packs. Skipped if no xAI key — never invented.",
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "close-drawers",
    group: "close",
    title: "Drawer & well close",
    summary: "Per-drawer count, well close, over/short, drops, paid-in/out.",
    roles: ["owner", "manager", "accountant", "cashier", "bartender"],
  },
  {
    id: "close-banks",
    group: "close",
    title: "Server banks",
    summary: "Expected vs actual server bank; cash by user on shared drawers.",
    roles: ["owner", "manager", "accountant", "server", "cashier"],
  },
  {
    id: "close-closeouts",
    group: "close",
    title: "Server closeouts",
    summary: "Declared cash, blind over/short, tip-outs, pool in/out, net tips.",
    roles: ["owner", "manager", "accountant", "server", "bartender", "cashier"],
  },
  {
    id: "close-tip-pools",
    group: "close",
    title: "Tip pools",
    summary: "Net tips by person and pool. Exportable with payroll CSV later.",
    roles: ["owner", "manager", "accountant", "server", "bartender", "cashier"],
  },
  {
    id: "guest-waitlist",
    group: "guest",
    title: "Waitlist & reservations",
    summary: "Quoted wait, seated, no-shows.",
    venues: ["restaurant", "food_hall", "bar_lounge", "cafe"],
    roles: ["owner", "manager", "host", "accountant"],
  },
  {
    id: "guest-kiosk",
    group: "guest",
    title: "Kiosk",
    summary: "Kiosk-originated checks.",
    venues: ["restaurant", "food_hall", "qsr", "cafe", "bar_lounge"],
    roles: ["owner", "manager", "accountant"],
  },
  {
    id: "multi-op-sales",
    group: "multi",
    title: "Sales by operator",
    summary: "Host check mix: bar vs food operators.",
    venues: ["food_hall", "truck_pod", "ghost_kitchen"],
    roles: ["owner", "manager", "accountant", "vendor_operator"],
  },
  {
    id: "multi-op-settlement",
    group: "multi",
    title: "Settlement & ledger",
    summary: "Period shares, host cut, chargeback fees.",
    venues: ["food_hall", "truck_pod"],
    roles: ["owner", "manager", "accountant", "vendor_operator"],
  },
];

export const REPORT_GROUP_LABEL: Record<ReportGroup, string> = {
  sales: "Sales & product",
  payments: "Payments",
  staff: "Staff & service",
  kitchen: "Kitchen / bar",
  close: "Close",
  guest: "Guest",
  multi: "Multi-operator",
};

export function reportsFor(
  venue: VenueEntityId | null | undefined,
  role: EmployeeRole | null | undefined,
): ReportDef[] {
  return REPORT_CATALOG.filter((r) => {
    if (r.venues && venue && !r.venues.includes(venue)) return false;
    if (r.roles === "all") return true;
    if (!role) return false;
    return r.roles.includes(role);
  });
}

export function reportById(id: ReportId): ReportDef | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}
