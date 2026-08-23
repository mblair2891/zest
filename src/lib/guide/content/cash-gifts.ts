import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const CASH_GIFT_TOPICS: GuideTopic[] = [
  topic({
    id: "cash-discount",
    chapterId: "cash-gifts",
    title: "Cash discount & rounding",
    summary:
      "Pretty menu prices stay on the card; cash is discounted and rounded up so staff never count pennies.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: [
      "cash discount",
      "round up",
      "0.25",
      "pretty price",
      "cash price",
      "card price",
    ],
    openView: "settings",
    blocks: [
      why(
        "A straight 5% off $12 is $11.40 — ugly on a menu and slow in the drawer. Summex keeps the printed / Quantum Payments price clean and computes a cash price that always lands on a coin increment.",
      ),
      p(
        "Menu items store the card amount as source of truth (e.g. $15.00). When the location enables a cash discount, cash tenders use per-line cash prices: discount the printed amount, then round UP to the next $0.25, $0.50, $0.75, or $1.00. If the result is already on the increment, it stays.",
      ),
      ul(
        "$15.00 at 5%, increment $0.25 → cash $14.25 (already on a quarter).",
        "$12.00 at 5%, increment $0.25 → $11.40 rounds up to $11.50.",
        "$7.00 at 5%, increment $0.25 → $6.65 rounds up to $6.75.",
      ),
      steps(
        "Settings → Cash discount. Turn on Offer a cash discount.",
        "Set the percent (typical 5) and Round up to ($0.25 default).",
        "Menu tiles and the check show Card and Cash. Quantum Payments still captures the printed/card total.",
        "Pay → Cash uses the cash total. Pay → Card uses the printed total.",
        "Receipts and the paid screen show both amounts, plus “Cash discount applied” when cash was taken.",
      ),
      warn(
        "The house is responsible for local cash-discount rules. Summex does not change legal copy per state — confirm posting and signage with your counsel.",
      ),
      p(
        "On a host venue, cash prices are the merchandise amounts used when allocating a cash tender to Operator A / Operator B. Card tenders still split on printed merchandise. Period settlement follows the tender that actually hit the check.",
      ),
      related("tenders-tips", "cash-handling", "quantum-payments", "settlement"),
    ],
  }),
  topic({
    id: "cash-handling",
    chapterId: "cash-gifts",
    title: "Cash handling & drawer reports",
    summary: "Float, cash tenders, and cash due to operators on a host floor.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: ["cash", "drawer", "float", "safe", "count", "report"],
    openView: "cash",
    blocks: [
      why(
        "Card is Quantum Payments. Cash still has to be in the right envelope at the end of the period — especially when Operator A sold food and Operator B sold drinks on the same checks.",
      ),
      steps(
        "Open Cash. Confirm opening float for the drawer/station.",
        "Take cash tenders as usual; change due is calculated on the check.",
        "During the shift, Cash shows cash in vs expected. Investigate shorts before close, not after.",
        "On a host venue, period close prints cash due per operator (after host cut on the cash share). Count out those envelopes separately from the host’s card batch.",
        "Use Reports with Cash for a daypart / tender recap.",
      ),
      tip(
        "House Wi-Fi still records cash if the internet is down. You are not blocked from closing a cash table during an ISP outage.",
      ),
      related("tenders-tips", "cash-discount", "settlement", "wifi-offline", "reports"),
    ],
  }),
  topic({
    id: "gift-cards",
    chapterId: "cash-gifts",
    title: "First-party gift cards",
    summary: "Issue, reload, import, freeze, void — Summex ledger only.",
    roles: ["owner_manager", "server"],
    keywords: ["gift", "gift card", "import", "freeze", "void", "ledger"],
    openView: "customers",
    blocks: [
      why(
        "Gift liability belongs to the house, not to a processor or a leftover Toast/Square gift SKU. One ledger means freeze/void actually work.",
      ),
      p(
        "Balances live only in Summex. Redeem at pay never calls an outside gift network. Import from Square, Toast, Clover, Shopify, or a generic CSV is one-way — those systems are not used again.",
      ),
      steps(
        "Open Guests. Issue or reload a card with an amount and optional note.",
        "To migrate: Import CSV (Square / Toast / Clover / Shopify / generic). Review exceptions before you sell on the new codes.",
        "Freeze a card if it is reported lost. Void a card if it was issued in error (manager).",
        "At Pay, choose Gift and enter the code. Partial redeem leaves the remainder on the ledger.",
      ),
      warn(
        "Imported cards are not kept in sync with the old system. After import, treat the old processor gift tool as dead.",
      ),
      related("tenders-tips", "guests", "troubleshooting"),
    ],
  }),
  topic({
    id: "guests",
    chapterId: "cash-gifts",
    title: "Guests & CRM basics",
    summary: "Profiles, notes, allergies, loyalty — when the module is on.",
    roles: ["owner_manager", "server"],
    keywords: ["guest", "crm", "loyalty", "allergy", "profile"],
    openView: "customers",
    blocks: [
      why(
        "A named guest is how allergies, tabs, and gift/loyalty attach to a person instead of a table number that turns.",
      ),
      ul(
        "Profiles store name, contact, notes, and allergy flags the server sees on the check.",
        "Attach a guest to a table or takeout ticket from Order.",
        "Loyalty points (when the package is on) accrue on closed checks.",
        "Gift cards can be stored on the profile so reload does not require retyping a code.",
      ),
      steps(
        "Open Guests → add a profile, or create one from the check.",
        "Record allergies in notes so they print/route with the ticket where configured.",
        "Do not store full card numbers on the profile — Quantum Payments is the card vault, not CRM.",
      ),
      related("gift-cards", "floor-tables", "menu-modifiers"),
    ],
  }),
  topic({
    id: "reports",
    chapterId: "cash-gifts",
    title: "Reports catalog",
    summary: "Sales, payments, staff, kitchen, close, guest, and multi-operator — filtered by type and role.",
    roles: ["owner_manager", "vendor_operator"],
    keywords: ["reports", "sales", "daypart", "tender", "csv", "ai"],
    openView: "reports",
    blocks: [
      why(
        "Settlement answers “what does each operator take home?” Reports answer “how did the house do today?”",
      ),
      ul(
        "Sales: summary, hour/daypart, item mix, channel.",
        "Payments: tender mix (Quantum Payments card), cash discount cost, voids/comps, $35 chargeback splits.",
        "Staff: by server (your own if you are a server), aging checks.",
        "Kitchen/bar: ticket times and 86s.",
        "Close: end of day; cash expected vs counted if tracked.",
        "Guest: waitlist, reservations, kiosk — hidden when the type does not use them.",
        "Host venues: sales by operator, settlement/ledger.",
      ),
      steps(
        "Open Reports (or Home → Reports & AI). Pick a range: shift, today, 7d, 30d.",
        "Vendor operators only see their stall. Servers see their own sales/tips.",
        "Export CSV for the active report.",
        "On a host venue, still use Settle for period close — Reports is the recap, not the payout.",
      ),
      related("ai-insights", "cash-handling", "settlement", "roles-dashboards"),
    ],
  }),
  topic({
    id: "ai-insights",
    chapterId: "cash-gifts",
    title: "AI insights & recommendations",
    summary: "Holistic review of sales, speed, guest flow, tenders, mix, and cost vs ordering.",
    roles: ["owner_manager", "vendor_operator"],
    keywords: ["ai", "insights", "recommendations", "food cost", "performance"],
    openView: "reports",
    blocks: [
      why(
        "A night can look busy and still be unhealthy — voids, slow tickets, a waitlist that was quoted too short, or a mover with no cost data.",
      ),
      steps(
        "Reports → AI insights → Run analysis for the selected range.",
        "Read findings (info / watch / urgent) and cost vs ordering. Gaps are labeled — inventory counts are never invented.",
        "Apply on a recommendation jumps to the setting or report. It does not change prices by itself.",
        "Read summary speaks the recap if you want voiceover.",
      ),
      callout(
        "With or without a key",
        "When an AI key is set, the model writes the same JSON from your metrics. Without a key you get Guided insights — same shape, rule-based.",
      ),
      warn(
        "Public Operators Guide never includes platform-admin portfolio metrics. This is location operations only.",
      ),
      related("reports", "location-settings", "type-food-hall", "roles-dashboards"),
    ],
  }),
];
