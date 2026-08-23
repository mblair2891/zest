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
    ],
    openView: "integrations",
    blocks: [
      why(
        "Guests must see one processor and one brand on the check. A second card integration would split liability, settlement, and the receipt.",
      ),
      p(
        "Every card tender runs through Quantum Payments. Integrations never offer Stripe, Square, Adyen, or other POS processors. Delivery, accounting, and payroll partners stay — they are not card processors.",
      ),
      ul(
        "Guest-facing charge brand is the location / host name.",
        "Software billing (SaaS invoices) is separate from guest cards.",
        "Gift cards are first-party Summex, not Quantum Payments and not a third-party gift network.",
        "If the internet is down, card captures queue on the house hub and flush when the uplink returns.",
      ),
      warn(
        "Do not connect a second processor “just for events.” It is not available, and it would break host capture on a multi-operator check.",
      ),
      related("tenders-tips", "host-capture", "chargebacks", "wifi-offline"),
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
        "Card: amount (defaults to balance), tip suggestions, last4 for the sandbox receipt. Capture is one host MID.",
        "Cash: enter tendered; change due is calculated. Cash view tracks the drawer.",
        "Gift: enter the first-party code. Redeem never calls an outside gift network.",
        "To split tenders, pay less than the balance, then take the next tender on the same check.",
        "House / other exist for room charge style paths — still not a second card processor.",
      ),
      shot(
        "Pay dialog — Quantum Payments card tab, tip chips, and remaining balance.",
        "Payment dialog showing Quantum Payments as the card tender.",
      ),
      tip(
        "Tips on card follow the house rule (house vs pool with operators) at settlement — they are not a second capture.",
      ),
      related("quantum-payments", "cash-discount", "cash-handling", "gift-cards", "host-capture"),
    ],
  }),
  topic({
    id: "host-capture",
    chapterId: "payments",
    title: "Host capture for multi-operator",
    summary: "One guest brand, one MID, operators are not processors.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["host capture", "mid", "multi-operator", "operator", "brand"],
    openView: "settlement",
    blocks: [
      why(
        "If Operator A and Operator B each ran a card, the guest would see two charges and the host could not take a fair cut or a fair dispute fee.",
      ),
      p(
        "On a host venue the guest-facing name is Host Venue (or your location name). Line items stay tagged to Operator A / Operator B. Quantum Payments captures once on the host MID.",
      ),
      steps(
        "Confirm operating model is host + operators and each item has an operator.",
        "Take payment as usual. The receipt shows the host brand via Quantum Payments.",
        "Do not ask a stall to “run it on their Square.” That path does not exist.",
        "Period close creates payout rows per operator (sandbox/ledger — not live ACH).",
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
        "This is a first-party sandbox ledger. It is not QuickBooks and not a live ACH rail. See the Summex white paper for the commercial description.",
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
        "Mixed check, e.g. Operator A food $65 + Operator B drink $35 → $22.75 / $12.25.",
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
