# Onboard a host location with multiple operators

This path is entirely in the SaaS UI. The app starts empty — there is no demo restaurant to pick. Do **not** edit seed data or ask an engineer to create the venue.

Placeholder names below are **documentation only**. Use any names you want in the product.

Guest charges always run under the **host brand** through **Quantum Payments**. Operators are merchants on the check, not card processors.

---

## Vercel preview — click path

1. Open **`/login`**. Sign in as **Admin** / **password**.
2. You **must** change the password before SaaS opens (new password cannot be `password`).
3. You land on **Host setup** (empty — 0 organizations).

### 1. Create a new organization

4. Under **1. Organization**, enter:
   - Organization name: `Host Venue Co` (or any name)
   - Optional legal name / billing email
5. Click **Create organization**.
6. Confirm the new org is the active chip.

### 2. Create a host + multi-operator location

7. Under **2. Location & host brand**:
   - Location name: `Host Venue`
   - Host brand: `Host Venue` (guest-facing name on checks and Quantum Payments)
   - Operating model: **Host + multiple operators**
   - Venue type: Restaurant (or any type)
8. Click **Create location**.

### 3. Add two operators

9. Under **3. Operators**, add **Operator A**:
   - Name: `Operator A`
   - Payout account label: `Operator A checking`
   - Account last 4: `1111`
   - Station: **Bar**
10. Click **Add operator**.
11. Add **Operator B**:
    - Name: `Operator B`
    - Payout account label: `Operator B operating`
    - Account last 4: `2222`
    - Station: **Kitchen**
12. Click **Add operator**.

### 4. Menu routing

13. Click **Generate starter catalog**.
    - Creates generic **Drinks** (bar) and **Kitchen** (kitchen) categories plus a few generic items (House cocktail, House plate, …).
    - Routes Drinks → Operator A (bar) and Kitchen → Operator B (kitchen).
14. Optionally tick/untick categories under **Who owns what**, or add your own categories/items.

Ready when badges show: host brand set · 2 operators · items routed.

### 5. Open POS and ring one check

15. Click **Open POS for Host Venue**.
16. Quick-login **House Owner** (PIN `9999`) so you can ring the check and open Settlement in one session. Floor Server (`1111`) can also ring; Settlement is under owner/manager.
18. On the check:
    - Filter **Operator A** → add a drink (House cocktail).
    - Filter **Operator B** → add a plate (House plate).
19. Confirm the check shows **one check** with both operator tags.
20. Click **Send**. Tickets split:
    - Bar display (`Bar` nav) → Operator A drink
    - Kitchen display (`Kitchen` nav) → Operator B plate
21. Click **Pay**. Card tender:
    - Brand is **Host Venue**
    - Processor is **Quantum Payments** (not Stripe/Square)
22. Complete the payment.

### 6. Settlement

23. Open **Settle** in POS nav (owner/manager). If you rang as Floor Server, log out and sign in as House Owner.
24. Open period shows:
    - Operator A merchandise share + payout to `Operator A checking ••1111`
    - Operator B merchandise share + payout to `Operator B operating ••2222`
    - Host fees / host cut under the host brand
25. **Close period & generate payouts**. Electronic payouts are addressed to each operator’s account placeholder (no live ACH).

---

## What the product stores

| Concept | Where you set it | What it does |
|---|---|---|
| Organization | Host setup → Create organization | Tenant container |
| Location | Create location | POS site |
| Operating model | Host + multiple operators | One guest check, multi-merchant settlement |
| Host brand | Host brand name | Name on checks, receipts, Quantum Payments |
| Operator | Name + payout last-4 + station | Merchant on the check; payout destination placeholder |
| Routing | Station type + owned categories/items | Tickets to bar, kitchen, or both |
| POS | `/pos/{locationId}` | Floor / order / KDS / pay / settle |

Create APIs live in the SaaS store (durable in the browser on preview): `createOrganization`, `createLocation`, `addOperator`, `setOperatorRouting`, `addLocationCategory`, `addLocationItem`, `generateStarterCatalog`, `applySaasLocation`.

---

## Staff PINs (new host locations)

| Role | PIN |
|---|---|
| Owner | 9999 |
| Manager | 0000 |
| Floor Server | 1111 |
| Kitchen Station | 2222 |
| Bar Station | 3333 |

These staff records are generated for the location you created. They are not tied to a seeded restaurant name.
