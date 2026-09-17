import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const CASH_GIFT_TOPICS: GuideTopic[] = [
  topic({
    id: "cash-discount",
    chapterId: "cash-gifts",
    title: "Cash discount & rounding",
    summary:
      "You type the cash (till) price. Card is marked up by the guest card rate, then rounded up.",
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
        "The operator types what the till should take in cash. Card is never “that number minus a percent.” Card is cash marked up by the guest card rate, then rounded up so the guest amount lands on a coin increment.",
      ),
      p(
        "The guest card rate is Summex’s charge (typical 5.00%). It is not Finix’s 0.25%+$0.10 — that cost is internal. Platform Admin sets the default for new quotes and new venues. Each location overrides it (4.00%, 5.00%, or another). Host sets the rate for tenants on that floor. Menu items store the cash (till) amount. Card = cash × (1 + rate/100), then rounded UP to $0.25, $0.50, $0.75, or $1.00. If cash discount is off, cash and card are the same price.",
      ),
      ul(
        "$18.00 cash at 5%, increment $1.00 → card $19.00.",
        "$12.00 cash at 5%, increment $0.25 → $12.60 rounds up to $12.75 card.",
        "$15.00 cash at 5%, increment $0.25 → card $15.75 (already on a quarter).",
        "Never take card-minus-percent as the till amount.",
      ),
      steps(
        "Platform → Settings → Payments: Default guest card rate for new quotes and venues.",
        "Location settings → Guest card rate & cash discount. Turn on Offer a cash discount. Set this location’s % and Round up to. Confirm on save — card prices recompute from each item’s cash field. Publish so stations pick it up.",
        "Menu add/edit: Cash price (printed / till). Card price is live and read-only. List row: $18.00 cash · $19.00 card when they differ.",
        "Pay → Cash charges cash (no second round). Pay → Card charges card. The check can show both: Cash $18.00 · Card $19.00.",
        "Splits and multi-entity lines compute per line from that line’s cash, then tender.",
      ),
      warn(
        "The house is responsible for local cash-discount rules. Summex does not change legal copy per state — confirm posting and signage with your counsel.",
      ),
      p(
        "On a host venue, cash tenders split on cash merchandise; card tenders split on the computed card merchandise. Period settlement follows the tender that actually hit the check.",
      ),
      related("tenders-tips", "cash-handling", "quantum-payments", "settlement", "receipts-by-vendor"),
    ],
  }),
  topic({
    id: "cash-handling",
    chapterId: "cash-gifts",
    title: "Cash handling & drawer reports",
    summary: "Each PIN: house drawer, personal bank, or none. Possession before cash. Blind counts. No JSON.",
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
      "till transfer",
      "transfer cash",
    ],
    openView: "cash",
    blocks: [
      why(
        "Card is Quantum Payments. Physical bills belong to whoever took the tender — a house drawer or a personal bank. Kitchen PINs are never assigned cash.",
      ),
      p(
        "Settings → Cash drawers, wells & banks. Real controls, not a JSON blob. Each staff row has exactly one assignment: house drawer, personal bank, or none. Role defaults (bartender / cashier / host → house drawer; server → personal bank; kitchen / busser → none). Override a person on Staff. Kitchen stays none.",
      ),
      ul(
        "None: no cash tender, no drawer kick, no cash closeout. Clock only (plus ODS if the device allows).",
        "Venue Payment methods → Cash off: no possession required for anyone at that venue. Take drawer is hidden. Banks unused. Closeout still lists sales and tips without a cash count.",
        "House drawer: exclusive (one PIN pops that drawer), shared (multiple PINs, one float, every tender stamped with who), or multi-drawer (one person may own more than one well). Taking possession binds staff ↔ drawer. Map each drawer to a station/printer. A device role change does not invent a drawer — a manager assigns it.",
        "Personal bank: opening float (venue default, often $0). Cash on that server’s checks goes to their bank unless All cash to house till is on. Optional: server may break large bills on a house drawer (loan / change slip).",
        "Possession: cannot tender cash until accepted. Custodian enters declared opening cash — true blind, no expected. Optional manager witness PIN. Handoff A→B: A counts out; B blind-counts in or accepts A’s counted-out total (venue toggle).",
        "Blind count (open / handoff / close): denominations without expected. Then reveal declared vs expected vs over/short. One recount before lock. Over/short over $X needs manager approve. Cannot clock out while still in possession unless manager override.",
        "Mid-shift: paid-out with reason; skim to safe decreases expected; No sale opens the bound receipt-printer drawer (never kitchen Star). Change/loan between bank and house drawer hits both ledgers.",
        "Peer / multi-entity: physical bills go to whoever took the tender. Entity split stays on the ledger (owned_lines). Do not sort cash by vendor at the table. Labor and tip-out recs still use owned_lines.",
      ),
      steps(
        "Set role defaults and house drawer mode. Name drawers and bind each to a kick printer.",
        "Map each cash drawer to a station. On Staff, override a person if needed (not kitchen).",
        "On the order tablet after PIN: Take drawer or Open bank. Declare opening cash. Accept possession.",
        "Tender cash. Shared well: two bartender PINs kick the same drawer; closeout still lists both.",
        "Skim/drop, paid-out, till transfer (loan) as needed.",
        "Closeout on the short menu. Hand off if someone takes the till mid-shift.",
      ),
      p(
        "Settings → Cash drawers: Card tips cash at close vs paycheck. Location default; each employer entity can inherit or override on Labor / HR.",
      ),
      callout(
        "cash_at_close",
        "Closeout cash due to the server includes card tips, paid out from the drawer or safe. The payroll export does not add those card tips again. Blind expected includes that paid-out.",
      ),
      callout(
        "paycheck",
        "Closeout shows card tips as informational. Cash due from card tips is $0. Card tips are included on the hours-export file. Summex does not run payroll.",
      ),
      callout(
        "cash_tips_only_at_close",
        "Only declared cash tips are settled in person. Card tips always export to payroll.",
      ),
      tip(
        "House Wi-Fi still records cash if the internet is down. You are not blocked from closing a cash table during an ISP outage. Open on cash sale: always, never, or manager PIN.",
      ),
      related("tenders-tips", "cash-discount", "settlement", "wifi-offline", "reports", "server-closeout", "printers-kds", "tip-pooling", "loss-prevention", "no-sale"),
    ],
  }),
  topic({
    id: "no-sale",
    chapterId: "cash-gifts",
    title: "No sale / open drawer",
    summary:
      "Order and host: open the cash drawer with no check. Bound receipt printer only. Kitchen Star never kicks.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: ["no sale", "drawer kick", "open drawer", "change", "receipt printer"],
    openView: "floor",
    blocks: [
      why(
        "Making change or clearing a stuck drawer must not invent a $0 check and must not hide inside Pay.",
      ),
      ul(
        "On a bound order or host terminal (Devices → Stations that may print and kick), No sale is on the short menu, the floor, and the pad when no check is open — not on Pay. Unbound handhelds do not show No sale.",
        "It sends a drawer kick on the bound Receipt printer (ESC/POS pulse). Kitchen Star never kicks.",
        "If this station has no receipt printer with a drawer wired: “No drawer on this station.”",
        "Every kick writes an audit row: who, station, time, reason (Change, Mistake, Manager). Never a silent kick.",
        "Settings → Cash: No sale allowed for Server / Bartender / Host / Manager. Default bartender + manager; servers optional. A signed-in role below that list needs a manager PIN.",
        "Print no-sale slip is off by default. When on, a short “NO SALE — not a receipt” slip prints on the receipt printer. Never a guest check.",
      ),
      steps(
        "PIN in on order or host. No check open.",
        "Tap No sale. Pick a reason. Confirm. The receipt drawer opens.",
        "If your role is not on the allowed list, enter a manager PIN first.",
        "If you see “No drawer on this station,” bind a Receipt printer with cash drawer kick to this order/host station.",
      ),
      warn(
        "No sale does not create a check and does not print a guest check unless Print no-sale slip is on.",
      ),
      related("cash-handling", "printers-kds", "device-roles", "loss-prevention", "server-closeout"),
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
        "On the order station tap Closeout from the short menu (not Labor, not PIN login). Take drawer / Hand off appear only if this PIN’s assignment is not none and Cash is on in Payment methods. If Cash is off, Closeout still opens for sales and tips — no drawer count.",
        "No open checks (or transfer them).",
        "If this station has a drawer or bank to count, the screen is Count your till. Helper: “Count all cash in the drawer twice. Enter what you counted. Do not use reports.”",
        "If dual-control is on, a second employee PIN witnesses first. They do not see expected cash.",
        "Enter one number: total cash in the drawer. Nothing is prefilled with expected.",
        "If it matches expected (within house tolerance): the close saves, the receipt printer prints a turn-in slip, and you are done — no denomination grid.",
        "If it does not match: you will not see expected or the variance. Message: “Counted total does not match. Count again by denomination.” Count bills and coin. You cannot go back and guess a total.",
        "If the denomination sum matches: the close saves using that sum. Both attempts are stored. The slip prints. Over/short is $0.",
        "If it still does not match: the close locks on the denomination sum. Management is notified (in-app, SMS/email/push per settings). You see “Count submitted. Management has been notified.” The slip prints with MANAGER REVIEW. Bag turn-in cash + slip and drop. A manager accepts or starts a recount (still blind, still starts with one total).",
        "If the printer fails: the count is saved. Reprint required before Dropped, or a manager overrides. Reprints say COPY. No fill-in form.",
        "After submit, accepted till transfers list as In: +$40 from Till 2 / Out: −$20 to Till 4. The bag slip prints Transfers in and Transfers out so the paperwork matches.",
      ),
      p(
        "Expected is calculated on the server after you submit: opening bank + cash sales − cash refunds − paid-outs − mid-shift drops + paid-ins + accepted transfers in − accepted transfers out. Over/short = counted − expected. Turn-in + bank left = counted. There is no force-balance to $0 and no pocket or tip-jar adjustment. Reports are blocked while the count is in progress. If a till transfer is still pending: “Resolve till transfer #ID first.”",
      ),
      p(
        "The count is locked after submit. Only a manager can void it and start a recount — still blind. Auto-accept within tolerance; above tolerance the manager queue flags it and clock-out can stay blocked until they accept. Opening-bank corrections and counterfeit pulls are manager-only and audited.",
      ),
      callout(
        "cash_at_close",
        "Closeout cash due to the server includes card tips, paid out from the drawer or safe. The payroll export does not add those card tips again. Blind expected includes that paid-out.",
      ),
      callout(
        "paycheck",
        "Closeout shows card tips as informational. Cash due from card tips is $0. Card tips are included on the hours-export file for ADP, Intuit, or CSV. Summex does not run payroll.",
      ),
      callout(
        "cash_tips_only_at_close",
        "Only declared cash tips are settled in person. Card tips always export to payroll.",
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
      p(
        "Closeout tenders only list methods the house has on (card, cash, gift, check, house account, other). Disabled buckets are hidden. Comp appears only if Comp is on.",
      ),
      warn(
        "Closeout is not clock-out. Labor still punches time. House drawer/well close is still Cash, not this wizard.",
      ),
      related("cash-handling", "tenders-tips", "venue-payment-methods", "tip-pooling", "payroll-export", "reports", "floor-pin-login", "login"),
    ],
  }),
  topic({
    id: "tip-pooling",
    chapterId: "cash-gifts",
    title: "Tip pooling — individual, tip-out, FOH / bar / team / dual",
    summary:
      "Location-configurable pools with mix-based tip-outs, autograt, and service charge. Payout uses cash-at-close vs paycheck. Not a payroll run.",
    roles: ["owner_manager", "server", "kitchen_bar", "host_operator"],
    keywords: [
      "tip pool",
      "FOH pool",
      "bar pool",
      "team pool",
      "dual pool",
      "autograt",
      "service charge",
      "points",
      "hours",
    ],
    openView: "settings",
    blocks: [
      why(
        "Houses pool tips in different ways: keep your own, tip-out by food/drink mix, FOH share, bar wells, one team pool, or food vs drink dual pools. Summex calculates the policy you set.",
      ),
      warn(
        "Pooling and tip-credit rules vary by state. Summex calculates your configured policy only — it is not legal advice, not a payroll processor, and does not file taxes.",
      ),
      p(
        "Settings → Cash drawers (Labor / HR can inherit or override per employer). A pool mode can combine mix-based tip-out. Payout uses the existing card-tips setting: cash_at_close or paycheck.",
      ),
      callout(
        "individual",
        "Each person keeps their own tips. No house pool. Typical for QSR, ghost kitchen, and a truck window.",
      ),
      callout(
        "individual_plus_tipout",
        "Keep own tips after mix-based tip-outs to kitchen, bar, host, and busser. Two servers with the same volume do not owe the same kitchen and bar amounts. Typical for a full-service dining room.",
      ),
      callout(
        "foh_pool",
        "Servers, hosts, bussers, and cashiers share one pool. Combine mix-based tip-out if kitchen or bar still gets a cut.",
      ),
      callout(
        "bar_pool",
        "Bartender tips share a pool — all wells together, or each well on its own. Typical for a bar & lounge.",
      ),
      callout(
        "team_pool",
        "One pool for every included role on the floor. Typical for a café counter or a catering event crew.",
      ),
      callout(
        "dual_pool",
        "Food-line ownership funds the FOH (food) pool; drink-line ownership funds the bar (drink) pool. Ticket station and drink course decide the split — not a flat percent of all sales.",
      ),
      p(
        "Contribution: card tips, declared cash, both, a percent of tips, or a percent of sales. Split: hours, point table × hours, equal shares, sales, or manual at closeout. Point table is per role. Include or exclude roles; managers are excluded by default. Settle at end of shift or hold until the pay period.",
      ),
      p(
        "Auto-grat stays with the server, enters the pool, or splits at a custom percent. Service charge is house money or a percent to the staff pool — never labeled a tip unless you check treat as tip.",
      ),
      p(
        "Closeout shows own tips, tip-outs, pool in, pool out, net due now vs paycheck. Reports → Tip pools and the hours CSV list net tips by person and by pool. Summex does not run payroll.",
      ),
      ul(
        "Restaurant: individual + mix-based tip-out; FOH or dual if the house shares.",
        "Bar & lounge: bar pool, all wells or per well.",
        "Café: team pool, or individual + tip-out between espresso and pastry.",
        "QSR: individual; team pool if the counter shares.",
        "Food hall: each employer inherits or overrides. Dual pool if food vs drink operators share a floor.",
        "Truck pod / ghost kitchen: individual. The lot host does not pool across trucks.",
        "Catering: team pool on the event crew, or individual.",
      ),
      related("server-closeout", "cash-handling", "payroll-export", "tenders-tips", "type-restaurant", "type-bar-lounge"),
    ],
  }),
  topic({
    id: "gift-cards",
    chapterId: "cash-gifts",
    title: "First-party gift cards",
    summary:
      "Issuer liability, station sell/redeem, public lookup — Summex ledger only. Not sold online.",
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
      "swipe",
      "scan",
      "finix",
      "lookup",
      "PIN",
      "reactivate",
      "reuse",
      "summex.app/gift",
    ],
    openView: "customers",
    blocks: [
      why(
        "Gift liability belongs to the issuing operator or the house — not to the drawer that collected cash, and not to a leftover Toast/Square gift SKU. One ledger means freeze/void actually work.",
      ),
      p(
        "Gift is the Summex house ledger — not Finix, not Quantum Payments, not a card processor. Sell and redeem on a paired station with a staff PIN. Swipe the mag stripe, scan the barcode, or key the code. Balances live on the Summex server (hashed codes, issuer, ledger). The POS cache is a view of that ledger. There is no third-party gift network as system of record, no open-loop Visa/MC gift, and no public website purchase or shipping.",
      ),
      p(
        "Default issuer follows the selling point: bar sale → that bar operator; host stand sale → the configured entity; explicit house SKU → house. House issuer is optional location mode — you do not create a third legal company.",
      ),
      ul(
        "Sale (cash or card) increases issuer gift liability. It is never booked as the seller’s operating merchandise. Bank-card load charges the issuer entity’s Quantum Payments merchant — redeem stays on the Summex ledger, not a Finix gift product. A shared venue does not require a house gift product. Issuer holds cash until redeem; redeem settlement follows owned_lines.",
        "The collecting drawer may hold cash; settlement tracks due-to-issuer remit when seller ≠ issuer.",
        "Guest redeems at any allowed operator. The fulfilling operator gets the merchandise sale. Issuer liability decreases. In-system settlement issuer → fulfiller (no-op if the same entity).",
        "An operator cannot freeze, void, reload, or import another issuer’s cards. Redeem by code is location-wide so any allowed drawer can take the card.",
        "Optional term (e.g. 2 years) is off by default. Many states prohibit expiry — the location setting includes a legal disclaimer.",
        "At term end, host processes residual: operator-issued remaining balance splits per location formula (default 50/50). House-issued remaining balance is retained by the house.",
      ),
      steps(
        "Settings → Payment methods: check Accept gift cards. Off hides sell, redeem, and the station Gift cards job.",
        "Administer: venue console → Gift cards (next to Payments). Issue, lookup by code or last 4, freeze, void, audit, outstanding liability, limits (default $500 load / $500 sell). Payments has a Gift cards card that opens this tab. Peer venue: each card shows its issuer; House lists every card.",
        "Sell on a paired order or host station: after PIN, Gift cards → Sell gift card. Amount is face value — cash-discount markup does not apply to a gift load. Tender cash or card. The station shows the code to print or read back. Also Pay → Gift → Sell gift card.",
        "Redeem: station Gift cards → Redeem, or Pay → Gift. Scan or type the code. Applies to the open check and cannot exceed the card balance. Receipt shows gift tender. Example: Operator B issues $50 — liability is Operator B. Operator A sells food, redeem — Operator A merch, Operator B → Operator A remit.",
        "Limits live on Gift cards and Settings: max load / max balance per card (default $500), max sell per transaction (default $500), cash-out of remainder off except where required by law, high-value sell / rapid redeem manager PIN (default $200). Use the fields — no JSON. No public /buy-gift-card page.",
        "Reports → Gift liability / Gift redemptions, or Settle → liability by issuer. Host: Process expired residual when a term is in force.",
        "Freeze if lost. Void if issued in error. Both need a manager PIN. Load needs cash or card on the same ticket. Import CSV is a one-way migration of balances from Square / Toast / Clover / Shopify / generic — not resale of those products (those systems are not POS card processors).",
        "Guests look up balance at summex.app/gift — no login. Full printed number, or last four plus the card PIN shown at issue. They see this life only: load, redeem, void, date, venue, amount. Lookups are rate-limited. Staff names never appear.",
        "Spent plastic: manager or venue admin (not an entity-only login) Reactivate on Guests. Balance must be $0, or force with a written reason. The old ledger stays in audit and is closed. Same printed number, new card id, $0, empty guest history. The next load is a new issuance for the selling entity.",
      ),
      warn(
        "Gift cards are not sold on the public website and are not shipped. Turning on a term does not make expiry legal. Confirm state law with counsel — expiry may be illegal in some states. Imported cards are not kept in sync with the old system.",
      ),
      related("tenders-tips", "settlement", "guests", "cash-handling", "quantum-payments", "loss-prevention", "white-paper"),
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
        "Close: end of day; drawer/well close; server banks; server closeouts; tip pools (net by person and pool).",
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
      related("ai-insights", "ops-jobs", "cash-handling", "server-closeout", "settlement", "roles-dashboards"),
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
        "When an AI key is set, the model writes the same JSON from your metrics. Without a key you get Guided insights — same shape, rule-based. AI reports are included with the Ops pack (platform can open them to paid or all plans). Get-a-price interview is always allowed. Each location has a daily call cap (default 200); over cap the job is skipped/queued and does not loop.",
      ),
      p(
        "Owner/manager: Settings → AI ops reports for daily or weekly on-demand analysis. Delivery is in-app (Reports inbox) plus email if configured, otherwise the communications outbox. Scheduled hourly/nightly/weekly/pay-period/monthly packs are Settings → Scheduled AI ops jobs (Reports → Ops jobs). Owner, manager, and accountant can run analysis; vendor operators see their own slice.",
      ),
      warn(
        "Recommendations never auto-change menu prices. Public Operators Guide never includes platform-admin portfolio metrics.",
      ),
      related("reports", "ops-jobs", "location-settings", "type-food-hall", "roles-dashboards"),
    ],
  }),
];
