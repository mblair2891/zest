# Local print agent (LAN ESC/POS)

Browsers cannot open raw TCP 9100. SYOH sites print today with **window.print**.
Houses with Star / Epson LAN printers run this small agent on the house hub
(the same PC or NUC that stays on the staff SSID).

```sh
node scripts/print-agent.mjs
```

Listens on `http://127.0.0.1:9105`.

| Method | Path | Body |
| --- | --- | --- |
| GET | `/health` | — |
| POST | `/print` | `{ target, family, connection, escposBase64, job, printerId, locationId }` |

`target` is `host` or `host:port` (default **9100**). The agent writes the
ESC/POS bytes to the printer and returns `{ ok: true }`.

POS looks for the agent at `http://127.0.0.1:9105`. Override in this browser:

```js
localStorage.setItem("summex-print-agent", "http://192.168.1.10:9105")
```

If the agent is down, or the printer is set to **This browser**, Summex opens a
80mm ticket in `window.print`. Bluetooth printers use the same payload; map the
device in the agent host OS (or keep connection = browser until the agent can
see it).

Certified families: **Star Micronics** (mC-Print3, TSP100/143, mPOP) and
**Epson** (TM-T88, TM-T20, TM-m30). Generic ESC/POS is best-effort.
