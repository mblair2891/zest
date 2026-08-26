import { p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const DEVICE_TOPICS: GuideTopic[] = [
  topic({
    id: "wifi-offline",
    chapterId: "devices",
    title: "Offline mode",
    summary: "What still runs when internet is down, what waits, and how sync works.",
    roles: "all",
    keywords: ["wifi", "offline", "outbox", "network", "ssid", "internet", "queue"],
    openView: "settings",
    blocks: [
      why(
        "A dead ISP should not kill dinner. Summex is Wi‑Fi-first: stations talk on the staff SSID. Core service stays on the device even when the uplink is gone.",
      ),
      p(
        "The header banner says Offline — changes will sync when back online, or Syncing… when the outbox is flushing. No internet is not the same as no house hub: the Wi‑Fi chip distinguishes a missed API heartbeat from a down access point.",
      ),
      ul(
        "Works offline (cached location): menu, modifiers, tables/sections, staff switcher, open checks, ODS tickets on this station.",
        "Allow: create/edit orders, send to kitchen/bar (local queue), bump tickets, seat cached tables, cash tender, waitlist add (SMS pending send).",
        "Needs internet: Quantum Payments live card-present, SMS/email send, cloud reporting AI, SaaS admin and billing.",
        "Card: blocked with “Card requires connection.” Take cash or keep the check open. Card is not queued and never fakes a live Visa.",
        "Tickets are live across devices when online: every POS and ODS at the location shares the same open checks, sends, Start/Bump, table status, and cash payments (server wins on refresh). Offline, this station still runs from its cache and queues mutations; we do not pretend two tablets share a check with no internet.",
      ),
      steps(
        "First install (internet required): sign in, Open POS, wait for the floor. Add to Home Screen from that station.",
        "Thereafter cold start can be offline: power the tablet, tap the Summex icon — no typing a URL. PIN in. Banner: Offline.",
        "Seat, send a ticket, Start and Bump. Take cash. Card shows Card requires connection.",
        "When WAN returns, banner says Syncing… Outbox applies orders and ticket status once.",
      ),
      shot(
        "Header Wi‑Fi chip — Simulate internet outage, outbox, failed sync list.",
        "Network sheet with house SSID, queued cash ledger, and dead-letter rows.",
      ),
      warn(
        "First install requires internet. After that, cold start (power on, no WAN, tap the icon) opens the station PIN pad with cached menu, floor, PINs, and open checks. Unprimed devices cannot start offline.",
      ),
      tip(
        "Owner / manager: watch Failed to sync. Server / cashier: cash is the offline tender. Kitchen: bump locally. Host: waitlist SMS is pending send.",
      ),
      related("printers-kds", "quantum-payments", "troubleshooting", "kds", "cash-handling", "network-readiness"),
    ],
  }),
  topic({
    id: "printers-kds",
    chapterId: "devices",
    title: "Printers & ODS devices",
    summary: "Register Star/Epson printers, assign kitchen/bar/receipt/expo, test print.",
    roles: ["owner_manager", "kitchen_bar", "platform_admin"],
    keywords: ["printer", "kds", "device", "station", "android", "tablet", "star", "epson", "escpos", "receipt"],
    openView: "settings",
    blocks: [
      why(
        "Tickets and chits are devices on the staff SSID. If an ODS is on guest Wi‑Fi, it will look “down” while the floor is fine. A printer that is only in a catalog cannot fire a kitchen ticket.",
      ),
      steps(
        "Dashboard → Hardware (or Location settings). Add printer. Name it (Kitchen 1).",
        "Model family: Star Micronics, Epson, or generic ESC/POS. Connection: This browser (SYOH today), LAN, or Bluetooth.",
        "Assign Prints: Kitchen tickets, Bar tickets, Guest receipt, or Expo / bump chit. Entity = host or one operator.",
        "LAN: enter IP (default port 9100). Run the house print agent on the hub: node scripts/print-agent.mjs — browsers cannot open raw sockets.",
        "Tap Test print. You should see a Summex test chit (browser dialog or the physical printer).",
        "Send from POS prints kitchen/bar. Bump/Ready prints expo. Pay or Check prints the guest receipt.",
      ),
      ul(
        "Supported: Star mC-Print3, TSP100/143, mPOP; Epson TM-T88, TM-T20, TM-m30. Others: generic ESC/POS, best-effort.",
        "SYOH: connection = This browser. window.print opens an 80mm ticket. No agent required.",
        "LAN raw: local agent POST /print { target, escposBase64 }. If the agent is down, Summex falls back to the browser dialog.",
        "SYOH tablets and phones run POS/ODS. Live cards still use a supplied Quantum reader — not the tablet keypad.",
      ),
      tip(
        "Override the agent URL in this browser: localStorage.setItem(\"summex-print-agent\", \"http://192.168.1.10:9105\"). Details: docs/PRINT-AGENT.md.",
      ),
      warn(
        "There is no separate “ODS appliance OS.” Hardware is not a locked role. Do not take live cards on a SYOH tablet keypad.",
      ),
      related("wifi-offline", "kds", "navigation", "host-operator-settings", "station-switcher"),
    ],
  }),
  topic({
    id: "device-assignment",
    chapterId: "devices",
    title: "Assign devices to any entity",
    summary: "Tablets, ODS, kiosks, and printers are location assets. Suggested assignment is a default — not a locked role.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "kitchen_bar"],
    keywords: ["device", "tablet", "kds", "kiosk", "assignment", "claim code", "steam", "diamond"],
    openView: "settings",
    blocks: [
      why(
        "Hardware is not branded to a stall. The host location owns the registry. Any tablet, Android touchscreen, or desktop can run Steam POS this week and Diamond ODS next week — This station switches the screen without a new login.",
      ),
      ul(
        "Type: tablet POS, order display, kiosk, printer, host stand, other.",
        "Suggested assignment: operator (host or a guest entity) + function (floor POS, bar POS, kitchen ODS, bar ODS, expo, kiosk, host stand, cashier).",
        "This station (header): switch Host stand, Server POS, Expo, Cashier, Busser, Kiosk, or Order Display. Multi-op houses pick Host / Steam Distillery / Diamond House BBQ.",
        "PIN still identifies the person. Station switch is what this screen is showing. Last station is remembered in this browser.",
        "ODS only shows tickets for that station and entity unless the host grants a broader view_tickets.",
      ),
      steps(
        "Dashboard → Devices (or Settings → Devices): Add a named slot — name, type, entity, function (server, host, kitchen ODS, bar ODS, split, cashier, expo, busser, kiosk).",
        "On the Samsung tablet or wall display: Pair this browser, or enter the slot’s claim code. This browser id stays in localStorage.",
        "This station (header or PIN pad) switches function and entity. Last station is remembered on this device.",
        "Large displays: Layout → Split. Each pane has its own station + entity (typical: kitchen | bar ODS). 50/50 or 70/30. Tap a pane title to fullscreen.",
      ),
      warn(
        "A Diamond ODS does not show Steam tickets unless the host grants Diamond view_tickets on Steam. Devices are not fixed roles.",
      ),
      related("station-switcher", "host-operator-settings", "printers-kds", "role-vendor", "partner-demo"),
    ],
  }),
  topic({
    id: "station-switcher",
    chapterId: "devices",
    title: "This station & split screen",
    summary:
      "Any device can switch into any allowed function. Large displays split two ODS/POS panes.",
    roles: "all",
    keywords: [
      "this station",
      "split screen",
      "ods",
      "kds",
      "android",
      "tablet",
      "wall display",
      "kitchen",
      "bar",
    ],
    openView: "kitchen",
    blocks: [
      why(
        "Samsung tablets, Android touchscreens, and desktops are the same product. Hardware is not a locked role. This station is what the screen is showing; PIN is who is signed in.",
      ),
      ul(
        "This station: Host stand, Server POS, Expo, Cashier, Busser, Kiosk, Kitchen ODS, Bar ODS, Bar POS.",
        "Multi-operator: pick Host, Steam Distillery, or Diamond House BBQ. Tickets stay location-scoped and tagged to the operator.",
        "Last station is remembered in this browser (next load).",
        "Split: two independent panes, each with its own station + entity. Typical left Kitchen ODS (Diamond), right Bar ODS (Steam).",
        "Optional 70/30. Tap a pane header to fullscreen that pane; Back to split returns.",
        "No special device SKU — any device may enable split.",
      ),
      steps(
        "Pair the display in Devices first (or Pair this browser). Open POS stays on this host — not a separate app origin.",
        "Open This station in the header (or on the PIN pad).",
        "Pick the function. On a host house, pick the entity. Last choice is remembered here.",
        "On a wall display: Layout → Split. Set each pane independently. Start / Bump on each rail.",
        "Tap a pane title to focus it. Tap Back to split when both rails are needed.",
      ),
      warn(
        "Station switch does not clock you in or change the location. Time clock is a separate punch. Guest checks stay under the host brand.",
      ),
      related("device-assignment", "printers-kds", "kds", "floor-pin-login", "location-training"),
    ],
  }),
];
