# Operators Guide — authoring

The in-app **Operators Guide** is the living product manual. It is not a
separate PDF. Staff open it from **Guide** / **?** in the POS and platform
shells, or at `/guide`.

Content lives in TypeScript modules so a new feature is a new topic file, not
a CMS.

Public `/guide` describes the product **as it works now** (training week). It
does not document retired demo PIN / seeded-house / Zest stories. Owner HR
flags (`hr-employment`) are overlay-only (`visibility: "signed"`), not public.

## Where things live

| Path | Purpose |
|---|---|
| `src/lib/guide/content/*.ts` | Topics, grouped by chapter |
| `src/lib/guide/catalog.ts` | Chapter list + assembled `GUIDE_TOPICS` |
| `src/lib/whats-new/entries.ts` | Login “Latest updates” feed (not shown on public `/guide`) |
| `src/lib/guide/updates.ts` | Filter + watermark helpers for that feed |
| `src/lib/onboarding/walkthrough-scripts.ts` | Per-role live-UI walkthroughs |
| `src/lib/guide/types.ts` | `GUIDE_VERSION`, roles, block types |
| `src/lib/guide/store.ts` | Overlay open state, progress, silence prefs |
| `src/components/guide/OperatorsGuide.tsx` | Overlay + `/guide` page |
| `src/components/guide/GuideLearnLink.tsx` | Contextual “Learn” control |
| `src/routes/guide.tsx` | `/guide?topic=chargebacks` |
| `docs/whitepaper/` | Shareable white paper (MD + print HTML) |
| `/whitepaper` | Live white paper (prints to PDF) |

Bump `GUIDE_VERSION` in `types.ts` when you ship a batch of topics.
Add a What’s New row in `src/lib/whats-new/entries.ts` (newest first) so the
**signed-in** login popup can show it. Do not add a changelog chapter to the
public guide.

Keep role walkthrough steps in `src/lib/onboarding/walkthrough-scripts.ts`
accurate when the job path changes.

## Public vs Platform

**Public `/guide` (and unsigned overlay)** is operations:

1. What Summex is
2. By establishment type
3. Roles & floor PIN vs back-office password (separate from clock in/out and closeout)
4. Floor, sections, table status, release/accept
5. Menu, modifiers, recipes/ingredients/prep
6. Orders + Order Display System (Start / Bump / notify)
7. Kiosk, waitlist, reservation check-in
8. QR order/pay modes
9. Quantum Payments, cash discount, gift cards
10. Settlement & multi-operator splits / chargeback fee split
11. Reports & AI insights (recommendations, human confirm)
12. Training vs Go live
13. Devices: Change device, split screen, SYOH tablets + Summex terminals
14. Offline / hybrid
15. Staff HR basics (clock vs PIN, time-off and availability if the employer enabled them)
16. Troubleshooting

Exit on the public page returns to marketing home (`/`).

**Platform-only** (`visibility: "platform"` and/or the Platform chapter) renders
only when the viewer is signed in as `platform_admin`:

- CRM / pipeline / quotes / email outbox
- Host onboarding then tenant invite links
- Platform Settings (forms, not JSON)
- Factory reset (danger)
- Training status in the SaaS tenant view
- Go-live ops checklist (Neon, auth URLs, processor approval, reader)
- HR flags only (entity-scoped modules exist; platform never sees SSN / full tax packets)

Do **not** put those internals in the public guide.

Owner / manager (signed-in overlay) also gets the entity HR topic (`visibility: "signed"`): flags, visibility dropdowns, e-sign vs outbox, state packets, I-9 file store. Public `/guide` keeps staff-facing HR basics only.

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

If the topic is SaaS-admin only, set `visibility: "platform"`.

Every topic should include **Why it matters**, **Steps**, and **Related topics**.

3. From a screen, deep-link with:

```tsx
<GuideLearnLink topicId="my-topic">Learn</GuideLearnLink>
```

or `useGuideStore.getState().openGuide("my-topic")`.

Bookmarkable URL: `/guide?topic=my-topic`.

## Current facts (keep copy honest)

- Brand: **Summex**, powered by **Quantum Reach**. Guest cards: **Quantum Payments** only. Never Stripe/Square as a POS processor. Never Zest.
- HR: optional per entity (host or tenant employer). Packets + signed PDF fallback. Clock punches persist. Hours export feeds ADP / Intuit / CSV — Summex does not process payroll. Platform never sees SSN.
- First location = SaaS onboard only. Host onboarded by SaaS; host invites operator tenants.
- Training = practice + Quantum sandbox; optional inventory tracking. Go live now or schedule; owner keep/erase per data class; menus/recipes/staff/settings kept.
- PIN login ≠ clock in/out ≠ server closeout.
- Gift: sale-point issuer or house; redeem settles internally; unredeemed liability on issuer; house cards house-keeps remainder.
- Public marketing: Get pricing, Guide, Sign in — no Dashboard, no Google/X login, no how-to-login on the home page.
- Examples: **Host Venue**, **Operator A**, **Operator B**.
- Chargebacks: **$35** when a dispute is **filed**; split by merchandise %; won/lost does not reverse the fee.
- If a feature is partial, say so (“available in training; live cards require an approved Quantum application”). Do not document vapor as finished.

## Do not say (retired)

- Demo sites, PIN 0000 as public demo, The Laundry seed, Load demo
- Google/X login on marketing
- How-to-login instructions on the home page
- Unauthenticated Dashboard
- Stripe/Square as POS card processors
- Recent-updates feed inside the public guide
- SaaS platform-admin internals in the public guide

## Roles

PIN roles: owner, manager, server, host stand, bartender, kitchen/expo,
busser, cashier, vendor_operator, accountant, kiosk. Platform Admin is SaaS
only — not a floor PIN.

Devices are not fixed roles. **This station** switches Host stand, Server POS,
Expo, Cashier, Busser, Kiosk, or Order Display (and entity on a host floor).

**Offline PWA:** first install needs internet. Thereafter cold start can be
offline: cash & tickets queue; cards when the processor allows (blocked if
offline). `/guide?topic=wifi-offline`.

User-facing name is **Order Display / ODS** (not KDS). Internal ids may still
say `kds`.

## What’s new on login

After auth + role/location resolve, a **Latest updates** popup lists matching
entries. Filter: `roles`, `entityTypes`, `surfaces`, optional `audience`
(`platform` never reaches location staff). Close, or **Silence until the next
update**. Empty feed: no popup. This feed is **not** a chapter in public `/guide`.

## Role walkthroughs

Optional walkthroughs run on a **real onboarded location**. Catalog demo tours
that required seeded tenants are retired. Unknown tour ids toast **Tour not
available**.

## Print

The overlay and `/guide` page hide chrome under `@media print`.
