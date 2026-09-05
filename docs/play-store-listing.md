# Google Play listing draft — Summex Station

**Do not submit this pass.** This file is the packagable listing copy. Upload when product is ready.

**Application ID:** `app.summex.pos`  
**App name:** Summex Station  
**Default experience:** generic station shell at `https://summex.app/station` — pair first, then PIN. No venue is baked into the binary.

**Privacy policy URL:** https://summex.app/privacy

## Short description (80 chars)

Staff POS for restaurants. Pair once, then PIN. Order, kitchen, or host stand.

## Full description

Summex Station is the staff tablet app for restaurants, food halls, and related venues.

Install once. On first open, enter the venue code or scan the QR from the owner Devices screen. The tablet stores the venue and its role:

• Order — handhelds and bar  
• Order Display — kitchen tickets (Start and Bump)  
• Host — floor map, seat, and to-go  

After pair, the tablet is PIN only. App updates do not wipe pairing.

Guests pay and scan table QR codes in the ordinary browser — not this app. Cards run through Quantum Payments on the venue’s merchant account. The app does not store card numbers. No advertising SDKs.

Requires network access to Summex for first pair and for live cards. Cached service can continue on the house Wi‑Fi when the uplink is down.

Built by Michael Blair & Andy Baida.

## Category

Business

## Screenshots needed

1. Pair screen (venue code)  
2. PIN pad  
3. Order / floor  
4. Kitchen Order Display  
5. Host stand  

## Data safety (Play form)

- App does not share data with third-party advertisers
- Venue pairing and staff PIN stay with the venue
- Card numbers are not collected by this app
- Approximate location is not required

## Release (packaging only — do not upload yet)

```bash
# Store binary is generic. Do not bake a station role.
npm run android:config:clear
npm run android:sync
cd android && ./gradlew bundleRelease
```

Sideload (LAN / training) is a different path — see `native/README.md` and the root README.
