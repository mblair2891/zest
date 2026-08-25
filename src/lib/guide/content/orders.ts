import { callout, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const ORDER_TOPICS: GuideTopic[] = [
  topic({
    id: "menu-modifiers",
    chapterId: "orders",
    title: "Menu, categories, modifiers",
    summary: "Build the item tree the floor and ODS will use.",
    roles: ["owner_manager", "server", "kitchen_bar", "vendor_operator", "host_operator"],
    keywords: ["menu", "category", "modifier", "86", "item", "assist", "ai", "omit", "voice"],
    openView: "menu",
    blocks: [
      why(
        "Routing, settlement, and allergens all hang off the menu. A missing modifier or operator tag shows up as a wrong ticket or a wrong payout.",
      ),
      steps(
        "Open Menu. Create categories (e.g. Starters, Mains, Bar).",
        "Add or edit an item by hand, or tap Describe with AI / Assist. Type or speak a short description.",
        "Assist suggests name, description, category, station, modifier groups, and common omit/add. Answer follow-ups only if asked (cash vs card price, operator on a host floor).",
        "Preview the card. Accept, edit, or dismiss. Nothing writes until Confirm.",
        "On a host venue, guest operators only create/edit their own entity. Host can still assign operator on new items.",
        "86 an item from Menu or the 86 board so it greys out on Order.",
      ),
      tip(
        "No AI key → category templates (burger, steak, pizza, salad, cocktail, …) still fill modifiers and omit/add. You confirm before save.",
      ),
      related("kitchen-bar-routing", "multi-operator-orders", "onboarding-wizard", "setup-by-voice"),
    ],
  }),
  topic({
    id: "kitchen-bar-routing",
    chapterId: "orders",
    title: "Kitchen vs bar routing",
    summary: "How a sent line becomes a ticket on the right display.",
    roles: ["owner_manager", "kitchen_bar", "server"],
    keywords: ["routing", "station", "kitchen", "bar", "ticket", "fire"],
    openView: "kitchen",
    blocks: [
      why(
        "Guests do not care which printer fired. The line must land on the station that can make it.",
      ),
      ul(
        "Each item has a station: kitchen, bar, expo, or dessert.",
        "Send / Fire groups unsent lines into tickets by station (and operator, on a host floor).",
        "Hold a course to keep mains in the window until apps are bumped.",
        "Online / order-ahead uses fire rules (immediate, on arrival, delay).",
      ),
      steps(
        "On Order, build the check, then Send. Do not expect ODS to see unsent lines.",
        "Kitchen order display shows food tickets; Bar ODS shows beverage tickets. Host floors also split by operator.",
        "Expo or the server marks Delivered when the table has the plate.",
      ),
      related("kds", "menu-modifiers", "multi-operator-orders"),
    ],
  }),
  topic({
    id: "multi-operator-orders",
    chapterId: "orders",
    title: "Multi-operator: one guest check",
    summary: "Line vendor tagging, one pay, tickets still split by operator.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "server", "kitchen_bar"],
    keywords: ["multi-operator", "vendor", "operator a", "operator b", "one check", "tagging"],
    openView: "hall",
    blocks: [
      why(
        "A hall guest should not run three cards. The host captures once; Operator A and Operator B still see their own tickets and period payouts.",
      ),
      p(
        "Example: Host Venue. Guest orders tacos from Operator A and a cocktail from Operator B. One check, one Quantum Payments capture, two ODS tickets.",
      ),
      steps(
        "Items carry the operator set on the menu. The hall cart can mix stalls on one check.",
        "Fire still routes by station + operator so Operator A’s kitchen does not see Operator B’s drinks.",
        "Pay once at the host stand (or table). The guest-facing brand is the host, not the stall.",
        "Settlement later splits merchandise, fees, host cut, and any $35 dispute fee by merchandise share.",
      ),
      shot(
        "One guest check with Operator A food lines and Operator B drink lines, single tender.",
        "Check panel showing two operators and one payment.",
      ),
      warn(
        "Do not take a second card “for the bar” on a host check. That breaks settlement and the guest receipt.",
      ),
      related("single-vs-multi", "host-capture", "settlement", "chargebacks", "kds"),
    ],
  }),
  topic({
    id: "kds",
    chapterId: "orders",
    title: "Order display (ODS): Start, Bump, notify",
    summary: "Station displays route by kitchen/bar and operator. Start to prepare, Bump when ready. Originating server is notified.",
    roles: ["owner_manager", "kitchen_bar", "server"],
    keywords: ["ods", "kds", "order display", "bump", "start", "recall", "ticket", "notification", "bar display"],
    openView: "kitchen",
    blocks: [
      why(
        "Bump is the contract between station and floor. If bump is skipped, tables never go Up and food dies in the window.",
      ),
      shot(
        "Kitchen order display with All operators / stall filters, Start, and Bump.",
        "ODS ticket columns with Start and Bump.",
      ),
      steps(
        "Send from the floor. Tickets land on the kitchen or bar ODS for that station and operator.",
        "Start when you begin prep (Preparing). Bump when the plate/drink is ready.",
        "The originating server’s device toasts, chimes, and vibrates (where the platform allows). The table pulses Up.",
        "Expo or the server marks Delivered on the floor. Recall if you bumped too early.",
        "Mute sound from the header bell. Multi-op: filter All operators or a single stall.",
      ),
      tip(
        "Ahead and curbside tickets may wait until the guest is marked arrived — see Online fire rules if a ticket “never showed.”",
      ),
      related("kitchen-bar-routing", "wifi-offline", "floor-tables", "troubleshooting"),
    ],
  }),
  topic({
    id: "online-ahead",
    chapterId: "orders",
    title: "Online, order ahead & table QR",
    summary: "Guest ordering, claim codes, and kitchen fire rules.",
    roles: ["owner_manager", "server", "kitchen_bar"],
    keywords: ["online", "order ahead", "qr", "curbside", "claim code", "fire rules"],
    openView: "online",
    blocks: [
      why(
        "A ticket that fires before the guest exists clogs the board. Fire rules exist so kitchen sees work when it can actually leave the window.",
      ),
      steps(
        "Guest orders on the public page (ahead, pickup, curbside, delivery) or via table QR.",
        "They receive an order number and claim code.",
        "Default for ahead/curbside: wait until arrival.",
        "On arrival: scan table QR → I ordered ahead → claim code, or staff taps Guest arrived on the Online board.",
        "Kitchen receives the ticket according to the channel’s fire rule (immediate, on arrival, delay after order, delay after arrival).",
      ),
      related("kds", "kitchen-bar-routing", "tenders-tips"),
    ],
  }),
];
