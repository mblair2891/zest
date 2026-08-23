import type { VenueEntityId, PosView } from "@/lib/pos/types";
import type { DemoStep } from "./scripts";
import { DEMO_CATALOG } from "./catalog";

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
};

export type TourDefinition = {
  id: string;
  title: string;
  subtitle: string;
  steps: TourStep[];
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
        "Owner and manager open Location settings. The badge says host plus multi-operator, so you get operators, settlement, kiosk, and cash discount — not a generic café form.",
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
      id: "f-pay",
      title: "Quantum Payments",
      script:
        "One capture under The Laundry. Quantum Payments is the only guest card. There is no Stripe or Square picker on this floor.",
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
          id: "l-roles",
          title: "Who is signed in",
          script:
            "Owner Home is the snapshot. Server is sections. Kitchen is Diamond’s rail. Steam operator PIN 6666 only sees Steam. Diamond 7777 only sees Diamond.",
          selector: "[data-demo='home']",
          view: "hq",
        },
        {
          id: "l-settings",
          title: "Host settings pack",
          script:
            "Owner opens Location settings. The badge is host plus multi-operator: operators, settlement, kiosk, cash discount.",
          selector: "[data-demo='settings']",
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
  return TOURS[id] ?? null;
}

export function listTourIds(): string[] {
  return Object.keys(TOURS);
}
