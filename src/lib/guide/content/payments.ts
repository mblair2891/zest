import { callout, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const PAYMENT_TOPICS: GuideTopic[] = [
  topic({
    id: "quantum-payments",
    chapterId: "payments",
    title: "Quantum Payments (guest cards)",
    summary: "The only guest-facing card processor. No Stripe, Square, or similar on the check.",
    roles: "all",
    keywords: [
      "quantum payments",
      "card",
      "processor",
      "stripe",
      "square",
      "guest card",
      "mid",
      "finix",
      "merchant",
      "split capture",
    ],
    openView: "integrations",
    blocks: [
      why(
        "Guests must see one processor and one check. A second card integration would split liability, settlement, and the receipt.",
      ),
      p(
        "Every card tender runs through Quantum Payments. Each entity is its own merchant (Finix rail). The guest never sees Finix — they see Quantum Payments and one check. Capture splits to each brand. Receipts group lines by vendor. Integrations never offer Stripe, Square, Adyen, or other POS processors. Delivery, accounting, and hours-export partners (ADP, Intuit) stay — they are not card processors and Summex does not process payroll.",
      ),
      ul(
        "Host and each tenant operator complete their own Quantum Payments merchant application (legal name, DBA, EIN, owners, address, MCC, payout bank). Guest UI never names Finix. MCC 5813 (drinking place): on-premise retail only. Summex does not support online or shipped alcohol sales. 5812 restaurant and 5814 QSR where they apply. A shared venue has no Finix merchant on the building — one Payments / KYC screen per selling entity.",
        "One guest tender. Split capture to each brand’s merchant by merchandise owner. Tax, tip, and service allocate by merchandise share. Receipt, email, and QR check itemize by vendor, then totals — still one document.",
        "Software billing (SaaS invoices) is separate from guest cards.",
        "Gift load with a bank card charges the issuer brand’s account. Gift redeem stays on the Summex ledger.",
        "Sandbox (default, including Training): practice cards, not a live Visa. Live: present the card on an enrolled Finix/Quantum reader supplied through Summex. Handhelds are not Square or Stripe terminals and never take PAN on the tablet. Cash and gift still work without a reader. Printers and drawers stay BYO. Live cards fail closed without an enrolled reader.",
        "A brand cannot take live cards until that brand’s application is approved. Training uses sandbox account ids. If the processor is down: take cash or keep the check open.",
        "Venue Settings → Profile: country, state/province, city, optional tax district — required before live cards. Platform may send a jurisdiction bulletin. Action required: Review rates. Tax rows never change until the owner Saves (or Dismisses). No silent tax edits.",
        "If Card is off in Settings → Payment methods, stations never prompt for a reader. Sandbox vs live still follows location lifecycle when card is on.",
        "Per-entity cannot disable card for themselves if the venue takes cards. They only have their Finix merchant for their lines.",
      ),
      callout(
        "Sandbox vs live",
        "Platform → Payments sets the default (sandbox unless you choose live). Location settings can inherit, force sandbox, or take live. Training always sandboxes. Status per brand: not started, sandbox, submitted, approved, live. Without an approved account, live fails closed — cash still works.",
      ),
      warn(
        "Do not connect a second processor “just for events.” It is not available, and it would break one-check split capture on a multi-operator floor.",
      ),
      related("tenders-tips", "venue-payment-methods", "host-capture", "receipts-by-vendor", "table-qr", "chargebacks", "wifi-offline", "gift-cards", "tax-jurisdiction"),
    ],
  }),
  topic({
    id: "tax-jurisdiction",
    chapterId: "payments",
    title: "Jurisdiction and tax bulletins",
    summary:
      "Country, state, city (optional district) before live cards. Platform bulletins never write tax until you Save.",
    roles: ["owner_manager", "host_operator"],
    keywords: ["jurisdiction", "tax", "bulletin", "state", "california", "sales tax", "avalara"],
    openView: "settings",
    blocks: [
      why(
        "Live cards need to know where the house is. Tax rates stay under the owner’s finger — a bulletin is a notice, not a silent edit.",
      ),
      p(
        "Venue Settings → Profile: country, state/province, city, optional tax district. Required before live cards. A platform bulletin targeted at your state, city, or district shows on the owner/manager dashboard. Action required also appears as a line on the station update prompt. Email sends if Resend is configured. Review rates opens Taxes with a suggested rate when the bulletin includes one. Save adds it. Dismiss leaves the list unchanged.",
      ),
      steps(
        "Fill country, state, and city in Venue Settings → Profile before switching to live cards.",
        "If a banner appears, read it. Action required: Review taxes and/or Review labor.",
        "Save the suggestion, Dismiss, or schedule accept to the bulletin effective date. Rows never change on their own.",
      ),
      warn(
        "No daily crawler of every department of revenue. First version is platform-authored targeting. A later tax API (Avalara/TaxJar) would use the same bulletin + suggestion flow — not required to ship.",
      ),
      related("quantum-payments", "receipts-by-vendor"),
    ],
  }),
  topic({
    id: "tenders-tips",
    chapterId: "payments",
    title: "Tenders, tips, split tenders",
    summary: "Card, cash, gift, and splitting a check across tenders.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: ["tender", "tip", "split", "cash", "gift", "partial", "pay"],
    openView: "cash",
    blocks: [
      why(
        "The check stays open until the balance is zero. Partial tenders are how a table splits cash and card without two checks.",
      ),
      steps(
        "On the check, tap Pay. Only tenders the house has on appear — large full-width buttons, not a strip of greyed-out icons.",
        "Card (if on): amount (defaults to balance), tip suggestions. Training / Quantum sandbox may fake the card and show last4 on the practice receipt. Live: present on the Quantum reader — never type PAN/CVV. One guest tender; each brand’s account is funded from the split. The printed receipt groups lines by vendor — still one document.",
        "Cash (if on): Cash is a first-class button on Pay. It is not hidden because the house is in training/sandbox or because this station has no receipt printer. Enter tendered; change due is calculated. Cash still records on the check and till. On a Terminal with a bound Epson receipt printer, cash 9100 includes the drawer pulse, then optional paid receipt. Cash off: no Take drawer, no possession, no cash count.",
        "Gift (if on): enter the first-party code. Redeem never calls an outside gift network. The fulfilling operator gets the merchandise; issuer liability decreases; issuer remits to the fulfiller if they differ. Gift off: no Issue/reload and no redeem.",
        "Check, house account, comp, and Other appear only when those toggles are on. Comp needs a reason and is not a guest tender.",
        "To split tenders, pay less than the balance, then take the next enabled tender on the same check.",
        "After every tender that closes the check: Email, Print, or No receipt. Email sends via Resend; if email is down, the station says so and offers print. Print is ESC/POS on this station’s mapped receipt printer (else the venue default). No receipt closes the check. Shared check: one document, lines by vendor.",
      ),
      shot(
        "Pay dialog — Quantum Payments card tab, tip chips, and remaining balance.",
        "Payment dialog showing Quantum Payments as the card tender.",
      ),
      tip(
        "Tips on card follow the house rule (cash-at-close vs paycheck, and any tip pool) — they are not a second capture.",
      ),
      related("venue-payment-methods", "quantum-payments", "cash-discount", "cash-handling", "gift-cards", "host-capture", "receipts-by-vendor", "tip-pooling", "server-closeout"),
    ],
  }),
  topic({
    id: "venue-payment-methods",
    chapterId: "payments",
    title: "Venue payment methods",
    summary:
      "Location owner/manager toggles which tenders the house accepts. Disabled methods are hidden everywhere. Not JSON.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: [
      "payment methods",
      "tender",
      "cash off",
      "card off",
      "gift off",
      "check",
      "house account",
      "comp",
      "other",
      "toggle",
    ],
    openView: "settings",
    blocks: [
      why(
        "The house decides which tenders guests can use. A disabled method must not appear on pay, QR, kiosk, or closeout — staff should not hunt for a greyed-out button.",
      ),
      p(
        "Settings → Payment methods. Checkboxes, not a JSON blob. Location owner or manager enables each tender: Cash, Card (Quantum Payments / Finix — live or sandbox by location lifecycle), Gift card (first-party ledger), Check, House account / charge to company, Comp (reason required; not a guest tender), Other with a custom label counted in closeout.",
      ),
      ul(
        "At least one guest tender stays on: cash and/or card and/or gift. You cannot turn the last one off.",
        "Disabled methods are hidden on station Pay, table QR pay, kiosk, and closeout expected buckets.",
        "Cash on: Pay shows Cash. Missing receipt printer and training/sandbox do not remove it. Cash off: no drawer possession for that venue’s staff. Take drawer / Open bank is hidden. Banks stay unused. Closeout still runs for sales and tips — no cash count.",
        "Card off: no reader prompts. When card is on, training sandbox still follows the location lifecycle. Sandbox may fake card; cash still posts.",
        "Gift off: no sell (Issue / reload) and no redeem.",
        "Check: optional sub-toggles for photo, last 4, and manager witness PIN.",
        "Quote and onboarding default cash + card + gift on; check off.",
      ),
      callout(
        "Peer venue",
        "Methods are venue-level. The guest pays once. Settlement by owned_lines is unchanged. An operator cannot turn off card for their own lines if the house takes cards — they only have their Finix merchant for their merchandise.",
      ),
      warn(
        "Do not paste a JSON config for tenders. Use the checkboxes. Publish so paired stations pick the methods up.",
      ),
      related("tenders-tips", "quantum-payments", "cash-handling", "gift-cards", "server-closeout", "host-capture"),
    ],
  }),
  topic({
    id: "host-capture",
    chapterId: "payments",
    title: "One guest check, per-entity merchants",
    summary: "Each brand is its own Quantum Payments merchant; guest still gets one check; capture splits; receipts group by vendor.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["host capture", "mid", "multi-operator", "operator", "brand", "split"],
    openView: "settlement",
    blocks: [
      why(
        "Each brand must be a merchant of record for its own merchandise. The guest still pays once so the room does not feel like a food-court of terminals.",
      ),
      p(
        "Each entity is its own merchant on Quantum Payments (Finix). Line items stay tagged to the brand that sold them. The guest tenders once; Finix pays each operator their share by merchandise owner, with tax/tip/service allocated the same way. Receipts, email, and QR itemize by vendor. The guest never sees Finix. The host is not the sole merchant of record.",
      ),
      steps(
        "Confirm each brand has its own Quantum Payments merchant application (sandbox in training, approved before live cards).",
        "Take payment as usual. One guest check. Capture splits to each brand’s merchant. Receipts group items under the vendor name — still one document.",
        "Do not ask a stall to “run it on their Square.” That path does not exist.",
        "A line whose brand has no approved account fails closed on live — cash still works. Training provisions sandbox ids.",
      ),
      related("single-vs-multi", "multi-operator-orders", "receipts-by-vendor", "settlement", "chargebacks"),
    ],
  }),
  topic({
    id: "receipts-by-vendor",
    chapterId: "payments",
    title: "Receipts by vendor",
    summary: "One guest receipt. Lines group under the operator name. Merchant copy lists the split.",
    roles: ["owner_manager", "server", "host_operator", "vendor_operator"],
    keywords: [
      "receipt",
      "vendor",
      "group",
      "print",
      "thermal",
      "operator a",
      "operator b",
      "merchant copy",
    ],
    openView: "order",
    blocks: [
      why(
        "The guest should see who cooked or poured without a second checkout. The house still prints one document under the location name.",
      ),
      p(
        "Print check (before tender) and the paid receipt are different. Print check appears on the order pad and on Pay when a receipt printer is assigned to that table’s floor section (Epson TM-T20 at the venue IP:9100 — house example 192.168.0.112). To-go / will-call use the venue default receipt printer. It is the guest’s itemized bill — not the kitchen Star. 80mm Epson: each item is one line (qty + name left, cash / card right) with one blank line between items — do not stack cash and card under the name. Entity header, entity cash/card subtotals, grand totals, footer, then QR. Named tax lines only when rates exist. CASH TOTAL is the sum of line cash prices; CARD TOTAL is the sum of line card prices. Footer: “Not a receipt - pay server.” If that Epson has Print pay QR on, the slip includes a native thermal QR of the public guest URL for THIS open check (table token + check number). If the table has no public token, Print check mints one and saves it. Scan opens that check (reorder + pay), not Unknown table. Never a random or demo token. Star kitchen tickets never get a pay QR. Clock is the venue IANA timezone with AM/PM. No guest split on that ticket — staff already split checks. If no receipt printer is assigned: “Add a receipt printer in Devices.” After the guest pays: Email, SMS, Printed receipt (same section Epson), or None. Quantum Payments is the tender line — guests never see Finix.",
      ),
      ul(
        "Two station classes. Handheld: ring, send, card-present on a paired Quantum mobile reader (flip to guest for amount, tip, sign). Cash still shows on Pay when the venue Cash toggle is on. No sale and drawer kick stay on terminals. After approved card: Email / SMS / Printed receipt / None. Printed queues the paid receipt to the section receipt printer on the LAN, or Open on terminal flags the check so a register can Print receipt. Terminal: Print check (pre-pay guest check, entity itemized, each tax line, cash + card totals, pay QR when venue QR pay-or-reorder is on and Print pay QR is checked), paid receipt, No sale, drawer kick on the Epson that printed that check. Kitchen Star never prints a guest check, never kicks, and never prints a pay QR. QR pay on the guest phone is unchanged.",
        "One document. Do not print a stall receipt as a second card run.",
        "Merchant copy (when more than one brand is on the check) lists that vendor’s share: merchandise, tax/tip/service, total. Guest still paid once.",
        "Kitchen and bar tickets still print only that station’s lines (Star SP700 impact for kitchen). Pay uses the same ownership map as ODS routing — do not change routing.",
        "Cash discount receipts and the check can show both: Cash $18.00 · Card $19.00. Cash tender charges cash; card tender charges card.",
      ),
      steps(
        "On the pad or Pay, tap Print check before tender. It lands on the Epson for that table’s section (venue default for to-go). Confirm it is not the kitchen Star. Print check does not kick the drawer unless Kick drawer on Print check is on (default off). Cash on a Terminal kicks the same receipt printer via 9100 (pin 2 default). If the button is missing: Add a receipt printer in Devices and assign it to the section. Tenders stay. On a handheld, Flip to guest for card + tip + sign, then Email / SMS / Printed receipt or Open on terminal.",
        "After pay, choose Email, Print, or No receipt. Same three choices for card, cash, gift, and comp.",
        "Email: enter the guest address. Sent via Resend. If email is down, the station says so and offers print.",
        "Print: ESC/POS on the receipt printer for that table’s section. To-go / will-call: venue default. Station fallback only if the section has none.",
        "Confirm lines sit under the selling operator — one guest receipt. Untagged lines group with the host.",
        "Do not ask the bar to “run it on their Square” for a second chit.",
      ),
      related("host-capture", "quantum-payments", "multi-operator-orders", "printers-kds", "tenders-tips", "table-qr", "location-settings"),
    ],
  }),
  topic({
    id: "settlement",
    chapterId: "payments",
    title: "Settlement periods & operator payouts",
    summary: "Merchandise share, card fees, host cut, cash due, sandbox ledger.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["settlement", "payout", "host cut", "ledger", "period", "ach"],
    openView: "settlement",
    blocks: [
      why(
        "Guests pay once. On card capture, Finix (Quantum Payments) already sends each operator their share. The period book still nets cash, host cut, card fees, and disputes.",
      ),
      steps(
        "Open Settle. Live preview: guest paid $X once; each operator’s ticket share vs Quantum payout.",
        "Set host cut (percent of gross or fixed per operator), card fee %, tax remittance (host default), and whether tips pool.",
        "Work the period. Card capture already paid each operator their merchandise mix. Close still records cash due, host cut, fees, and any $35 dispute split.",
        "Close the period. Remaining electronic rows (host cut, fees) address each operator’s account placeholder (last4 stub — live ACH of leftovers is Roadmap).",
        "Mark paid when you actually send leftover money outside Summex (bank, envelope, export).",
        "Cash tenders are counted separately (cash due after host cut on the cash share).",
      ),
      callout(
        "Capture vs period",
        "Card: one guest authorization; Finix pays each approved merchant their share immediately. Period close is the house book for cash, host cut, fees, and chargebacks — not a second stall checkout. Connecting leftover ACH is out of scope for this guide.",
      ),
      related("host-capture", "chargebacks", "system-ledger", "cash-handling", "single-vs-multi"),
    ],
  }),
  topic({
    id: "system-ledger",
    chapterId: "payments",
    title: "Understanding the ledger",
    summary:
      "Append-only money events: capture, allocation, fees, payout, chargeback. Sandbox book — not live ACH.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "platform_admin"],
    keywords: ["ledger", "allocation", "capture", "payout", "book", "csv"],
    openView: "ledger",
    blocks: [
      why(
        "Settlement math is only useful if you can see the events that produced it. The system ledger is the house book for Quantum Payments — one guest tender, split capture to each brand’s merchant, then operator allocations, then period fees and payouts.",
      ),
      p(
        "Each row has a type, a party (host or operator), a signed amount, and an idempotency key. Positive amounts increase that party’s claim; negative amounts decrease it. Retries do not double-post.",
      ),
      ul(
        "Card pay → one guest authorization; Finix split to each brand’s Quantum Payments merchant (guest still sees one check).",
        "Cash pay → capture plus an optional cash_discount_adjustment when discount is on.",
        "Check close → allocation to each operator by merchandise share.",
        "Period close → processor_fee, host_fee, sandbox payout (not live bank).",
        "File dispute → chargeback impact on host plus $35 chargeback_fee split by merchandise %.",
      ),
      steps(
        "Open Ledger from the menu or from Settle.",
        "Filter by type, operator, or date. Export CSV for your accountant.",
        "Won/lost on a dispute does not add a reversing $35 — filing already posted the fee.",
      ),
      warn(
        "This is a first-party ledger. It is not QuickBooks and not a live ACH rail. Period payouts are addressed on the book; live bank transfers wait for approved Quantum applications. See the Summex white paper.",
      ),
      related("settlement", "chargebacks", "quantum-payments", "white-paper"),
    ],
  }),
  topic({
    id: "white-paper",
    chapterId: "payments",
    title: "White paper",
    summary:
      "Shareable paper for owners considering Summex: one guest check, floor, money, plans. Get a price on summex.app.",
    roles: "all",
    keywords: ["white paper", "pdf", "processor", "partner", "quantum reach"],
    blocks: [
      why(
        "An owner considering Summex should read a product paper — not a stack spec. Processors and partners can share the same document.",
      ),
      p(
        "Open White paper from the marketing header or footer (no login). Print from the browser for a PDF. Revision · 22 Sep 2026 matches Guide v2026.10.152. Wall ends snap into a closed corner, and the live floor draws that join. Platform Home in the console top bar opens the dashboard. The live floor keeps published walls, doors, windows, and the bar slab as dark lines on the wood. Floor handles rotate with the piece, so a wall at 90° lengthens along its vertical ends. The floor editor selects a bar on its slab and stores each leg’s length. Floor editor Rotate 90° keeps that angle after Publish. Exit kiosk on the PIN pad asks for one manager PIN and leaves lock-task. Location profile save completes contact, address, and timezone together, and the floor editor publishes walls and the bar shape. A full-service demo publishes its dining room and bar rail, and the live floor draws that snapshot. Each selling entity uploads its menu as a draft, then publishes that entity’s items to the order pad. The live floor is a wood map. Exit kiosk leaves lock-task. The guest-check header is the building name in text. Location and entity logos are on the QR page and tablets. It is written for prospective subscribers: one guest check, floor, multi-entity, Android staff stations, venue payment-method toggles, 5% cash-discount processing story, plans from Get a price. Gift cards are not sold online. QR is on-premise. No CRM, pipeline, factory reset, or how to log in. Internal operations notes stay off the public site.",
      ),
      steps(
        "Open White paper from the marketing header (White paper). That page is the paper — not Get a price.",
        "Get a price is a different page: the selector wizard and live quote.",
        "Print from the browser if you want a PDF. Start a quote from Get a price on summex.app.",
      ),
      related("system-ledger", "quantum-payments", "host-capture", "receipts-by-vendor", "gift-cards", "device-roles", "cash-handling", "location-training"),
    ],
  }),
  topic({
    id: "chargebacks",
    chapterId: "payments",
    title: "Chargebacks ($35 dispute fee)",
    summary: "Fee applies when a dispute is filed; split by operator merchandise % on that check.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "platform_admin"],
    keywords: [
      "chargeback",
      "dispute",
      "35",
      "$35",
      "fee",
      "split",
      "merchandise",
      "quantum",
    ],
    openView: "settlement",
    blocks: [
      why(
        "Quantum Payments charges $35 only when a real dispute is filed. Standing “chargeback insurance” would punish operators who never had a dispute.",
      ),
      p(
        "File on a closed check that has a card capture. The $35.00 (3500 cents) is split by each operator’s share of merchandise (pre-tax product, voids/comps excluded) on that check. Win or lose does not reverse the fee — filing is what creates it.",
      ),
      ul(
        "One operator’s merchandise on the check → that operator pays $35.",
        "Mixed check, e.g. Operator A food $65 + Operator B drinks $35 → $22.75 / $12.25.",
        "No dispute filed → $0. Never a standing fee.",
        "Deducted from the electronic payout on the period.",
      ),
      steps(
        "Open Settle → Quantum Payments disputes.",
        "On an eligible closed card check, tap File dispute.",
        "Review allocations: operator, merchandise, share %, fee.",
        "When the processor outcome is known, Mark won or Mark lost. The $35 stays.",
      ),
      shot(
        "Settlement — File dispute on a closed check, allocations to Operator A and Operator B.",
        "Chargeback panel showing a $35 fee split by merchandise share.",
      ),
      warn(
        "Do not void the original check to “undo” a dispute. Use this panel so the ledger stays auditable.",
      ),
      related("settlement", "host-capture", "quantum-payments", "audit"),
    ],
  }),
];
