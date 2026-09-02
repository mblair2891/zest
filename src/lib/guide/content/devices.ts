import { p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const DEVICE_TOPICS: GuideTopic[] = [
  topic({
    id: "device-roles",
    chapterId: "devices",
    title: "Device roles: order, ODS, host",
    summary:
      "Three screens: order-taking (handhelds + bar), kitchen ODS, host hybrid (floor map + to-go). PIN first — not /login.",
    roles: "all",
    keywords: [
      "device role",
      "order",
      "ods",
      "host",
      "handheld",
      "bar",
      "kitchen",
      "to-go",
      "pin",
      "change device",
      "station",
    ],
    openView: "settings",
    blocks: [
      why(
        "The tablet is a screen, not a person. PIN says who is working. The device role says what this screen is for: taking orders, showing tickets, or running the host stand.",
      ),
      p(
        "Every station is one of three roles. Order-taking covers handhelds and bar POS — menu, checks, pay, gift. ODS is kitchen (and bar display): tickets only, Start and Bump, no menu, no pay. Host is hybrid: floor map, seat, table status, and to-go order entry at the stand.",
      ),
      ul(
        "Order: handhelds + bar. PIN in, ring, send, take tenders the PIN allows.",
        "ODS: kitchen tickets. Start / Bump. No pay path — cash and gift tenders are blocked on ODS.",
        "Host: floor map + to-go. Seat the room; ring takeout at the stand.",
        "A manager Change device switches among those three. PIN stays the person; the role is the screen.",
        "Prime the station once from the signed-in control plane (Open POS, internet required). After that, floor stations open on the PIN pad — not /login. Back-office email and password is for owners on a laptop, not the handheld.",
      ),
      steps(
        "Pair the tablet in Devices. Set its role: Order, Order Display, or Host. Prime once while online from the control plane.",
        "Thereafter: power on → PIN keypad. Enter your 4-digit PIN. That is not clock-in and not closeout.",
        "Owner or manager: Change device to move this screen among Order / ODS / Host without a new account login.",
        "Switch user returns to the PIN pad. The device role does not change.",
      ),
      warn(
        "Do not send kitchen staff to /login. Do not clock anyone in from the PIN pad. Time clock is Labor. Server closeout is Cash.",
      ),
      related("floor-pin-login", "login", "device-assignment", "station-switcher", "kds", "printers-kds", "loss-prevention"),
    ],
  }),
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
        "First install (internet required): sign in, Open POS, wait for the floor. Add to Home Screen from that station. Do this on each tablet.",
        "Thereafter cold start can be offline: power the tablet, tap the Summex icon — no typing a URL. PIN in. Banner: Offline.",
        "Seat, send a ticket, Start and Bump. Take cash. Card shows Card requires connection — not queued, never a fake Visa.",
        "When WAN returns, banner says Syncing… Outbox applies each mutation once (clientMutationId). Sync failed stays until a manager retries.",
      ),
      shot(
        "Header Wi‑Fi chip — outbox, failed sync list, Offline banner.",
        "Network sheet with house SSID, queued cash/tickets, and failed rows.",
      ),
      warn(
        "First install requires internet. A house router with no WAN is not enough for a cold uncached device — that tablet has never stored the app shell or location pack. Open POS once while the uplink is up, wait for the floor, then Add to Home Screen. After that, power on with no internet: PIN in, cached menu/floor, cash tender. Card still needs a connection.",
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
    summary:
      "Ethernet on the house AP LAN. Thermal receipts (Epson TM-T20). Impact kitchen (Epson TM-U220). Drawer kick on the receipt printer.",
    roles: ["owner_manager", "kitchen_bar", "platform_admin"],
    keywords: [
      "printer",
      "kds",
      "device",
      "station",
      "android",
      "tablet",
      "star",
      "epson",
      "escpos",
      "receipt",
      "t20",
      "u220",
      "ethernet",
      "drawer kick",
    ],
    openView: "settings",
    blocks: [
      why(
        "Tickets and chits live on the staff network. Guest Wi‑Fi or the printer’s own Wi‑Fi hotspot will look “down” while the floor is fine. Ethernet to the house access-point LAN is the production path.",
      ),
      p(
        "Plug printers into the AP LAN — Ethernet — not the printer’s built-in Wi‑Fi. Thermal receipts: Epson TM-T20 (or TM-T88 / TM-m30). Impact kitchen: Epson TM-U220 so the ticket survives heat and grease. The cash drawer kick is on the receipt printer, not the kitchen printer.",
      ),
      steps(
        "Dashboard → Hardware (or Location settings). Add printer. Name it (Receipt, Kitchen 1).",
        "Model family: Epson (T20 receipt, U220 kitchen), Star, or generic ESC/POS. Connection: LAN (Ethernet on the AP), This browser (SYOH practice), or Bluetooth.",
        "Assign Prints: Guest receipt (thermal T20), Kitchen tickets (impact U220), Bar tickets, or Expo / bump chit. Entity = host or one operator.",
        "Bind the cash drawer kick to the receipt printer. Kitchen impact printers do not kick the till.",
        "LAN: enter IP (default port 9100). The house print agent on the hub talks raw sockets — browsers cannot.",
        "Tap Test print. Send from POS prints kitchen/bar. Pay or Check prints the guest receipt and can kick the drawer.",
      ),
      ul(
        "Production: Ethernet to the staff AP. Do not join the printer to guest Wi‑Fi or run it as its own hotspot.",
        "Receipts: Epson TM-T20 thermal. Kitchen: Epson TM-U220 impact. Star mC-Print3 / TSP100 and Epson TM-T88 / TM-m30 also work as thermal.",
        "Drawer kick: receipt printer only (open on cash sale always / never / manager PIN).",
        "SYOH practice: connection = This browser. An 80mm dialog is not a substitute for the LAN printers at go-live.",
        "SYOH tablets run POS/ODS. Live cards still use a supplied Quantum reader — not the tablet keypad. Default is bring-your-own tablets, printers, and drawers; optional Finix readers drop-ship to the house.",
      ),
      warn(
        "There is no separate “ODS appliance OS.” Hardware is not a locked role. Do not take live cards on a SYOH tablet keypad. Do not put kitchen printers on printer Wi‑Fi.",
      ),
      related("wifi-offline", "kds", "device-roles", "cash-handling", "station-switcher"),
    ],
  }),
  topic({
    id: "device-assignment",
    chapterId: "devices",
    title: "Assign devices to any entity",
    summary: "Tablets, ODS, kiosks, and printers are location assets. Suggested assignment is a default — not a locked role.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "kitchen_bar"],
    keywords: ["device", "tablet", "ods", "kiosk", "assignment", "claim code"],
    openView: "settings",
    blocks: [
      why(
        "Hardware is not branded to a stall. The host location owns the registry. Any tablet, Android touchscreen, or desktop can run Operator A POS this week and Operator B ODS next week — This station switches the screen without a new login.",
      ),
      ul(
        "Type: tablet POS, order display, kiosk, printer, host stand, other.",
        "Suggested assignment: operator (host or a guest entity) + function (floor POS, bar POS, kitchen ODS, bar ODS, expo, kiosk, host stand, cashier).",
        "This station (header): switch Host stand, Server POS, Expo, Cashier, Busser, Kiosk, or Order Display. Multi-op houses pick Host / Operator A / Operator B.",
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
        "An Operator A ODS does not show Operator B tickets unless the host grants view_tickets. Devices are not fixed roles.",
      ),
      related("device-roles", "station-switcher", "host-operator-settings", "printers-kds", "role-vendor"),
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
        "Three device roles: Order (handhelds + bar), ODS (kitchen tickets), Host (floor map + to-go). Change device among those three.",
        "This station still names the function on that role: Host stand, Server POS, Expo, Cashier, Busser, Kiosk, Kitchen ODS, Bar ODS, Bar POS.",
        "Multi-operator: pick Host, Operator A, or Operator B. Tickets stay location-scoped and tagged to the operator.",
        "Last station is remembered in this browser (next load).",
        "Split: two independent panes, each with its own station + entity. Typical left Kitchen ODS (Operator A), right Bar ODS (Operator B).",
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
      related("device-roles", "device-assignment", "printers-kds", "kds", "floor-pin-login", "location-training"),
    ],
  }),
];
