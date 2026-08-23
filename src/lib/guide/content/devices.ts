import { p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const DEVICE_TOPICS: GuideTopic[] = [
  topic({
    id: "wifi-offline",
    chapterId: "devices",
    title: "Wi‑Fi-first & offline outbox",
    summary: "House SSID keeps the floor alive; the cloud queue waits for the ISP.",
    roles: "all",
    keywords: ["wifi", "offline", "outbox", "network", "ssid", "internet", "queue"],
    openView: "settings",
    blocks: [
      why(
        "A dead ISP should not kill dinner. Summex is Wi‑Fi-first: stations talk to a house hub on the staff SSID, not to the cloud, for live checks.",
      ),
      p(
        "One business access point (or a small mesh) publishes a staff SSID (default Summex-House) and a guest SSID that never sees POS traffic. Handhelds, KDS, printers, and readers join staff. One station is the house hub and holds live checks.",
      ),
      ul(
        "Works offline through house Wi‑Fi: tables, orders, KDS bump, cash, comps, local gift, clock-in.",
        "Queues until internet: card capture (Quantum Payments), marketplace orders, cloud gift/loyalty, email/SMS, SaaS billing.",
        "If the AP itself dies, this terminal still has its local checks. Other stations cannot see each other until Wi‑Fi is back.",
      ),
      steps(
        "Put the AP where dining and kitchen both hear it. Wi‑Fi 6/6E if you can.",
        "Name a staff SSID and a guest SSID. Isolate guest. Never put POS on guest.",
        "Designate the drawer / counter tablet as the house hub (Settings → House network).",
        "Join every station to the staff SSID. Ethernet is optional, never required.",
        "Tap the Wi‑Fi chip in the header to see peers, the outbox, and to simulate an outage.",
      ),
      shot(
        "Header Wi‑Fi chip open — peers, queued card captures, simulate outage.",
        "Network sheet showing house hub, staff SSID, and cloud queue.",
      ),
      tip(
        "A second AP (or a cheap mesh node) is the spare part most houses need — not a closet of switches.",
      ),
      related("printers-kds", "quantum-payments", "troubleshooting", "kds"),
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
      related("wifi-offline", "kds", "navigation"),
    ],
  }),
];
