import { p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const CASH_GIFT_TOPICS: GuideTopic[] = [
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
      related("tenders-tips", "settlement", "wifi-offline", "reports"),
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
    title: "Reports",
    summary: "Sales, tender, server, and daypart recap.",
    roles: ["owner_manager"],
    keywords: ["reports", "sales", "daypart", "tender"],
    openView: "reports",
    blocks: [
      why(
        "Settlement answers “what does each operator take home?” Reports answer “how did the house do today?”",
      ),
      steps(
        "Open Reports. Filter daypart, server, tender, and category.",
        "Reconcile cash with the Cash view before you trust a short.",
        "On a host venue, still use Settle for operator payouts — Reports is not a substitute for period close.",
      ),
      related("cash-handling", "settlement", "audit"),
    ],
  }),
];
