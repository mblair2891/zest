# Google Play listing draft — Summex

**Application ID:** `app.summex.pos`  
**Default experience:** Summex Store (`/apps`) — install/open station apps

## Short description (80 chars)
Summex Store — restaurant POS stations for floor, kitchen KDS, bar & platform.

## Full description
Summex is the hospitality OS for restaurants, food halls, and truck pods.

Open the **Summex Store** on your Android tablet or kitchen display, then install the station you need:

• Summex Floor — tables & service  
• Summex Kitchen — expo KDS (great on large touchscreens)  
• Summex Bar — bar rail & Drink AI  
• Summex Manager / Owner — HQ, labor, settlement  
• Summex Platform — SaaS multi-location control  

Built by Michael Blair & Andy Baida.

Requires network access to your Summex cloud or on-prem host.

## Category
Business

## Screenshots needed
1. Summex Store home  
2. Kitchen KDS  
3. Floor plan  
4. Settlement / hall  
5. Platform packages  

## Privacy
Staff PIN auth; no ad SDKs in shell. Payment card data via Stripe Terminal when enabled (not stored by Summex app).

## Release
```bash
# configure production HTTPS URL in native/summex-native.json
npm run android:sync
cd android && ./gradlew bundleRelease
```
