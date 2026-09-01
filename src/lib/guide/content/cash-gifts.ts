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
    summary: "One-person drawer, shared drawer, server bank, multi-well bar, host to-go + floor banks.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: [
      "cash",
      "drawer",
      "well",
      "server bank",
      "float",
      "safe",
      "count",
      "report",
      "multi-well",
      "no sale",
    ],
    openView: "cash",
    blocks: [
      why(
        "Card is Quantum Payments. Cash still has to land in the right drawer or bank — especially when the host takes to-go, floor servers carry banks, and each bar well has its own till.",
      ),
      p(
        "Settings → Cash drawers, wells & banks. Location default plus per-station override. Mix models: host = drawer for to-go; floor = server bank; each bar well = shared drawer. Handhelds ringing a well’s tabs use that well’s drawer or a server bank (setting).",
      ),
      ul(
        "One-person drawer: one assigned user on that till.",
        "Shared drawer: several assigned users, one till. One end-of-night count; cash is still reported by user.",
        "Server bank: the server carries a starting bank. No house kick on their cash.",
        "Well drawers + server banks: each well that takes cash has its own drawer (Well-2 never kicks Well-1). Floor servers have banks. A floater bartender is assigned to a well for the shift — cash follows the well.",
        "Cashier / host only: servers cannot tender cash. Send the guest to cashier or host.",
        "Cash disabled: card and gift only on that station or the whole location.",
      ),
      steps(
        "Name drawers (Front, Host, Bar-Well-1, Bar-Well-2, Service-Bar). Bind each to a kick printer or none.",
        "Assign the station: none, a named drawer, or server bank. Register handhelds the same way.",
        "Issue banks at clock-in, first cash sale, or manager issue. Starting amount is per drawer and per server bank.",
        "Take cash as usual — change due is calculated. Gift load with cash hits this station’s drawer or that server’s bank.",
        "Skim/drop when the till is over the house threshold. Paid-in / paid-out use the reason list; manager PIN is optional.",
        "Count: blind or show expected. Over/short warns and can require a note over $X. Shared well: one count. Server bank expected = start + cash sales − refunds − drops + paid-in − paid-out.",
        "Optional: cannot clock out until the bank or assigned drawer is counted. Table transfer: cash stays with the original server or follows the accepting server.",
        "Reports → Drawer & well close, Server banks. That is not clock-out and not PIN login.",
      ),
      tip(
        "House Wi-Fi still records cash if the internet is down. You are not blocked from closing a cash table during an ISP outage. Open on cash sale: always, never, or manager PIN. No-sale: off, manager, or assigned user.",
      ),
      related("tenders-tips", "cash-discount", "settlement", "wifi-offline", "reports", "server-closeout"),
    ],
  }),
  topic({
    id: "server-closeout",
    chapterId: "cash-gifts",
    title: "Server closeout, blind count, mix-based tip-out",
    summary:
      "End of shift on the order device: sales, tenders, blind cash count, declared tips, mix-based tip-out recs. Not PIN login and not clock-out.",
    roles: ["owner_manager", "server", "kitchen_bar", "host_operator"],
    keywords: [
      "closeout",
      "end of shift",
      "blind count",
      "over short",
      "tip out",
      "kitchen tip",
      "bar tip",
      "busser",
      "declared cash",
      "checkout slip",
      "paycheck",
      "card tips",
      "cc tips",
    ],
    openView: "cash",
    blocks: [
      why(
        "PIN signs you into the floor. Clock-out punches time. Closeout is the third thing: this server’s sales, cash, and tip-outs for the shift.",
      ),
      p(
        "On an order-taking device tap Closeout (not Labor, not the house Cash drawer close). House well/drawer close stays a separate manager/closer screen.",
      ),
      steps(
        "Open checks — blocked by default until you close or transfer them. A manager can allow a pending closeout if that toggle is on.",
        "Read-only sales: guests, items, food vs drink, comps, voids.",
        "Tenders: card / cash / gift.",
        "Cash count if you had a server bank or an assigned one-person drawer. Shared well: skip the drawer count unless you are the house closer — still declare cash tips and tip-outs.",
        "Card tips come from payments (manager can adjust). Declare cash tips.",
        "Tip-out recommendations — accept or override with an optional note. Not payroll and not an automatic pay.",
        "Drops, paid-in, paid-out listed.",
        "Confirm with your PIN. Optional checkout slip if the location prints one.",
      ),
      p(
        "Blind count (default on for server bank and one-person drawer): enter cash on hand first. Then the system shows expected and over/short. Expected = starting bank + cash sales − cash refunds − drops + paid-in − paid-out. When card tips cash out at close, that paid-out is included in expected. Over/short over $X requires a note and flags the manager queue.",
      ),
      p(
        "Cash out card tips at closeout: cash due to the server includes card tips, paid out from the drawer or safe. The hours-export file does not add those card tips again — they were already handed over in cash.",
      ),
      p(
        "Card tips on paycheck: closeout shows card tips as informational. Cash due from card tips is $0. Card tips are included on the hours-export file for ADP, Intuit, or CSV. Summex does not run payroll.",
      ),
      p(
        "Only declared cash tips at closeout: only declared cash tips are settled in person. Card tips always go on the hours-export file.",
      ),
      p(
        "Tip-out rates follow sales mix, not a flat percent of all sales. Ticket lines already own food vs drink (bar station or drink course). Two servers with $500 sales do not owe the same kitchen and bar amounts.",
      ),
      ul(
        "Server A, $500, 60% food / 40% drink. Kitchen 3% of food = $9.00. Bar 5% of drink = $10.00. Higher kitchen rec.",
        "Server B, $500, 25% food / 75% drink. Kitchen 3% of food = $3.75. Bar 5% of drink = $18.75. Higher bar rec.",
        "Host can be % of total sales or covers. Busser % of food or total. Map each pool to a house department or an operator entity.",
        "Default basis: % of category sales. Optional: % of tips allocated by the same food/drink mix. Card vs cash tip source does not change the mix unless that setting is on.",
        "The closeout stores both recommended and actual dollars per pool.",
      ),
      p(
        "Settings: require closeout before clock-out (default on for servers), pending closeout with manager, print checkout slip, block open checks, card tips cash-at-close vs paycheck (location default; each employer entity can inherit or override). Manager queue on Cash: closed / pending / over-short; reopen with manager PIN.",
      ),
      p(
        "Reports → Server closeouts: declared cash, blind over/short, recommended vs actual by pool. Export CSV is payroll-ready later — Summex does not process payroll.",
      ),
      warn(
        "Closeout is not clock-out. Labor still punches time. House drawer/well close is still Cash, not this wizard.",
      ),
      related("cash-handling", "tenders-tips", "payroll-export", "reports", "floor-pin-login"),
    ],
  }),
  topic({
    id: "gift-cards",
    chapterId: "cash-gifts",
    title: "First-party gift cards",
    summary: "Issuer liability, redeem settlement, freeze/void/import — Summex ledger only.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: [
      "gift",
      "gift card",
      "issuer",
      "liability",
      "breakage",
      "residual",
      "import",
      "freeze",
      "void",
      "ledger",
      "operator a",
      "house issuer",
    ],
    openView: "customers",
    blocks: [
      why(
        "Gift liability belongs to the issuing operator or the house — not to the drawer that collected cash, and not to a leftover Toast/Square gift SKU. One ledger means freeze/void actually work.",
      ),
      p(
        "Balances live on the Summex server — hashed codes, issuer, and ledger — not only on the drawer that sold the card. The POS cache is a view of that ledger. There is no third-party gift network as system of record.",
      ),
      p(
        "Default issuer follows the selling point: bar sale → that bar operator; host stand sale → the configured entity; explicit house SKU → house. House issuer is optional location mode — you do not create a third legal company.",
      ),
      ul(
        "Sale (cash or card) increases issuer gift liability. It is never booked as the seller’s operating merchandise.",
        "The collecting drawer may hold cash; settlement tracks due-to-issuer remit when seller ≠ issuer.",
        "Guest redeems at any allowed operator. The fulfilling operator gets the merchandise sale. Issuer liability decreases. In-system settlement issuer → fulfiller (no-op if the same entity).",
        "An operator cannot freeze, void, reload, or import another issuer’s cards. Redeem by code is location-wide so any allowed drawer can take the card.",
        "Optional term (e.g. 2 years) is off by default. Many states prohibit expiry — the location setting includes a legal disclaimer.",
        "At term end, host processes residual: operator-issued remaining balance splits per location formula (default 50/50). House-issued remaining balance is retained by the house.",
      ),
      steps(
        "Open Guests. Issue a card: amount, issuer (defaults to selling point), cash or card tender.",
        "Example: Operator B (bar) issues $50 — liability is Operator B. Operator A sells food, Pay → Gift, enter the code — Operator A merch, Operator B → Operator A remit.",
        "Settings → Gift cards: house issuer on/off, host-stand default issuer, term allowed (with disclaimer), operator residual split. Use the dropdowns — no JSON.",
        "Reports → Gift liability / Gift redemptions, or Settle → liability by issuer. Host: Process expired residual when a term is in force.",
        "Freeze if lost. Void if issued in error. Import CSV is one-way from Square / Toast / Clover / Shopify / generic (those systems are not POS card processors).",
      ),
      warn(
        "Turning on a term does not make expiry legal. Confirm state law with counsel — expiry may be illegal in some states. Imported cards are not kept in sync with the old system.",
      ),
      related("tenders-tips", "settlement", "guests", "cash-handling"),
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
        "Close: end of day; drawer/well close; server banks; server closeouts (declared cash, blind over/short, tip-out rec vs actual).",
        "Guest: waitlist, reservations, kiosk — hidden when the type does not use them.",
        "Gift: liability by issuer and redemptions (server ledger).",
        "Host venues: sales by operator, settlement/ledger.",
      ),
      steps(
        "Open Reports (or Home → Reports & AI). Pick a range: shift, today, 7d, 30d.",
        "Vendor operators only see their stall. Servers see their own sales/tips.",
        "Export CSV for the active report.",
        "On a host venue, still use Settle for period close — Reports is the recap, not the payout.",
      ),
      related("ai-insights", "cash-handling", "server-closeout", "settlement", "roles-dashboards"),
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
        "Reports → AI analysis. Pick shift / today / 7d / 30d or custom dates. Location is this house; entity is the operator filter (vendors see their slice only).",
        "Read findings (info / watch / urgent) and cost vs ordering. Gaps are labeled — inventory counts are never invented.",
        "Apply on a recommendation jumps to the setting or report. It does not change prices by itself.",
        "Read summary speaks the recap if you want voiceover.",
      ),
      callout(
        "With or without a key",
        "When an AI key is set, the model writes the same JSON from your metrics. Without a key you get Guided insights — same shape, rule-based.",
      ),
      p(
        "Owner/manager: Settings → AI ops reports for daily or weekly. Delivery is in-app (Reports inbox) plus email if configured, otherwise the communications outbox. Owner, manager, and accountant can run analysis; vendor operators see their own slice.",
      ),
      warn(
        "Recommendations never auto-change menu prices. Public Operators Guide never includes platform-admin portfolio metrics.",
      ),
      related("reports", "location-settings", "type-food-hall", "roles-dashboards"),
    ],
  }),
];
