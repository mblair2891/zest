import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const LOSS_PREVENTION_TOPICS: GuideTopic[] = [
  topic({
    id: "loss-prevention",
    chapterId: "cash-gifts",
    title: "Loss-prevention gates & exception reports",
    summary:
      "What is gated, how managers read exceptions, and why paid checks freeze. Controls and audit only.",
    roles: ["owner_manager"],
    keywords: [
      "void",
      "comp",
      "discount",
      "no sale",
      "reopen",
      "audit",
      "exception",
      "PIN lock",
      "manager PIN",
      "paid check",
      "gift adjust",
    ],
    openView: "reports",
    blocks: [
      why(
        "The house logs who changed money after it was committed — send, bump, pay, gift, drawer. Managers review exceptions. The product does not accuse anyone.",
      ),
      p(
        "PIN is not clock-in and not closeout. Each employee has a unique PIN. After too many failed attempts the station PIN pad locks until a manager unlocks it. A locked employee PIN is reset by a manager on Staff (set a new unique PIN or Unlock PIN). ODS stations cannot tender cash or gift — order and host stations follow their cash-handling roles.",
      ),
      p(
        "Gated actions need a manager PIN (or an open manager session) and a reason from the house list. Settings → Loss prevention turns each gate to manager PIN or log-only. No-sale, blind count, over/short $X, and closeout-before-clock-out stay on Cash drawers.",
      ),
      ul(
        "Void or discount after send to ODS: manager PIN + listed reason.",
        "Void after bump: manager PIN + reason; that kitchen ticket is marked VOID.",
        "Comp: manager PIN + reason (default).",
        "Discount caps by role. Stacking that would exceed the cap is refused — not silently reduced.",
        "No-sale drawer open: off, manager, or assigned user + reason. Always logged.",
        "Paid check is frozen. Reopen or swap a tender: manager PIN + reason; before/after is stored.",
        "Gift balance adjust / freeze / deactivate: manager only. Load requires a cash or card tender on the same ticket. Only issued or imported card IDs.",
        "Every cash tender stores the user, drawer or server bank, and time. Card tips come from the processor, not a typed amount. Declared cash tips store on closeout.",
      ),
      steps(
        "Settings → Loss prevention: lockout count, manager session minutes, which gates need a PIN, discount caps, outlier multiplier.",
        "On a check: Void / Comp / Disc collect a listed reason. After send or bump, the manager PIN dialog opens unless a manager session is still open.",
        "After pay, the check shows frozen. Reopen or Swap last tender only from that banner.",
        "Home (owner/manager) shows a live feed of gated actions and a queue of flags. Reports → Loss-prevention exceptions compares each employee to the house and to the same weekday.",
        "A flag (for example void % at least 3× the house) is queued for review. Tap Noted when you have looked at it. It is not an automatic write-up.",
      ),
      callout(
        "Why paid checks freeze",
        "Once a check is paid, lines and tenders must not change in place. A reopen or tender swap is a manager event with a reason and a before/after snapshot so settlement, tips, and the drawer still match what actually happened.",
      ),
      p(
        "The audit log is append-only: who acted, whom they overrode, device, entity, ticket, amount, reason, before/after, time. Voids, comps, discounts, no-sales, reopens, tender changes, gift adjusts, paid-in/out, drops, manager overrides, PIN lockouts, and over/short all write a row.",
      ),
      tip(
        "Read exceptions as a queue: compare $ and % to the house and to the same weekday, then look at the live feed for the underlying voids or no-sales. Inventory/recipe vs sales vs invoices, when that data exists, still lives on Costs — respond with a reason there too.",
      ),
      warn(
        "This topic is for operators who already run the floor. It lists what the product gates and how to read the queue. It is not a walkthrough of how to bypass controls.",
      ),
      related(
        "cash-handling",
        "server-closeout",
        "gift-cards",
        "device-roles",
        "role-owner",
        "audit",
        "tenders-tips",
      ),
    ],
  }),
];
