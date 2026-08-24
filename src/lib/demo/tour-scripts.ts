import type { VenueEntityId, PosView } from "@/lib/pos/types";
import type { DemoStep } from "./scripts";
import { DEMO_CATALOG } from "./catalog";
import { WALKTHROUGH_TOURS } from "@/lib/onboarding/walkthrough-scripts";

export type TourRoute =
  | { to: "/demo" }
  | { to: "/demo/$type"; params: { type: VenueEntityId } }
  | { to: "/kiosk" }
  | { to: "/guide"; search?: { topic?: string } }
  | { to: "/dashboard" }
  | { to: "/get-pricing" };

export type TourStep = {
  id: string;
  title: string;
  /** Fallback narration if AI is unavailable. */
  script: string;
  route?: TourRoute;
  selector?: string;
  view?: PosView;
  action?: DemoStep["action"];
  waitMs?: number;
  platformSurface?: "console" | "pipeline" | "demos";
  kioskPane?: "home" | "order" | "waitlist" | "checkin";
};

export type TourDefinition = {
  id: string;
  title: string;
  subtitle: string;
  steps: TourStep[];
  /** Demo catalog tours leave to /demo. Role walkthroughs stay put. */
  kind?: "demo" | "walkthrough";
};

const T = (ms = 0): number => ms;

