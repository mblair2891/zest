import { related, steps, tip, topic, ul, why } from "./helpers";
import type { GuideTopic } from "../types";

export const OWNER_OPS_TOPICS: GuideTopic[] = [
  topic({
    id: "owner-ops",
    chapterId: "finance",
    title: "Owner ops",
    summary: "The selling entity’s daily home: sales, prime cost, labor, and open invoices.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["owner", "home", "prime", "today", "week", "entity"],
    openView: "hq",
    blocks: [
      why(
        "Each selling entity opens on its own numbers for today and this week. A peer sees that entity only.",
      ),
      steps(
        "Home shows net sales, cash versus card, comps, prime cost, labor, food cost, and beverage cost.",
        "Checks, invoices, the schedule, and AvT exceptions are one tap from that home.",
        "A location owner can switch the entity. The cards stay on the entity that is selected.",
      ),
      ul(
        "Invoice upload and recipes stay where they are.",
        "Summex does not process payroll. Hours and tips still export.",
        "A price test does not change the menu price.",
      ),
      related("owner-ops-cost", "owner-ops-labor", "owner-ops-cash", "owner-ops-ap", "owner-ops-menu", "ops-finance"),
    ],
  }),
  topic({
    id: "owner-ops-cost",
    chapterId: "finance",
    title: "Owner ops food and beverage cost",
    summary: "Theoretical use from recipes times items sold, against invoices, counts, and waste.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["avt", "theoretical", "count", "waste", "exception"],
    openView: "hq",
    blocks: [
      why("The home lists only the items that are off: name, expected, actual, and the dollar gap."),
      steps(
        "Sell from a recipe and the theoretical ounces move.",
        "A received invoice, a count, and a waste log make the actual side.",
        "Mark the row event, take-home, count error, or investigate. That is a response, not an accusation.",
        "Weekly count is optional. On a phone, enter the on-hand count and save. It posts that entity’s count.",
      ),
      tip("A balanced item stays off the list."),
      related("owner-ops", "ops-finance-avt", "recipes-prep", "cost-variance"),
    ],
  }),
  topic({
    id: "owner-ops-labor",
    chapterId: "finance",
    title: "Owner ops labor",
    summary: "Live labor dollars and percent versus sales. A draft schedule for next week.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["labor", "schedule", "draft", "clock", "payroll"],
    openView: "hq",
    blocks: [
      why("Labor on the home is clocked minutes times the accrual rate. The PIN clock remains the source of hours."),
      steps(
        "Today’s labor percent is those dollars divided by today’s net sales.",
        "Next week’s draft uses the last four of that weekday, plus an event on that date.",
        "Edit the heads. Saving the draft does not publish a shift and does not write a punch.",
        "Cut-staff recommendations stay on the labor card.",
      ),
      ul("Payroll stays an export to ADP, Intuit, or CSV. Summex does not process payroll."),
      related("owner-ops", "entity-schedule-payroll", "payroll-export", "ops-finance-labor"),
    ],
  }),
  topic({
    id: "owner-ops-cash",
    chapterId: "finance",
    title: "Owner ops cash",
    summary: "System cash versus the blind closeout count, over or short, and the deposit to record.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["cash", "closeout", "blind", "deposit", "over", "short"],
    openView: "hq",
    blocks: [
      why("End of night uses the closeout that is already on the drawer. The home does not start a second count."),
      steps(
        "System cash is what the closeout expected. Before anyone counts, it is the entity’s cash tender.",
        "The blind count is the counted cash. Over or short is the count minus system cash.",
        "The deposit to record is the drop from that closeout. It does not send a bank transfer.",
      ),
      related("owner-ops", "server-closeout", "cash-handling"),
    ],
  }),
  topic({
    id: "owner-ops-ap",
    chapterId: "finance",
    title: "Owner ops invoices",
    summary: "Open invoices from capture, what is due this week, and a price that went up.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["invoice", "vendor", "due", "paid", "price"],
    openView: "purchasing",
    blocks: [
      why("Capture still files the invoice. The home shows the vendor, the open balance, and a due date this week."),
      steps(
        "Mark paid when the bill is settled. That does not print a check and does not send a bank payment.",
        "A line priced above the last invoice is flagged. The price on the menu does not move.",
      ),
      related("owner-ops", "cost-invoices", "ops-finance-ap"),
    ],
  }),
  topic({
    id: "owner-ops-menu",
    chapterId: "finance",
    title: "Owner ops menu",
    summary: "Stars, plowhorses, puzzles, and dogs from recipe cost versus the cash price.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["menu", "star", "plowhorse", "puzzle", "dog", "margin"],
    openView: "hq",
    blocks: [
      why("Contribution is the cash price minus the recipe cost. Popularity is how many sold against the rest of this entity’s menu."),
      steps(
        "Star: popular and strong contribution. Plowhorse: popular and thin. Puzzle: less often and strong. Dog: less often and thin.",
        "Each row can suggest a price test. The cash price stays until someone edits the menu.",
      ),
      related("owner-ops", "ops-finance-menu", "menu-modifiers"),
    ],
  }),
];
