import { related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const LIFECYCLE_TOPICS: GuideTopic[] = [
  topic({
    id: "location-training",
    chapterId: "getting-started",
    title: "Training vs go live",
    summary: "Practice mode with sandbox cards, This station / split screen, then go live with keep/erase.",
    roles: ["owner_manager", "host_operator", "platform_admin"],
    keywords: ["training", "go live", "sandbox", "split screen", "change device", "practice", "pin", "clock"],
    openView: "settings",
    blocks: [
      why(
        "A new house should rehearse the floor before live cards. Training is the real POS with Quantum Payments sandbox. Go live is a deliberate owner action — never an automatic flip from live processor keys.",
      ),
      steps(
        "After onboard, the location is in Training. Banner: TRAINING — practice mode · Quantum Payments sandbox.",
        "Cash, gift, floor, ODS, PIN, devices, and settlement math all work. Cards are sandbox only — live Visa is blocked until status is live.",
        "Any staff device: This station → Server POS, Host stand, Kitchen/Bar ODS, Expo, Kiosk, Cashier, Busser. Multi-op: pick Host / operator.",
        "Optional Split — two panes, each with its own station + entity (kitchen ODS | bar ODS). 70/30 and tap-to-fullscreen on large displays.",
        "Toggle Track inventory during training if you want practice sales to move on-hand.",
        "Host may be live while a new tenant operator stays in Training (Settings → operator status).",
        "Owner: Go live now (type GO LIVE NOW) or Schedule go live. Keep or Erase: orders/tickets, payments, waitlist, time clock, gift balances, inventory qty. Menus, recipes, floorplan, staff, devices, SKUs, settings always stay. Erase also clears the shared floor on the server so other tablets match.",
      ),
      ul(
        "Training / scheduled_live always force Quantum Payments sandbox. Live processor keys are ignored until lifecycle is live.",
        "Go live is explicit (now or schedule) with keep/erase. Live cards only after status = live, plus an approved application and enrolled reader.",
        "Floor PIN signs a person onto the station. Clock in / out is Labor — PIN is not a time punch.",
        "Scheduled live fires at the timestamp (or Run scheduled job now to simulate).",
        "Platform Tenants list shows training | scheduled_live | live.",
      ),
      warn("Go live erase cannot be undone. Type GO LIVE NOW. Gift products stay even if balances are erased. Training week does not take a live Visa."),
      tip("Always-kept: menus, modifiers, recipes, floorplan, staff/PINs, devices, suppliers, SKU definitions, settings, host/tenant profile."),
      related("empty-start", "floor-pin-login", "quantum-payments", "station-switcher", "wifi-offline", "device-assignment"),
    ],
  }),
];