export const FULL_TOUR: TourDefinition = {
  id: "full",
  title: "Full product tour",
  subtitle: "Live UI. Demo data only.",
  steps: [
    {
      id: "f-entry",
      title: "Demos, not tenants",
      script:
        "Platform Demos is the prospect catalog — not Tenants. These rooms are tagged demo. They never appear in live operators, billing, or statistics.",
      route: { to: "/demo" },
      selector: "[data-demo='full-tour-card']",
      waitMs: T(),
    },
    {
      id: "f-open",
      title: "The Laundry",
      script:
        "We open The Laundry — a host venue. Steam Distillery pours, Diamond House BBQ cooks. The guest still sees one house.",
      route: { to: "/demo/$type", params: { type: "food_hall" } },
      selector: "[data-demo='floor']",
      view: "floor",
      waitMs: T(),
    },
    {
      id: "f-floor",
      title: "Floor and sections",
      script:
        "Tables live in sections. The host seats. The server owns the check. This is the real floor map, not a mock.",
      selector: "[data-demo='floor']",
      view: "floor",
      action: "seat",
    },
    {
      id: "f-editor",
      title: "Floor editor",
      script:
        "Owner and host stand drag tables, booths, and barstools. Resize from the corner. The live floor is this layout, not a list.",
      selector: "[data-demo='floor-editor']",
      view: "floor_editor",
    },
    {
      id: "f-status",
      title: "Status and flash",
      script:
        "Empty, sat, drinks, food, delivered, unpaid, needs bus. Colors are host-mapped. Sit too long and the table flashes.",
      selector: "[data-demo='floor']",
      view: "floor",
    },
    {
      id: "f-roles",
      title: "Access levels",
      script:
        "One demo login. The yellow Demo mode control switches access level or device. Owner Home is the snapshot. Server is sections. Kitchen KDS is the pit. Steam and Diamond operators only see their stall.",
      selector: "[data-demo='device-switcher']",
      view: "hq",
    },
    {
      id: "f-kds",
      title: "Kitchen KDS",
      script:
        "Switch the dropdown to Device · KDS Kitchen. Tickets from the floor and kiosk land here. Bump tells the floor the plate is up. Switch back to Server / floor to keep selling.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "f-settings",
      title: "Location settings pack",
      script:
        "Owner opens Host settings. Payouts and tax stay here. Guest operators open Operator ops — not this screen.",
      selector: "[data-demo='settings']",
      view: "settings",
    },
    {
      id: "f-menu",
      title: "Menu keeps the operator",
      script:
        "Steam Distillery and Diamond House BBQ are categories on one menu. Lines keep their operator when they hit the check.",
      selector: "[data-demo='menu']",
      view: "menu",
    },
    {
      id: "f-drink",
      title: "Drinks from Steam",
      script:
        "A highball from Steam Distillery. It will route to the bar rail, not the pit.",
      selector: "[data-demo='order']",
      view: "order",
      action: "add_drink",
    },
    {
      id: "f-food",
      title: "Food from Diamond House",
      script:
        "Brisket from Diamond House BBQ on the same check. One guest. Two operators.",
      selector: "[data-demo='order']",
      view: "order",
      action: "add_food",
    },
    {
      id: "f-send",
      title: "Send once, route apart",
      script:
        "Send. Kitchen sees Diamond House. Bar sees Steam. The guest never runs two cards.",
      selector: "[data-demo='order']",
      view: "order",
      action: "send",
    },
    {
      id: "f-kitchen",
      title: "Kitchen rail",
      script:
        "The pit only. Diamond House tickets. Bump tells the floor the plate is up.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
      action: "bump_kitchen",
    },
    {
      id: "f-bar",
      title: "Bar rail",
      script: "Steam’s rail only. The well does not see the brisket.",
      selector: "[data-demo='bar']",
      view: "bar",
      action: "bump_bar",
    },
    {
      id: "f-offline",
      title: "Offline cash",
      script:
        "Simulate internet outage from the Wi‑Fi chip. Floor, KDS, and cash still run on the house SSID. Card requires a connection. Cash closes now and the ledger queues once — no double capture when the uplink returns.",
      selector: "[data-demo='network-chip']",
      view: "order",
      action: "offline_cash",
    },
    {
      id: "f-pay",
      title: "Quantum Payments",
      script:
        "Turn the outage off. One capture under The Laundry. Quantum Payments is the only guest card. There is no Stripe or Square picker on this floor.",
      selector: "[data-demo='order']",
      view: "order",
      action: "pay",
    },
    {
      id: "f-settle",
      title: "Settlement",
      script:
        "Period close allocates merchandise, fees, and a host cut. Steam and Diamond House are paid from the ledger — not a second terminal.",
      selector: "[data-demo='settlement']",
      view: "settlement",
      action: "settle_preview",
    },
    {
      id: "f-reports",
      title: "Reports",
      script:
        "Reports is the house recap: sales, tenders, ticket times, waitlist, and operator mix. Export CSV. Vendor operators only see their slice.",
      selector: "[data-demo='reports']",
      view: "reports",
    },
    {
      id: "f-ai",
      title: "AI insights",
      script:
        "Run analysis. Insights use live metrics — voids, ticket times, waitlist, mix, and cost when inventory is linked. Apply jumps to the setting. It does not change prices by itself.",
      selector: "[data-demo='ai-insights']",
      view: "reports",
    },
    {
      id: "f-cash",
      title: "Cash discount",
      script:
        "Keep a round menu price. A cash discount with round-up is a house setting, not a second processor.",
      selector: "[data-demo='cash']",
      view: "cash",
    },
    {
      id: "f-wait",
      title: "Host stand",
      script:
        "When the room is full, waitlist and reservation check-in live here. The kiosk is for the guest. Staff see the queue.",
      selector: "[data-demo='waitlist']",
      view: "waitlist",
      action: "waitlist_join",
    },
    {
      id: "f-kiosk",
      title: "Guest kiosk",
      script:
        "Large targets. Order, check in, or join the waitlist. Check-in uses last name plus a short code. Demo code: Blair, K7M2.",
      route: { to: "/kiosk" },
      selector: "[data-demo='kiosk-home']",
    },
    {
      id: "f-guide",
      title: "Operators Guide",
      script:
        "The guide is in the product. Overview, by type, features, and roles. Send a prospect a demo link, not Admin.",
      route: { to: "/guide", search: { topic: "prospect-demos" } },
      selector: "[data-demo='guide-root']",
    },
    {
      id: "f-network",
      title: "Network readiness",
      script:
        "Onboarding includes a network check. It is warn only — finish even if it fails. Staff use the app host. Table QR uses the sites host.",
      selector: "[data-demo='network-readiness']",
      view: "settings",
    },
    {
      id: "f-back",
      title: "Back to demos",
      script:
        "That is the house. Demo data never becomes a tenant. Copy a type link, or get pricing when they are ready.",
      route: { to: "/demo" },
      selector: "[data-demo='full-tour-card']",
    },
  ],
};

