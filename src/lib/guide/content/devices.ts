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
        "Needs internet: Quantum Payments card auth, SMS/email send, cloud reporting AI, SaaS admin and billing.",
        "Card: blocked with “Card requires connection.” Offer cash or hold the tab. Cash never drops a closed check and never double-captures on sync.",
        "Same-device floor + ODS is always consistent. Cross-device while internet is down is best-effort on LAN (BroadcastChannel + persist). Each device can work on its cache and merge by id when the cloud is back. Server wins on settings.",
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
    summary: "How stations, ODS, and printers join the house — as implemented.",
    roles: ["owner_manager", "kitchen_bar", "platform_admin"],
    keywords: ["printer", "kds", "device", "station", "android", "tablet"],
    openView: "settings",
    blocks: [
      why(
        "Tickets and chits are devices on the staff SSID. If an ODS is on guest Wi‑Fi, it will look “down” while the floor is fine.",
      ),
      steps(
        "Enroll a station from the platform (or Summex Store station profiles: Floor, Kitchen, Bar, Manager).",
        "Join the device to the staff SSID. Give kitchen displays a stable power drop; they do not need Ethernet.",
        "On that device, This station → Kitchen ODS or Bar ODS. Filter by operator on a host floor.",
        "Large displays: Layout → Split. Typical left Kitchen ODS (Diamond), right Bar ODS (Steam). Tap a pane header to fullscreen it.",
        "Receipt printers follow the house hub. If a chit does not print, check the hub outbox and the printer’s Wi‑Fi, not a second processor.",
        "BYOD phones are supported for running; Android tablets and desktops use the same This station switcher — no special SKU.",
      ),
      warn(
        "There is no separate “ODS appliance OS” in this product. A browser or the Android shell on the staff SSID is the device. Hardware is not locked to one role.",
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
        "Dashboard → Devices: add a tablet, order display, or kiosk (or Use this browser as a device). Hardware tab is terminals and printers.",
        "On the device, This station → pick function and entity. No special device SKU.",
        "On The Laundry: Tablet A can be Steam bar ODS, then switched to Diamond kitchen ODS without re-enrolling.",
        "Large / order-display screens: Split — two independent panes (each with its own station + entity). Optional 70/30. Tap a pane header to fullscreen.",
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
        "Open This station in the header (or on the PIN pad).",
        "Pick the function. On a host house, pick the entity.",
        "PIN in — identity only. The screen stays on that station.",
        "On a wall display: Layout → Split. Set each pane. Start / Bump independently.",
        "Tap a pane title to focus it. Tap Back to split when both rails are needed.",
      ),
      warn(
        "Station switch does not clock you in or change the location. Time clock is a separate punch. Guest checks stay under the host brand.",
      ),
      related("device-assignment", "printers-kds", "kds", "floor-pin-login", "location-training"),
    ],
  }),
];
