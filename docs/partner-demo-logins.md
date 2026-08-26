# Partner demo — The Laundry

Internal sales / partner login sheet. **Not a public demo site.** Do not put
these credentials on the marketing homepage.

Tagged in the database as `is_partner_demo` (not `is_demo`). Factory reset
wipes business data, keeps Platform Admin, then reseeds this location.
Demo-tenant purge does **not** delete it.

Shared back-office password: **`PartnerDemo1!`**  
Must-change-password is **off**. Sign-in is username or email.

Auth is email-based. Username without `@` maps to `@demo.summex.app`
(e.g. `laundry.owner` → `laundry.owner@demo.summex.app`).

Platform Admin is unchanged (do not use these accounts as Admin).

---

## Location

| | |
|---|---|
| Guest-facing brand | The Laundry |
| Org | The Laundry Group |
| Model | Host + operators |
| Operators | Steam Distillery (bar) · Diamond House BBQ (kitchen) |
| Floor | Dining 1–6 · Barstools B1–B4 |

One guest check under The Laundry. Drink lines tag Steam Distillery (bar ODS).
Food lines tag Diamond House BBQ (kitchen ODS).

---

## Back office (password)

| Brand | Username | Email | Role |
|---|---|---|---|
| Host | `laundry.owner` | laundry.owner@demo.summex.app | Owner |
| Host | `laundry.manager` | laundry.manager@demo.summex.app | Manager |
| Host | `laundry.host` | laundry.host@demo.summex.app | Host stand |
| Host | `laundry.accountant` | laundry.accountant@demo.summex.app | Reports |
| Steam Distillery | `steam.owner` | steam.owner@demo.summex.app | Entity manager |
| Steam Distillery | `steam.bartender` | steam.bartender@demo.summex.app | Bartender |
| Diamond House BBQ | `diamond.owner` | diamond.owner@demo.summex.app | Entity manager |
| Diamond House BBQ | `diamond.kitchen` | diamond.kitchen@demo.summex.app | Kitchen / expo |

Password for every row: `PartnerDemo1!`

---

## Floor PIN (4-digit, hashed)

Time clock is separate from PIN login.

### Host / floor

| Station | PIN |
|---|---|
| Owner | 1000 |
| Manager | 1001 |
| Host stand | 1100 |
| Server 1 | 2001 |
| Server 2 | 2002 |
| Expo | 2100 |
| Busser | 2200 |
| Cashier | 2300 |

### Steam Distillery

| Station | PIN |
|---|---|
| Bar manager | 3000 |
| Bartender | 3001 |

### Diamond House BBQ

| Station | PIN |
|---|---|
| Kitchen manager | 4000 |
| Cook | 4001 |

---

## How to test

1. Sign in as `laundry.owner` (or laundry.owner@demo.summex.app) with `PartnerDemo1!`.
2. Open POS for **The Laundry**. Floor PIN pad is shown (not auto-signed in as owner).
3. Enter PIN **2001** (Server 1).
4. Seat a dining table. Order **House Highball** (Steam Distillery / bar) and **Brisket plate** (Diamond House BBQ / kitchen).
5. Send. Bar ODS shows the drink. Kitchen ODS shows the food. One guest check under The Laundry; lines tagged to the operator.
