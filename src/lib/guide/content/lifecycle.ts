import { related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const LIFECYCLE_TOPICS: GuideTopic[] = [
  topic({
    id: "location-training",
    chapterId: "saas",
    title: "Training, devices, go live",
    summary: "Practice mode with sandbox cards, Change device, split screen, then go live with keep/erase.",
    roles: ["owner_manager", "host_operator", "platform_admin"],
    keywords: ["training", "go live", "sandbox", "split screen", "change device", "practice"],
    openView: "settings",
    blocks: [
      why(
        "A new house should rehearse the floor before live cards. Training is the real POS with Quantum Payments sandbox. Go live is a deliberate owner action.",
      ),
      steps(
        "After onboard, the location is in Training. Banner: TRAINING — practice mode.",
        "Manager or owner: Change device to Server tablet, Host stand, Kitchen/Bar ODS, Expo, Kiosk, Cashier, Busser.",
        "Optional Split screen — two panes, each with its own Change device (order | bar ODS, or two ODS).",
        "Toggle Track inventory during training if you want practice sales to move on-hand.",
        "Host may be live while a new tenant operator stays in Training (Settings → operator status).",
        "Owner: Go live now (type GO LIVE NOW) or Schedule go live. For each data category, Keep or Erase. Menus, recipes, floor, staff, devices, SKUs always stay.",
      ),
      ul(
        "Sandbox cards only while that scope is training. Live MID only when live.",
        "Scheduled live fires at the timestamp (or Run scheduled job now to simulate).",
        "Platform Tenants list shows training | scheduled_live | live.",
      ),
      warn("Go live erase cannot be undone. Type GO LIVE NOW. Gift products stay even if balances are erased."),
      tip("Always-kept: menus, modifiers, recipes, floorplan, staff/PINs, devices, suppliers, SKU definitions, settings, host/tenant profile."),
      related("onboarding-wizard", "cost-control", "recipes-prep", "device-assignment"),
    ],
  }),
];
