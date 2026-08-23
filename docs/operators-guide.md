# Operators Guide — authoring

The in-app **Operators Guide** is the living product manual. It is not a
separate PDF. Staff open it from **Guide** / **?** in the POS and platform
shells, from login and empty states, or at `/guide`.

Content lives in TypeScript modules so a new feature is a new topic file, not
a CMS.

## Where things live

| Path | Purpose |
|---|---|
| `src/lib/guide/content/*.ts` | Topics, grouped by chapter |
| `src/lib/guide/catalog.ts` | Chapter list + assembled `GUIDE_TOPICS` |
| `src/lib/guide/updates.ts` | Release-note data (not shown in the guide) |
| `src/lib/guide/types.ts` | `GUIDE_VERSION`, roles, block types |
| `src/lib/guide/store.ts` | Overlay open state, progress, silence prefs |
| `src/components/guide/OperatorsGuide.tsx` | Overlay + `/guide` page |
| `src/components/guide/GuideLearnLink.tsx` | Contextual “Learn” control |
| `src/routes/guide.tsx` | `/guide?topic=chargebacks` |
| `docs/whitepaper/` | Shareable white paper (MD + print HTML) |
| `/whitepaper` | Live white paper (prints to PDF) |
| `docs/quantum-payments-ledger.md` | Ledger sign convention + The Laundry worked example |
| `/guide?topic=laundry-test-venue` | DEV_DEMO TEST host (The Laundry) |

Bump `GUIDE_VERSION` in `types.ts` when you ship a batch of topics.

## Add a topic

1. Open the matching chapter file (or add a new one and import it in `catalog.ts`).
2. Append a `topic({ ... })` object. Required shape:

```ts
topic({
  id: "my-topic",           // stable; used in URLs and Learn links
  chapterId: "payments",    // must match GUIDE_CHAPTERS
  title: "Short title",
  summary: "One line.",
  roles: ["owner_manager", "host_operator"], // or "all"
  keywords: ["search", "terms"],
  openView: "settlement",   // optional POS jump
  blocks: [
    why("Why it matters."),
    steps("Do this.", "Then this."),
    related("settlement", "chargebacks"),
  ],
});
```

Helpers: `why`, `p`, `steps`, `ul`, `ol`, `tip`, `warn`, `callout`, `shot`, `related`
from `src/lib/guide/content/helpers.ts`.

Every topic should include **Why it matters**, **Steps**, and **Related topics**.

3. From a screen, deep-link with:

```tsx
<GuideLearnLink topicId="my-topic">Learn</GuideLearnLink>
```

or `useGuideStore.getState().openGuide("my-topic")`.

Bookmarkable URL: `/guide?topic=my-topic`.

## Public vs Platform

The public `/guide` is operations: floor, menu, routing, Quantum Payments,
settlement concepts, kiosk/waitlist, cash discount, establishment types.
It does **not** include SaaS platform-admin topics (pipeline, bootstrap Admin,
reset-all-demos, tenant underwriting).

Platform-admin topics use `visibility: "platform"` (and/or the **Platform**
chapter). They render only when the viewer is signed in as `platform_admin`.

Public **Exit** on `/guide` returns to `/`. Demo/tour **Exit** returns to `/demo`.

## Roles

| Tab | Who |
|---|---|
| Platform Admin | Control plane, pipeline, tenants — **signed-in admin only** |
| Owner / Manager | Site ops, money, staff |
| Server | Floor, checks, guests (includes FOH host stand & busser) |
| Kitchen / Bar | Tickets, bump, routing |
| Host (multi-operator) | Hall/pod host — not the FOH host stand |
| Vendor / Operator | Stall brand (Operator A / Operator B) |

Session mapping: POS PIN `owner`/`manager` → Owner/Manager (plus Host on
`food_hall` / `truck_pod`). `server`/`host`/`busser` → Server.
`kitchen`/`bartender` → Kitchen/Bar. Platform Admin email or `platform_admin`
SaaS role → Platform Admin. Signed-out public guide shows **All** public
topics — never Platform Admin.

## Progress

Completion is stored in `localStorage` (`summex-guide-prefs-v1`), keyed by
account id, else PIN employee id, else `local`. “Continue where you left off”
resumes the last unfinished topic.

## Copy rules

- Product: **Summex**, powered by **Quantum Reach**.
- Guest cards: **Quantum Payments** only. Never Stripe/Square as a POS processor.
- Examples: **Host Venue**, **Operator A**, **Operator B**. No live customer names.
- Chargebacks: **$35** when a dispute is **filed**; split by merchandise % on
  that check; won/lost does not reverse the fee.

## Guided demos & voiceover tours

Prospect tours run on the **live product UI** (real routes, demo-seeded venues,
spotlight on live components) — not a slideshow.

| Control | What it does |
|---|---|
| Public **Demos** → **Full product tour** | `startTour("full")` |
| Public **Demos** → **Guided demo** | `startTour("type:{typeId}")` |
| `/demo/tour/full` | Shareable full tour (auto-play) |
| `/demo/{type}/tour` | Shareable per-type tour (auto-play) |
| Tour **Exit** / Esc / Finish | Returns to `/demo` — not dashboard |

Narration: handwritten fallbacks in `src/lib/demo/tour-scripts.ts`. When
`XAI_API_KEY` (or `OPENAI_API_KEY`) is set, `getTourNarrationFn` writes
sales-ready scripts and caches per tour id. Voiceover is the browser Speech
API (`speechSynthesis`); Pause / Exit cancel speech.

Safe POS actions (seat, add, send, sandbox pay) run only while
`isProspectDemo()` is true. Unknown tour ids toast **Tour not available**.

In-app topic: `/guide?topic=prospect-demos`.

## Print

The overlay and `/guide` page hide chrome under `@media print`. Use the printer
button or the browser print dialog. A separate PDF is optional, not required.
