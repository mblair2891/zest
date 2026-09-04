# Summex project instructions

Follow these with the same priority as `AGENTS.md`.

## Operators Guide is part of the product

Any **POS, payments, devices, cash, tips, HR, or SaaS behavior change** MUST update, **in the same commit**: (1) matching Operators Guide sections by entity/role, (2) the product white paper, (3) demos if station/guest flow changed.

- Authoring: `docs/operators-guide.md`
- Topics: `src/lib/guide/content/*.ts` (assembled in `src/lib/guide/catalog.ts`)
- White paper: `docs/whitepaper/` (MD + print HTML) and `public/whitepaper.html` (served at `/whitepaper`)
- Bump `GUIDE_VERSION` and `GUIDE_REVISION` in `src/lib/guide/types.ts` when you ship a batch
- What’s New (`src/lib/whats-new/entries.ts`) is signed-in only — not a public `/guide` changelog
- Landing Guide link stays operator-only (`/guide`). No SaaS CRM in the public guide or white paper. No “how to log in.”

### Audience

- Guide is by **establishment type** and **role** (order / ODS / host / owner).
- **Public `/guide` is operations only.** No SaaS-platform internals (CRM, pipeline, factory reset, tenant wipe, billing keys).
- **No “how to login with Google.”** Marketing Sign in is account email/password. Floor is PIN. Owner password is back office. PIN ≠ clock-in ≠ server closeout.

### Facts to keep honest

- Guest cards: **Quantum Payments** (Finix rail). Guest UI never names Finix. Each entity is its own merchant; one guest check; receipt itemized by vendor; Finix pays each operator their share.
- Gift cards: **Summex house ledger** — swipe / scan / key. Not Finix.
- Device roles: **order** (handhelds + bar), **ODS** (kitchen), **host** (floor map + to-go). PIN first on the station — not `/login`.
- Printers: Ethernet on the **AP LAN** (not printer Wi‑Fi). Thermal receipts (Epson TM-T20). Impact kitchen (Epson TM-U220). Drawer kick on the receipt printer.
- Summex does not process payroll. Staffing recs never auto clock-out.

Do not ship a behavior change without the matching topic, steps, and related links.