# Summex Android station shell (kiosk)

Staff tablets run **Summex only**. This Capacitor APK is a kiosk POS: lock-task (or screen pinning), boot into Summex, no launcher escape. Guest QR / pay links stay in the **browser** — never this APK.

Station roles: **host** | **order** | **ods**. The WebView loads `https://summex.app/?station=…` (PIN pad, never `/login`).

## Requirements (build machine)

- Node 22+
- [Android Studio](https://developer.android.com/studio) (JDK 17)
- Android SDK 34+, build-tools
- USB debugging **or** sideload the APK

## Configure

Edit `native/summex-native.json`:

```json
{
  "url": "https://summex.app",
  "station": "order",
  "cleartext": false
}
```

| Field | Meaning |
|---|---|
| `url` | Live origin (`https://summex.app` in production; LAN `http://192.168.x.x:8080` while developing) |
| `station` | `order` (handhelds / bar), `ods` (kitchen tickets), `host` (floor + to-go). Opens `/?station=` then `/station`. |
| `cleartext` | `true` only for `http://` |

## Two APKs (host vs order)

Build a **host** APK and an **order** APK. Same shell, different default station. ODS uses the same recipe when you need a kitchen wall.

```bash
# Order — handhelds and bar
npm run android:config:order
npm run android:sync
npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk  (rename summex-order.apk)

# Host — host stand (floor + to-go)
npm run android:config:host
npm run android:sync
npm run android:apk
# → rename summex-host.apk

# ODS — 27″ kitchen / bar tickets (same shell)
npm run android:config:ods
npm run android:sync
npm run android:apk
```

`npm run android:open` opens Android Studio.

## Training: Samsung pin-windows

On a Galaxy tablet that is **not** Device Owner:

1. Install the station APK. Set Summex as the Home app when Android asks (optional but recommended).
2. Open Summex. The first lock-task request is **screen pinning** (Pin windows). Confirm.
3. Status bar stays hidden. Back does not return to the launcher; it only walks WebView history.
4. To unpin for a manager: the usual Samsung pin-windows gesture (often Recents + Back together) — only while training.

## Production: Device Owner / Knox

Silent lock-task (no pin prompt), boot straight into Summex, Home/Recents blocked:

```bash
# USB, after a factory-reset tablet with no Google account
adb shell dpm set-device-owner app.summex.pos/.SummexDeviceAdminReceiver
adb shell dpm set-lock-task-packages app.summex.pos app.summex.pos
```

Knox / EMM: whitelist `app.summex.pos` for lock-task / kiosk, set it as the default Home, disable status bar. Same APK.

`RECEIVE_BOOT_COMPLETED` starts `MainActivity` after reboot. On Android 10+ that start is reliable as Device Owner or default Home.

## Kiosk behavior

- Remote URL in the WebView (`server.url`). Capacitor `triggerEvent` is shimmed so a late bridge inject does not black-screen.
- Lock task on start (pin fallback). Immersive status / nav bars.
- Keep screen on (ODS / floor).
- Back never leaves Summex.
- Guest/QR stays browser.

## Play Store later

- Create upload keystore
- `cd android && ./gradlew bundleRelease`
- Play Console listing for `app.summex.pos`
