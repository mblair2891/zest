# Local print agent (LAN ESC/POS)

Paired **Summex Station** (Android) writes raw TCP 9100 from the native shell.
The WebView is HTTPS and cannot open 9100 to the house LAN.

Laptop Chrome still cannot TCP 9100. Those desks run this small agent on the
house hub (the same PC or NUC that stays on the staff SSID). If neither the
station plugin nor the agent succeeds: **Use a paired station or print agent.**

```sh
node scripts/print-agent.mjs
```

Listens on `http://127.0.0.1:9105`.

| Method | Path | Body |
| --- | --- | --- |
| GET | `/health` | — |
| POST | `/print` | `{ target, family, connection, escposBase64, job, printerId, locationId }` |

`target` is `host` or `host:port` (default **9100**). The agent writes the
raw ESC/POS or Star Line bytes to the printer and returns `{ ok: true }`.

POS looks for the agent at `http://127.0.0.1:9105`. Override in this browser:

```js
localStorage.setItem("summex-print-agent", "http://192.168.1.10:9105")
```

**Test print never opens `window.print` or the OS dialog** (no Brother laser
popup). If the agent is down, Devices tries a raw TCP write from the app host
when that host is on the staff LAN. If both fail, the row shows unreachable.

Certified families: **Star Micronics** (SP700/SP742 impact, TSP100/143,
TSP650, mC-Print), **Epson** (TM-T88, TM-T20, TM-m30, TM-U220), **Citizen**,
**Bixolon**. Generic ESC/POS (80mm) is the fallback. Star Line Mode is a
Star generic preset.
