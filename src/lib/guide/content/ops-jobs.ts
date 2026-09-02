import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const OPS_JOBS_TOPICS: GuideTopic[] = [
  topic({
    id: "ops-jobs",
    chapterId: "cash-gifts",
    title: "Scheduled AI ops jobs",
    summary:
      "Hourly, nightly, weekly, pay-period, and monthly packs. Real xAI or skipped — never invented insights.",
    roles: ["owner_manager"],
    keywords: [
      "ops jobs",
      "scheduled",
      "hourly",
      "nightly",
      "weekly",
      "pay period",
      "monthly",
      "xAI",
      "Grok",
      "exceptions",
      "labor pulse",
      "cost flash",
      "recipe",
    ],
    openView: "reports",
    blocks: [
      why(
        "The house needs a clock that reads the floor, labor, exceptions, and cost — without accusing anyone, clocking anyone out, or inventing card charges.",
      ),
      p(
        "Settings → Scheduled AI ops jobs. Each cadence pulls tenant facts, asks Grok for a short narrative plus rows (type, severity, subject, $ or %, suggested action), then stores the pack in Reports → Ops jobs (and Home). Notify roles get an in-app notice. If a notify email is set and Resend is configured, the owner pack emails as a printable HTML report; otherwise it stays in the in-app inbox (Print / PDF from the pack). Missing xAI key or daily AI cap: the job is queued as skipped with a reason and does not retry in a loop. Seed rows from the house still show. Nothing is invented.",
      ),
      callout(
        "Hard rules",
        "Never theft language. Never auto clock-out (staffing is recommend_cut | hold | add only). Never invent Finix, Visa, or Quantum charges — if capture or fee facts are missing, the pack says so. Gift is the Summex ledger. Guest cards are Quantum Payments only.",
      ),
      p(
        "Entity scope: host sees the house pack. A bar operator (Steam-style) sees bar cost and bar sales. A food operator (Diamond-style) sees food cost and kitchen sales.",
      ),
      ul(
        "Service / hourly (while the location is open): floor integrity (occupied + no check; empty/dirty + open check; hold buckets); labor pulse vs target, idle role minutes, ODS depth/times, waitlist, reservations lookahead → recommend_cut | hold | add only; gate feed of voids/comps/no-sales/reopens/gift adjusts to manager devices; gift burst load/redeem/adjust; unreachable Ethernet printers.",
        "Nightly (house close or scheduled hour): exception pack (open checks, cash tendered but check open, late-comp + cash on long-open tickets, long dwell no items, clock-out with opens, hold leftovers); blind counts over/short by drawer and server bank; tips declared vs card vs mix, rec vs actual tip-outs, pool math; tender mix outliers vs house; void/comp $ and % by person vs that weekday; Quantum capture vs line-owner split and gift ledger vs card; cost flash (theoretical recipe use from today’s sales vs invoices posted today, 86/waste); staffing postmortem (recs accepted/dismissed vs volume); house close remaining exceptions — hard-block or manager-ack (same setting as Loss prevention).",
        "Weekly: peer compare by role (voids, comps, cash mix, over/short, tip declare) vs teammates — flags only; schedule vs sales by daypart; per-well drawer trend; menu/recipe variance SKUs, cost vs price, waste; gift liability outstanding by issuer entity and aging; training-mode leftovers.",
        "Pay period: hours + approved shifts + CC tips on paycheck vs cash-at-close + pools; attach exception notes; export ADP / Intuit / CSV only. Summex is not the payroll processor.",
        "Monthly: risk digest of persistent outliers (voids, no-sales, late-comp-cash, gift adjusts, inventory variance) as a review queue, not verdicts; refresh daypart sales/labor baselines for staffing recs; vendor invoice price creep and purchased vs theoretical by SKU; Quantum/Finix fees, chargebacks, $35 fee split by line mix when those facts exist; menu engineering stars/dogs with margin (card vs cash price if cash-discount is on); HR packet dates if enabled (open HR — this job does not invent I-9 dates); devices/printers not seen.",
      ),
      p(
        "Settings on that pack: enable each cadence; nightly/weekly/pay-period/monthly hour; weekly weekday; monthly day of month; open/close for hourly; who is notified (owner, manager, host, accountant) and optional email; labor % target and min staff; food and liquor cost % targets; exception $, %, and idle minutes; house-close hard-block vs ack (writes Loss prevention too); rush-lock dayparts; whether voids and comps count in theoretical recipe use.",
      ),
      steps(
        "PIN as owner or manager. Settings → Scheduled AI ops jobs. Turn cadences on and set hours.",
        "Set notify roles and an email if you want the nightly owner pack emailed when Resend is on.",
        "Reports → Ops jobs (or the catalog row Scheduled AI ops jobs). Run a cadence now to seed the inbox.",
        "Read narrative + rows. Print / PDF for a paper pack. Noted exceptions still live on Home and Loss-prevention reports — this job does not write people up.",
      ),
      tip(
        "On-demand Reports → AI analysis is a separate guided/xAI review of a date range. Scheduled jobs are the clock. Both refuse to auto-change menu prices.",
      ),
      warn(
        "If the key is missing you will see Skipped — that is correct. Do not treat seed rows as a model verdict. Do not use this pack to accuse staff.",
      ),
      related(
        "ai-insights",
        "ops-jobs-cost",
        "loss-prevention",
        "staffing-recs",
        "payroll-export",
        "cost-variance",
      ),
    ],
  }),
  topic({
    id: "ops-jobs-cost",
    chapterId: "costs",
    title: "Recipe cost engine (feeds ops jobs)",
    summary:
      "Recipes, invoice extract, theoretical use vs counts/purchases, food and liquor %. AI recommends counts and prices — never theft.",
    roles: ["owner_manager", "vendor_operator"],
    keywords: [
      "recipe",
      "theoretical",
      "invoice",
      "variance",
      "food cost",
      "liquor cost",
      "par",
      "waste",
    ],
    openView: "inventory",
    blocks: [
      why(
        "Jobs can only flash cost if recipes and posted invoices exist. The engine does not invent on-hand or accuse anyone of taking product.",
      ),
      ul(
        "Recipes: ingredient qty/unit on items and prep recipes. Optional waste factor and yield.",
        "Purchases: invoice upload → AI extract vendor/date/SKU/qty/cost when keyed, else guided. Staff confirm map to an ingredient, then Post.",
        "Optional on-hand counts (full or partial) and waste logs.",
        "Theoretical use = net sales × recipe. Settings → Scheduled AI ops jobs: include voids (default off) and include comps (default on — product left the well).",
        "Food cost % and liquor cost % vs location targets (jobs settings, with catalog defaults 28% food / 18% liquor).",
        "Variance = actual (counts and/or purchases) vs theoretical.",
        "AI recommend: count SKU, confirm waste, change par, change pour/plate, change menu price. Never “X stole.” Price recs still require a human Save on Menu.",
      ),
      p(
        "Nightly cost flash compares today’s theoretical use to invoices posted today plus 86/waste. Weekly flags variance SKUs. Monthly flags invoice price creep and purchased vs theoretical by SKU. Bar entities see liquor/beer/wine; food entities see food; host sees the house pack.",
      ),
      steps(
        "Costs → Recipes: attach qty/unit per sale. Map SKUs.",
        "Costs → Invoices: upload, confirm map, Post.",
        "Optional count. Respond to variance with a required code + note.",
        "Reports → Ops jobs → Run nightly or weekly to see the cost flash.",
      ),
      warn(
        "Copy never says theft to the floor. Investigate pours, waste, events, or counts.",
      ),
      related("ops-jobs", "cost-control", "cost-variance", "cost-invoices", "recipes-prep"),
    ],
  }),
];
