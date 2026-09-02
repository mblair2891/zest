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
      related("training-floor-loop", "empty-start", "floor-pin-login", "quantum-payments", "station-switcher", "wifi-offline", "device-assignment"),
    ],
  }),
  topic({
    id: "training-floor-loop",
    chapterId: "getting-started",
    title: "Training service loop",
    summary: "Seat, order, Order Display Start/Bump, cash or sandbox card, bus — on a SaaS training host.",
    roles: ["owner_manager", "server", "kitchen_bar", "host_operator"],
    keywords: ["training", "PIN", "1111", "seat", "bump", "cash", "sandbox", "order display"],
    openView: "floor",
    blocks: [
      why(
        "The first house should rehearse a real table before live cards. Training is the production POS with Quantum Payments sandbox.",
      ),
      steps(
        "Sign in (owner password). Open the location POS so this tablet primes. Banner: TRAINING — practice mode · Quantum Payments sandbox.",
        "If this house has no staff yet, floor PINs are created for this location only (hashed): 0000 manager, 1111 server, 2222 host, 3333 bartender, 4444 kitchen, 5555 busser. PIN is not the time clock.",
        "PIN 2222 (or 1111 in training): Host stand → seat a table.",
        "PIN 1111: This station → Server. Open the table, add a kitchen item (burger) and a bar item (wine), Send.",
        "This station → Kitchen Order Display: Start, then Bump. Bar Order Display gets the drink. The originating server’s device toasts, chimes, and vibrates.",
        "Back on Server: Pay → Cash or Quantum Payments (sandbox only). Live processor keys are ignored.",
        "PIN 5555: Floor → Mark cleaned. Table returns to empty.",
        "Manager 0000: This station can switch Server, Host stand, Kitchen/Bar Order Display, Kiosk, Cashier.",
      ),
      ul(
        "Gift tender and settlement math run as the practice ledger. They are not a live bank.",
        "Clock in / out is Labor. Closing a drawer is not a punch.",
        "Go live is a separate owner action. Do not expect a live Visa in training.",
      ),
      warn("These PINs exist only until you add real staff. Change them before guests arrive."),
      related("location-training", "floor-pin-login", "kds", "tenders-tips", "station-switcher"),
    ],
  }),
];
