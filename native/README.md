## Default: Zest Store

The Android shell opens **`/apps`** — an app-store style hub to install/open Floor, Kitchen, Bar, Platform, etc.

# Zest Android (Capacitor)

Native **Android shell** around the Zest web POS — one product, installable APK for Galaxy tablets and the 27″ KDS.

## Requirements (build machine)

- Node 20+
- [Android Studio](https://developer.android.com/studio) (JDK 17)
- Android SDK 34+, build-tools
- USB debugging on tablets **or** download APK and sideload

## Configure target URL

Edit `native/zest-native.json`:

```json
{
  "url": "http://192.168.1.20:8080",
  "station": "",
  "cleartext": true
}
```

| Field | Meaning |
|---|---|
| `url` | Live Zest origin (LAN IP while developing, HTTPS in prod) |
| `station` | Optional: `kitchen`, `bar`, `floor`, `order`… |
| `cleartext` | `true` if using `http://` |

Emulator → host machine: `http://10.0.2.2:8080`  
Physical tablet → your PC’s LAN IP: `http://192.168.x.x:8080`

## Commands

```bash
# From repo root
npm run android:sync          # refresh Capacitor + Android project
npm run android:open          # open Android Studio
npm run android:apk           # assemble debug APK (needs SDK)

# Station-specific config helpers
npm run android:config:kds    # station=kitchen for 27″
npm run android:config:floor  # station=floor for server tablet
npm run android:config:bar    # station=bar
```

Debug APK path (after assemble):

`android/app/build/outputs/apk/debug/app-debug.apk`

## Device setup

1. Set `url` to a host the tablet can reach.
2. `npm run android:sync && npm run android:apk` (or Open in Android Studio → Run).
3. Install APK on Galaxy A / B / 27″.
4. Login with role PINs; KDS build should land on Kitchen when `station=kitchen`.

## Keep screen on (KDS)

MainActivity enables `FLAG_KEEP_SCREEN_ON` so the 27″ does not sleep mid-service.

## Play Store later

- Create upload keystore
- `cd android && ./gradlew bundleRelease`
- Play Console listing for `app.zest.pos`

## Not in this shell yet

- Stripe Terminal native SDK (use web Terminal when processing is live)
- USB printer plugins (prefer LAN Star/Epson from the web app)
