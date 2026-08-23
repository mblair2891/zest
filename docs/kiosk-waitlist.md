# Kiosk, waitlist, reservation check-in

Guest surface: `/kiosk` (optional `?loc=`). Combined tabs: Order | Check in | Waitlist.

## Settings (location)

- `kioskMode`: `order` | `checkin` | `combined`
- `waitlistEnabled`
- `waitlistReason`: kitchen_backed_up | short_kitchen_staff | short_floor_staff | at_capacity | custom
- `smsFrom` (optional override)

## Messaging

No keys required. Missing keys → **sandbox** (Host stand message log + server log).

Optional live SMS:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

Optional email:

- `RESEND_API_KEY`
- `RESEND_FROM`

Do not commit a `.env`. Platform injects secrets on deploy.

## Wait estimate

`estimateWaitMinutes` uses waitlist reason, party count, kitchen ticket depth, and open tables. If `XAI_API_KEY` is set it may refine the range; otherwise a heuristic. Display is a range (about 25–35 min), not a fake exact minute.

## Demo check-in

Last name **Blair**, code **K7M2**.
