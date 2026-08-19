# Google Play listing draft — Zest

**Application ID:** `app.zest.pos`  
**Default experience:** Zest Store (`/apps`) — install/open station apps

## Short description (80 chars)
Zest Store — restaurant POS stations for floor, kitchen KDS, bar & platform.

## Full description
Zest is the hospitality OS for restaurants, food halls, and truck pods.

Open the **Zest Store** on your Android tablet or kitchen display, then install the station you need:

• Zest Floor — tables & service  
• Zest Kitchen — expo KDS (great on large touchscreens)  
• Zest Bar — bar rail & Drink AI  
• Zest Manager / Owner — HQ, labor, settlement  
• Zest Platform — SaaS multi-location control  

Built by Michael Blair & Andy Baida.

Requires network access to your Zest cloud or on-prem host.

## Category
Business

## Screenshots needed
1. Zest Store home  
2. Kitchen KDS  
3. Floor plan  
4. Settlement / hall  
5. Platform packages  

## Privacy
Staff PIN auth; no ad SDKs in shell. Payment card data via Stripe Terminal when enabled (not stored by Zest app).

## Release
```bash
# configure production HTTPS URL in native/zest-native.json
npm run android:sync
cd android && ./gradlew bundleRelease
```
