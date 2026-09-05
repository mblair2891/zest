# Summex Station — Android shell (kiosk)

Staff tablets run **Summex only**. This Capacitor APK is a kiosk POS: lock-task (or screen pinning), boot into Summex, no launcher escape. Guest QR / pay links stay in the **browser** — never this APK.

**One app:** `app.summex.pos`, display name **Summex Station**. Station roles: **host** | **order** | **ods**. Role is chosen at pair time, not baked into a Play binary.

## Play vs sideload

| | Play (store) | Sideload (local) |
|---|---|---|
| Config | `station` empty, `sideload: false` | `android-config` sets `sideload: true` + a role |
| WebView | `https://summex.app/station` | LAN origin with `/?station=` |
| First run | Pair screen (venue code / QR from Devices) | Same pair screen unless already primed |
| Location in APK | Never | Never (role only, and only for LAN) |
| After pair | PIN pad. Updates keep pairing. | PIN pad |

Do **not** submit to Play from a sideload config. Clear before a store bundle:

```bash
npm run android:config:clear
npm run android:sync
cd android && ./gradlew bundleRelease
```

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
  "station": "",
  "cleartext": false,
  "sideload": false
}
```

| Field | Meaning |
|---|---|
| `url` | Live origin (`https://summex.app` in production; LAN `http://192.168.x.x:8080` while developing) |
| `station` | Sideload only: `order` / `ods` / `host`. Play leaves this empty. |
| `sideload` | `true` only when baking a station role for local LAN. Store builds stay `false`. |
| `cleartext` | `true` only for `http://` |

## Sideload (local LAN)

```bash
# Order — handhelds and bar
npm run android:config:order
npm run android:sync
npm run android:apk
# → android/app/build/outputs/apk/debug/app-debug.apk

# Host — host stand (floor + to-go)
npm run android:config:host
npm run android:sync
npm run android:apk

# ODS — kitchen / bar tickets
npm run android:config:ods
npm run android:sync
npm run android:apk
```

`npm run android:open` opens Android Studio.

## Pair, then PIN

1. Owner: Devices → add a slot (Order / Order Display / Host). Show the 6-character code or QR.
2. Tablet: first open of Summex Station → enter the code or scan the QR.
3. The tablet stores venue id + station role locally. Thereafter: power on → PIN pad.
4. App updates do not wipe pairing (`app.summex.pos` stays the same).

## Training: Samsung pin-windows

On a Galaxy tablet that is **not** Device Owner:

1. Install Summex Station. Set it as the Home app when Android asks (optional but recommended).
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