function typeTour(type: VenueEntityId): TourDefinition {
  const entry = DEMO_CATALOG.find((d) => d.type === type);
  const title = entry?.hostName ?? type;
  const base: TourStep[] = [
    {
      id: `${type}-open`,
      title: title,
      script: `${title}. This is a prospect demo, not a live tenant. ${entry?.tourFocus ?? ""}`,
      route: { to: "/demo/$type", params: { type } },
      selector: "[data-demo='floor'], [data-demo='order']",
    },
  ];
  if (type === "food_hall") {
    return {
      id: `type:${type}`,
      title: "The Laundry guided demo",
      subtitle: entry?.tourFocus ?? "",
      steps: [
        ...base,
        {
          id: "l-seat",
          title: "Seat under the host",
          script:
            "One table. One check. The guest sits at The Laundry, not at Steam or Diamond House.",
          selector: "[data-demo='floor']",
          view: "floor",
          action: "seat",
        },
        {
          id: "l-editor",
          title: "Draw the room",
          script:
            "Host owner drags tables on The Laundry floor. Dining and Bar are rooms. Tokens stay on the host, not Steam or Diamond House.",
          selector: "[data-demo='floor-editor']",
          view: "floor_editor",
        },
        {
          id: "l-flash",
          title: "Status flash",
          script:
            "Sat with no order flashes in seconds on this demo. Closed and dirty flashes too. A status change clears it.",
          selector: "[data-demo='floor']",
          view: "floor",
        },
        {
          id: "l-qr",
          title: "Table QR",
          script:
            "Hybrid QR: staff starts the check. Guests add follow-ups. Pay is Quantum Payments once under The Laundry, Steam and Diamond lines still tagged.",
          selector: "[data-demo='table-detail']",
          view: "floor",
        },
        {
          id: "l-roles",
          title: "Who is signed in",
          script:
            "Owner Home is the host snapshot plus the entity list. Steam operator PIN 6666 edits Steam and sees Diamond menus view-only. Diamond 7777 cannot change Steam settings.",
          selector: "[data-demo='home']",
          view: "hq",
        },
        {
          id: "l-settings",
          title: "Host settings vs operator ops",
          script:
            "The Laundry is the subscriber host. Host settings hold tax, cash discount, Quantum Payments, payouts, the entity permission matrix, and device assignment. Steam and Diamond never edit that pack.",
          selector: "[data-demo='settings']",
          view: "settings",
        },
        {
          id: "l-network",
          title: "Network check",
          script:
            "Run the network probe here anytime. Warn or fail does not lock the floor. Skip is recorded on the location.",
          selector: "[data-demo='network-readiness']",
          view: "settings",
        },
        {
          id: "l-urls",
          title: "Staff and guest URLs",
          script:
            "POS and kiosk on the app host. Table QR and online on the sites host. Login stays on www.",
          selector: "[data-demo='access-points']",
          view: "settings",
        },
        {
          id: "l-pin",
          title: "Floor PIN",
          script:
            "Working staff use a 4-digit PIN on this tablet. Back office is email and password. Switch user to hand the device to the next person without changing the assignment.",
          selector: "[data-demo='switch-user']",
          view: "hq",
        },
        {
          id: "l-sched",
          title: "Entity schedule",
          script:
            "Steam schedules Steam. Diamond schedules Diamond. Host sees every week and cannot edit a guest entity unless that setting is on.",
          selector: "[data-demo='schedule']",
          view: "schedule",
        },
        {
          id: "l-voice",
          title: "Voice 86",
          script:
            "The mic is on for servers and kitchen. Say eighty-six brisket. Destructive commands confirm on screen. Voice cannot change payouts or the host matrix.",
          selector: "[data-demo='voice-mic']",
          view: "hq",
          action: "voice_86",
        },
        {
          id: "l-ai",
          title: "Accept a labor tip",
          script:
            "AI ops watches labor versus sales. Accept records your decision so the next similar night ranks this tip higher. Dismiss twice and it steps back. It will not clock anyone out.",
          selector: "[data-demo='ai-ops']",
          view: "hq",
          action: "accept_labor_rec",
        },
        {
          id: "l-matrix",
          title: "Entity permissions",
          script:
            "Subject times target. View menu is on for peers. Edit menu is off. Tickets, reports, and settlement stay own-only unless you grant them. Devices stay host-only.",
          selector: "[data-demo='entity-permissions']",
          view: "settings",
        },
        {
          id: "l-devices",
          title: "Assign a tablet",
          script:
            "Tablet A is Steam Distillery bar KDS. Tablet B is Diamond House floor POS. Tablet C is the host kiosk. Reassign without new hardware. Tickets still tag the owning entity.",
          selector: "[data-demo='device-assign']",
          view: "settings",
        },
        {
          id: "l-drink",
          title: "Steam Distillery",
          script: "Add a drink. It is tagged Steam and will hit the bar rail.",
          selector: "[data-demo='order']",
          view: "order",
          action: "add_drink",
        },
        {
          id: "l-food",
          title: "Diamond House BBQ",
          script: "Add a plate. Same check. Kitchen, not bar.",
          selector: "[data-demo='order']",
          view: "order",
          action: "add_food",
        },
        {
          id: "l-send",
          title: "Route apart",
          script: "Send once. Two rails. One guest bill.",
          selector: "[data-demo='order']",
          view: "order",
          action: "send",
        },
        {
          id: "l-bar",
          title: "Bar tickets",
          script: "Steam only on this rail.",
          selector: "[data-demo='bar']",
          view: "bar",
          action: "bump_bar",
        },
        {
          id: "l-kit",
          title: "Kitchen tickets",
          script: "Diamond House only.",
          selector: "[data-demo='kitchen']",
          view: "kitchen",
          action: "bump_kitchen",
        },
        {
          id: "l-pay",
          title: "Quantum Payments",
          script:
            "Pay once under The Laundry. Quantum Payments is the only guest card.",
          selector: "[data-demo='order']",
          view: "order",
          action: "pay",
        },
        {
          id: "l-set",
          title: "Settlement split",
          script:
            "Merchandise, fees, and the host cut allocate Steam versus Diamond House.",
          selector: "[data-demo='settlement']",
          view: "settlement",
          action: "settle_preview",
        },
        {
          id: "l-reports",
          title: "Reports & AI",
          script:
            "Open Reports, then AI insights. Run analysis on The Laundry. You should see mix between Steam and Diamond and a sample recommendation — not invented inventory counts.",
          selector: "[data-demo='ai-insights']",
          view: "reports",
        },
      ],
    };
  }
  if (type === "qsr" || type === "cafe" || type === "ghost_kitchen") {
    return {
      id: `type:${type}`,
      title: `${title} guided demo`,
      subtitle: entry?.tourFocus ?? "",
      steps: [
        ...base,
        {
          id: `${type}-open-check`,
          title: "Open a check",
          script: "Counter service. The check is the queue.",
          selector: "[data-demo='order']",
          view: "order",
          action: "counter_open",
        },
        {
          id: `${type}-add`,
          title: "Add items",
          script: "Food and a drink still route to their stations.",
          selector: "[data-demo='order']",
          view: "order",
          action: "add_food",
        },
        {
          id: `${type}-send`,
          title: "Send the line",
          script: "The make line is the source of truth.",
          selector: "[data-demo='kitchen']",
          view: "kitchen",
          action: "send",
        },
        {
          id: `${type}-pay`,
          title: "Pay once",
          script: "Quantum Payments at the register.",
          selector: "[data-demo='order']",
          view: "order",
          action: "pay",
        },
        {
          id: `${type}-reports`,
          title: "Reports & AI",
          script:
            "Reports for this house: sales, tenders, ticket times. Run AI insights — recommendations stay on this location, not a platform portfolio.",
          selector: "[data-demo='reports']",
          view: "reports",
        },
      ],
    };
  }
  if (type === "bar_lounge") {
    return {
      id: `type:${type}`,
      title: `${title} guided demo`,
      subtitle: entry?.tourFocus ?? "",
      steps: [
        ...base,
        {
          id: "b-tab",
          title: "Open a tab",
          script: "Service starts at the well. A named tab is the check.",
          selector: "[data-demo='bar']",
          view: "bar",
          action: "open_tab",
        },
        {
          id: "b-drink",
          title: "Build the round",
          script: "Cocktails on the tab. Plates still route to kitchen.",
          selector: "[data-demo='order']",
          view: "order",
          action: "add_drink",
        },
        {
          id: "b-send",
          title: "Send and bump",
          script: "The cocktail KDS is the source of truth for the well.",
          selector: "[data-demo='bar']",
          view: "bar",
          action: "send",
        },
        {
          id: "b-pay",
          title: "Close",
          script: "One Quantum Payments capture. House brand on the receipt.",
          selector: "[data-demo='order']",
          view: "order",
          action: "pay",
        },
        {
          id: "b-reports",
          title: "Reports",
          script: "Bar reports: tenders, ticket times, mix. AI insights stay on this lounge — not a platform rollup.",
          selector: "[data-demo='reports']",
          view: "reports",
        },
      ],
    };
  }
  return {
    id: `type:${type}`,
    title: `${title} guided demo`,
    subtitle: entry?.tourFocus ?? "",
    steps: [
      ...base,
      {
        id: `${type}-seat`,
        title: "Seat",
        script: "Seat a table. The server owns the check.",
        selector: "[data-demo='floor']",
        view: "floor",
        action: "seat",
      },
      {
        id: `${type}-editor`,
        title: "Floor editor",
        script:
          "Drag tables and booths. The live map is this layout. Each seat has a table QR.",
        selector: "[data-demo='floor-editor']",
        view: "floor_editor",
      },
      {
        id: `${type}-flash`,
        title: "Colors and flash",
        script:
          "Status colors move as you send. Wait a few seconds on sat with no order and the table pulses.",
        selector: "[data-demo='floor']",
        view: "floor",
      },
      {
        id: `${type}-qr`,
        title: "Table QR pay",
        script:
          "Hybrid by default: staff seats, guests add follow-ups, pay QR closes with Quantum Payments.",
        selector: "[data-demo='table-detail']",
        view: "floor",
      },
      {
        id: `${type}-network`,
        title: "Network readiness",
        script:
          "Settings holds the warn-only network check and the www / app / sites bookmarks. It never locks the floor.",
        selector: "[data-demo='network-readiness']",
        view: "settings",
      },
      {
        id: `${type}-order`,
        title: "Order",
        script: "Food and a drink on one ticket.",
        selector: "[data-demo='order']",
        view: "order",
        action: "add_food",
      },
      {
        id: `${type}-send`,
        title: "Send",
        script: "Kitchen and bar still split. The guest does not.",
        selector: "[data-demo='order']",
        view: "order",
        action: "send",
      },
      {
        id: `${type}-pay`,
        title: "Pay",
        script: "Quantum Payments once. Close the table.",
        selector: "[data-demo='order']",
        view: "order",
        action: "pay",
      },
      {
        id: `${type}-wait`,
        title: "Waitlist",
        script:
          "If the room is full, the kiosk takes the waitlist. Staff notify when a table is ready.",
        selector: "[data-demo='waitlist']",
        view: "waitlist",
        action: "waitlist_join",
      },
      {
        id: `${type}-reports`,
        title: "Reports & AI",
        script:
          "Reports recap the house. Run AI insights for this range. Recommendations jump to a screen — they do not rewrite prices alone.",
        selector: "[data-demo='reports']",
        view: "reports",
      },
    ],
  };
}

const TYPE_TOURS: Record<string, TourDefinition> = Object.fromEntries(
  DEMO_CATALOG.map((d) => [`type:${d.type}`, typeTour(d.type)]),
);

export const TOURS: Record<string, TourDefinition> = {
  full: FULL_TOUR,
  ...TYPE_TOURS,
};

export function getTour(id: string): TourDefinition | null {
  return TOURS[id] ?? WALKTHROUGH_TOURS[id] ?? null;
}

export function listTourIds(): string[] {
  return [...Object.keys(TOURS), ...Object.keys(WALKTHROUGH_TOURS)];
}
