# Summex test fleet playbook — 2× Galaxy tablet + 27″ Android touch

## Your devices

| Device | Role in test | Login | After login open |
|---|---|---|---|
| **Galaxy tablet A** | Server / floor | Jordan Lee (Server) or PIN `1111` | Floor → seat & order |
| **Galaxy tablet B** | Bar **or** Manager | Casey (`3333`) or Alex (`0000`) | Bar ODS **or** HQ |
| **27″ Android touch** | Kitchen expo ODS | Morgan Diaz (Kitchen) `5555` | Kitchen (use link below) |

Optional 4th browser on a laptop: **Owner** `9999` or **Platform** at `/platform`.

---

## One-time setup (each device)

1. Same Wi‑Fi as each other (not guest-isolated if you can avoid it).
2. Chrome (recommended) → open your Summex URL (e.g. production host or preview).
3. **Add to Home screen** (Chrome menu → Install app / Add to Home screen) so it feels like a POS, not a browser tab.
4. Display settings:
   - **Tablets:** landscape, brightness high, sleep = 30 min or Never while charging.
   - **27″:** landscape, max brightness, sleep Never / stay awake while charging, font size Default (not huge).
5. Disable annoying popups: Chrome notifications for the site = Block if not needed.

### Bookmark cheats (deep links)

After the app is loaded once, these help:

| Station | Path |
|---|---|
| POS home | `/` |
| Kitchen ODS (27″) | `/?station=kitchen` |
| Bar ODS | `/?station=bar` |
| Floor | `/?station=floor` |
| Order | `/?station=order` |
| Platform SaaS | `/platform` |

`station=` applies **after** staff login (and only if that role may open the view).

---

## Recommended 30‑minute smoke script

### A — Tablet A (Server)
1. Quick login **Server**.
2. Floor → seat a table → add items from **2+ vendors** → Send.
3. Print check → Pay (cash or simulated card).
4. Confirm table goes paid/dirty.

### B — 27″ (Kitchen)
1. Login **Kitchen** (or open `/?station=kitchen` after login).
2. See tickets from Tablet A.
3. Start → Bump one ticket.
4. Confirm timer/vendor labels readable at arm’s length.

### C — Tablet B (Bar)
1. Login **Bartender** → Bar.
2. Fire a drink from Tablet A (or order on B).
3. Optional: Drink AI questionnaire.

### D — Cross-role
1. Tablet B as **Manager** → Labor rules glance, Settlement preview.
2. Phone or laptop → `/platform` → Hardware policy / package toggles.

---

## Package preview (dev)

On any POS device, header **Package preview**:
- `Location packages` = real entitlements  
- `Only: ODS` / `Only: Drink AI` etc. = see that module’s menu through the current role  

---

## If something feels wrong on Android

| Symptom | Fix |
|---|---|
| Tap misses buttons | Use Chrome, not in-app Instagram/Facebook browser |
| Keyboard covers PIN | Rotate landscape; scroll |
| ODS text small on 27″ | Browser zoom 110–125% once, then Add to Home screen |
| Sleep mid-service | Display → Sleep → 30 min / Never while plugged in |
| Stale UI | Pull to refresh or close PWA and reopen |
| Login loop / snag | Platform or POS → reset demo data / clear site storage |

---

## Card hardware

Your three screens are **compute only**. Live cards still need **Stripe Terminal** later (M2/S700). Testing payments in demo = simulated tenders on the Order → Pay dialog.
