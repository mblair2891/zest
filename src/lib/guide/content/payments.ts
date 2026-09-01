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
        "Host and each tenant operator complete their own Quantum Payments merchant application. Guest UI never names Finix.",
        "One guest tender. Split capture to each brand’s merchant by merchandise owner. Tax, tip, and service allocate by merchandise share. The printed receipt groups items under the vendor name.",
        "Software billing (SaaS invoices) is separate from guest cards.",
        "Gift load with a bank card charges the issuer brand’s account. Gift redeem stays on the Summex ledger.",
        "Sandbox (default, including Training): practice cards, not a live Visa. Live: present the card on a supplied Quantum reader. SYOH tablets run POS — they are not card terminals.",
        "A brand cannot take live cards until that brand’s application is approved. Training uses sandbox account ids. If the processor is down: take cash or keep the check open.",
      ),
      callout(
        "Sandbox vs live",
        "Platform → Payments sets the default (sandbox unless you choose live). Location settings can inherit, force sandbox, or take live. Training always sandboxes. Status per brand: not started, sandbox, submitted, approved, live. Without an approved account, live fails closed — cash still works.",
      ),
      warn(
        "Do not connect a second processor “just for events.” It is not available, and it would break host capture on a multi-operator check.",
      ),
      related("tenders-tips", "host-capture", "table-qr", "chargebacks", "wifi-offline", "gift-cards"),
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
        "On the check, tap Pay. Choose card (Quantum Payments), cash, or gift card.",
        "Card: amount (defaults to balance), tip suggestions. Sandbox may show last4 on the practice receipt. Live: present on the Quantum reader — never type PAN/CVV. One guest tender; each brand’s account is funded from the split.",
        "Cash: enter tendered; change due is calculated. Cash view tracks the drawer.",
        "Gift: enter the first-party code. Redeem never calls an outside gift network. The fulfilling operator gets the merchandise; issuer liability decreases; issuer remits to the fulfiller if they differ.",
        "To split tenders, pay less than the balance, then take the next tender on the same check.",
        "House / other exist for room charge style paths — still not a second card processor.",
      ),
      shot(
        "Pay dialog — Quantum Payments card tab, tip chips, and remaining balance.",
        "Payment dialog showing Quantum Payments as the card tender.",
      ),
      tip(
        "Tips on card follow the house rule (cash-at-close vs paycheck, and any tip pool) — they are not a second capture.",
      ),
      related("quantum-payments", "cash-discount", "cash-handling", "gift-cards", "host-capture", "tip-pooling", "server-closeout"),
    ],
  }),
  topic({
    id: "host-capture",
    chapterId: "payments",
    title: "Host capture for multi-operator",
    summary: "Each brand is its own payments account; guest still gets one check.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["host capture", "mid", "multi-operator", "operator", "brand", "split"],
    openView: "settlement",
    blocks: [
      why(
        "Each brand must be a merchant of record for its own merchandise. The guest still pays once so the room does not feel like a food-court of terminals.",
      ),
      p(
        "Each entity is its own merchant on Quantum Payments (Finix). Line items stay tagged to the brand that sold them. The guest tenders once; capture splits to those merchants by merchandise share, with tax/tip/service allocated the same way. Receipts group by vendor. The guest never sees Finix. The host is not the sole merchant of record.",
      ),
      steps(
        "Confirm each brand has its own Quantum Payments merchant application (sandbox in training, approved before live cards).",
        "Take payment as usual. One guest check. Capture splits. Receipts group items under the vendor name — still one document.",
        "Do not ask a stall to “run it on their Square.” That path does not exist.",
        "A line whose brand has no approved account fails closed on live — cash still works. Training provisions sandbox ids.",
      ),
      related("single-vs-multi", "multi-operator-orders", "settlement", "chargebacks"),
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
        "Guests pay once. Operators get paid on a period, net of fees and host cut. This is a product-owned ledger, not live processor split-payouts.",
      ),
      steps(
        "Open Settle. Set host cut (percent of gross or fixed per operator), card fee %, tax remittance (host default), and whether tips pool.",
        "Work the period. Live preview shows merchandise, card fees, host cut, cash due, electronic payout.",
        "Close the period. Payout rows address each operator’s account placeholder (last4 stub — not live ACH).",
        "Mark paid when you actually send money outside Summex (bank, envelope, export).",
        "Cash tenders are counted separately (cash due after host cut on the cash share).",
      ),
      callout(
        "Sandbox / ledger",
        "Payout account last4 is a stub so you can rehearse ops. Connecting a live bank rail is out of scope for this guide. The math on the period is still the production contract.",
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
        "Settlement math is only useful if you can see the events that produced it. The system ledger is the house book for Quantum Payments — one guest capture, then operator allocations, then period fees and payouts.",
      ),
      p(
        "Each row has a type, a party (host or operator), a signed amount, and an idempotency key. Positive amounts increase that party’s claim; negative amounts decrease it. Retries do not double-post.",
      ),
      ul(
        "Card pay → capture on the host (Quantum Payments).",
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
    summary: "Shareable description of Summex, Quantum Payments, cash discount, and the ledger.",
    roles: "all",
    keywords: ["white paper", "pdf", "processor", "partner", "quantum reach"],
    blocks: [
      why(
        "Processors, prospects, and partners need one document that does not invent rates, banks, or seals.",
      ),
      p(
        "Open /whitepaper (also linked from the marketing footer). Print from the browser for a PDF. The markdown source lives with the product docs.",
      ),
      steps(
        "Open White paper from the site footer or this topic.",
        "Use Print / PDF in the toolbar.",
        "Treat Roadmap items as not shipped — live ACH is not claimed.",
      ),
      related("system-ledger", "quantum-payments", "settlement", "cash-discount"),
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
