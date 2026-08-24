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
        "Works offline (cached location): menu, modifiers, tables/sections, staff switcher, open checks, KDS tickets on this station.",
        "Allow: create/edit orders, send to kitchen/bar (local queue), bump tickets, seat cached tables, cash tender, waitlist add (SMS pending send).",
        "Needs internet: Quantum Payments card auth, SMS/email send, cloud reporting AI, SaaS admin and billing.",
        "Card: blocked with “Card requires connection.” Offer cash or hold the tab. Cash never drops a closed check and never double-captures on sync.",
        "Same-device floor + KDS is always consistent. Cross-device while internet is down is best-effort on LAN (BroadcastChannel + persist). Each device can work on its cache and merge by id when the cloud is back. Server wins on settings.",
      ),
      steps(
        "Tap the Wi‑Fi chip (or Settings → House network). Check Simulate internet outage to train.",
        "Seat, send a ticket, bump on KDS. Take cash. Card stays disabled.",
        "Turn the outage off. Banner says Syncing… Outbox items apply once (client mutation ids). Failed rows show to the manager as Failed to sync.",
        "Prospect demos use the same path on demo data only.",
      ),
      shot(
        "Header Wi‑Fi chip — Simulate internet outage, outbox, failed sync list.",
        "Network sheet with house SSID, queued cash ledger, and dead-letter rows.",
      ),
      warn(
        "Cache is scoped to this location. Do not expect another tenant’s menu after you leave. PIN switch keeps the house; leaving the location drops the snapshot.",
      ),
      tip(
        "Owner / manager: watch Failed to sync. Server / cashier: cash is the offline tender. Kitchen: bump locally. Host: waitlist SMS is pending send.",
      ),
      related("printers-kds", "quantum-payments", "troubleshooting", "kds", "cash-handling"),
    ],
  }),
  topic({
    id: "printers-kds",
    chapterId: "devices",
    title: "Printers & KDS devices",
    summary: "How stations, KDS, and printers join the house — as implemented.",
    roles: ["owner_manager", "kitchen_bar", "platform_admin"],
    keywords: ["printer", "kds", "device", "station", "android", "tablet"],
    openView: "settings",
    blocks: [
      why(
        "Tickets and chits are devices on the staff SSID. If a KDS is on guest Wi‑Fi, it will look “down” while the floor is fine.",
      ),
      steps(
        "Enroll a station from the platform (or Summex Store station profiles: Floor, Kitchen, Bar, Manager).",
        "Join the device to the staff SSID. Give kitchen displays a stable power drop; they do not need Ethernet.",
        "Open Kitchen or Bar on that device. Filter by operator on a host floor.",
        "Receipt printers follow the house hub. If a chit does not print, check the hub outbox and the printer’s Wi‑Fi, not a second processor.",
        "BYOD phones are supported for running; leased Android stations are the always-on KDS/cashier path.",
      ),
      warn(
        "There is no separate “KDS appliance OS” in this product. A browser or the Android shell on the staff SSID is the device.",
      ),
      related("wifi-offline", "kds", "navigation", "host-operator-settings"),
    ],
  }),
  topic({
    id: "device-assignment",
    chapterId: "devices",
    title: "Assign devices to any entity",
    summary: "Tablets, KDS, kiosks, and printers are location assets. Host assigns each to an entity and a function.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "kitchen_bar"],
    keywords: ["device", "tablet", "kds", "kiosk", "assignment", "claim code", "steam", "diamond"],
    openView: "settings",
    blocks: [
      why(
        "Hardware is not branded to a stall. The host location owns the registry. Any tablet can run Steam POS this week and Diamond KDS next week.",
      ),
      ul(
        "Type: tablet POS, KDS, kiosk, printer, host stand, other.",
        "Assignment: operator (host or a guest entity) + function (floor POS, bar POS, kitchen KDS, bar KDS, expo, kiosk, host stand, cashier).",
        "On pair: the session picks up the assignment — menu scope, ticket routing, KDS station, permissions.",
        "KDS only shows tickets for that station and entity unless the host grants a broader view_tickets.",
        "Demo: Demo mode lists assigned devices. Production: claim code or this admin list.",
      ),
      steps(
        "Host settings → Operators → Device assignment (or Devices pack).",
        "Pick the entity (Steam Distillery, Diamond House BBQ, or host) and the function.",
        "On The Laundry demo: Tablet A is Steam bar KDS, Tablet B is Diamond floor POS, Tablet C is host kiosk, 27\" is Diamond kitchen KDS.",
        "Reassign without replacing hardware. Ticket lines still carry the owning entity.",
      ),
      warn(
        "A Diamond KDS does not show Steam tickets unless the host grants Diamond view_tickets on Steam.",
      ),
      related("host-operator-settings", "printers-kds", "role-vendor", "laundry-test-venue"),
    ],
  }),
];
