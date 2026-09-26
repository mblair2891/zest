import { callout, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const ORDER_TOPICS: GuideTopic[] = [
  topic({
    id: "menu-modifiers",
    chapterId: "orders",
    title: "Menu, categories, modifiers",
    summary: "Build the item tree the floor and ODS will use.",
    roles: ["owner_manager", "server", "kitchen_bar", "vendor_operator", "host_operator"],
    keywords: ["menu", "category", "modifier", "86", "item", "assist", "ai", "omit", "voice", "upload", "pdf", "docx", "draft", "publish"],
    openView: "menu",
    blocks: [
      why(
        "Routing, settlement, and allergens all hang off the menu. A missing modifier or operator tag shows up as a wrong ticket or a wrong payout.",
      ),
      steps(
        "Open Menu for the selling entity. Choose a PDF, JPEG, PNG, or DOCX. The file name, size, and a thumbnail for a photo show on the form. A file over 5 MB, or a file that is not a photo, PDF, or DOCX, opens a notice with the size and the 5 MB maximum. OK closes it and clears the picker so you can choose again. Upload stays off until a file that fits is chosen. Upload stores that file on this entity. Analyze stays off until Upload finishes. Paste or voice does not use Upload. Analyze with no stored file says Upload a menu first and does not start a read.",
        "Analyze builds a draft for that entity from the stored file, or from the pasted text: group, item name, description, cash price, and the card price from the venue cash-discount rule when the line is cash. One unlabeled price asks cash or card on this screen. Obvious extras become modifiers. Food groups guess the kitchen printer. Drink groups guess the bar section.",
        "If a price, a group, or an alcohol flag is missing, answer on this screen by typing or speaking. Tax stays on the venue tax screen.",
        "Review the draft. Accept, edit, or drop each row. Bulk accept marks every open row. Save / Publish writes the accepted rows onto that entity and publishes them for stations. The order pad shows those items. Another entity’s menu stays as it was.",
        "Add or edit one item by hand when you prefer. The price field is Cash price (printed / till). With cash discount on, Card price appears beside it.",
        "Or tap Describe with AI. Type or speak one item. One price is cash. Assist asks cash or card when the discount is on and the basis is open. Confirm writes that item.",
        "On a host venue, a guest operator works that operator’s entity. The host can assign the operator on a new item.",
        "86 or un-86 from Menu or the 86 board. Stations see that immediately. New items, prices, modifiers, and categories reach stations after Publish, on the next PIN.",
      ),
      tip(
        "A stored menu file still becomes a draft from the text on the page when AI is off. Analyze does not run on a file that was only chosen and not uploaded. Describe with AI still uses category templates (burger, steak, pizza, salad, cocktail, …) for one item. You confirm before that item saves.",
      ),
      related("kitchen-bar-routing", "multi-operator-orders", "onboarding-wizard", "setup-by-voice"),
    ],
  }),
  topic({
    id: "kitchen-bar-routing",
    chapterId: "orders",
    title: "Kitchen vs bar routing",
    summary: "Food by menu group. Drinks by floor section. One Send, one slip per line.",
    roles: ["owner_manager", "kitchen_bar", "server"],
    keywords: ["routing", "station", "kitchen", "bar", "ticket", "fire", "destination", "course"],
    openView: "kitchen",
    blocks: [
      why(
        "A single-line kitchen should not drown in paper. Plate, sandwich, side, and dessert on one Star are one ticket — not four.",
      ),
      ul(
        "Food groups (Plates, Sandwich, Sides, Dessert, Salad, Pizza, …) each have an order destination and an order printer. Table section does not route food.",
        "Default for one kitchen: every food group → Kitchen → that one Star. Same destination + same printer on one Send is one slip. Map Salad or Pizza to another printer for a second slip.",
        "Drinks / bar-entity items fire to the bar printer for that table’s section (bar-rail / well is a section). If only one bar printer exists, every section maps to it. No bar printer: kitchen printer.",
        "Do not cut per menu group when those groups map to the same destination and printer. Do not cut per course unless Settings → Separate course tickets is on (default off).",
        "Hold a course to keep mains in the window until apps are bumped. Online / order-ahead uses fire rules (immediate, on arrival, delay).",
      ),
      steps(
        "On Order, tap items. The open check stays beside or under the menu — qty, name, entity, cash and card when cash discount is on. Do not hunt a Check button just to see what you rang. Check still opens split / edit / send.",
        "Send fires LAN 9100 from this station (or a queued docked host/ODS). This tablet does not pick the printer — the venue map does. Food groups mapped to destination Kitchen print on that Kitchen order printer as one ticket. Drinks print on the bar printer for that table’s section.",
        "Settings (or Menu): map a group to another destination or named printer when the house has a salad line, pizza, or pastry printer. Map Dessert off Kitchen → two slips on that Send.",
        "Kitchen order display shows food tickets; Bar ODS shows beverage tickets. Host floors still route by selling entity when printers are entity-scoped.",
        "When this device is online, Send writes the tickets to the location — every POS and ODS at that location sees the same check within a few seconds. Refresh keeps it.",
        "Expo or the server marks Delivered when the table has the plate.",
      ),
      related("kds", "menu-modifiers", "multi-operator-orders", "printers-kds", "receipts-by-vendor", "sections", "check-numbers"),
    ],
  }),
  topic({
    id: "check-numbers",
    chapterId: "orders",
    title: "Check numbers",
    summary: "Table plus that table’s daily sequence. Same id on every slip. No date in the number.",
    roles: ["owner_manager", "server", "kitchen_bar", "host_operator"],
    keywords: ["check number", "ticket", "T1-03", "guest check", "star", "ods", "qr"],
    openView: "order",
    blocks: [
      why(
        "The kitchen, the guest check, and the QR have to name the same check. The date is already on the ticket clock, so it is not repeated in the number.",
      ),
      p(
        "The visible id is assigned when the check opens. Format: T{table}-{seq}. Example: T1-03 is the third check opened on table 1 that venue day. To-go and any check with no table: TO-03. Bar tab: BAR-03. {seq} starts at 01 after local midnight in the venue IANA timezone, and it counts per table (to-go and bar each have their own count). It is not a forever #101 and not a separate number per selling entity. One house check, one id. The order id and the open time stay the reporting keys.",
      ),
      ul(
        "Two dining checks on table 1 the same day print T1-01 then T1-02. A check on table 2 the same minute is T2-01. To-go is TO-01 even if the dining room already has checks.",
        "After local midnight that table’s next new check is T1-01 again. A check still open from yesterday keeps T1-02 if that is the number it opened with.",
        "The bold guest-check number, Star kitchen ticket, order display, pay QR, and the on-screen check use that same id. None of them print YYMMDD in the number.",
      ),
      steps(
        "Open a table. The check number shows on the order pad as soon as the check exists.",
        "Send. The Star ticket header is that number, not a second kitchen counter.",
        "Print check. The Epson guest check header is the same number. The pay QR opens that check.",
      ),
      related("kitchen-bar-routing", "kds", "receipts-by-vendor", "floor-tables", "table-qr"),
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
        "A hall guest should not run three cards. The guest tenders once; capture splits to Operator A and Operator B merchants. Each still sees their own tickets and period payouts.",
      ),
      p(
        "Example: Host Venue. Guest orders tacos from Operator A and a cocktail from Operator B. One check, split capture to each merchant, two ODS tickets, receipt grouped by vendor.",
      ),
      steps(
        "Items carry the operator set on the menu. The hall cart can mix stalls on one check.",
        "Fire still routes by station + operator so Operator A’s kitchen does not see Operator B’s drinks.",
        "Pay once at the host stand (or table). The guest-facing name is the location. Finix pays each operator their share. The receipt groups lines by vendor.",
        "Period settlement still nets cash, host cut, fees, and any $35 dispute fee by merchandise share. ODS routing does not change.",
      ),
      shot(
        "One guest check with Operator A food lines and Operator B drink lines, single tender.",
        "Check panel showing two operators and one payment.",
      ),
      warn(
        "Do not take a second card “for the bar” on a host check. That breaks settlement and the guest receipt.",
      ),
      related("single-vs-multi", "host-capture", "receipts-by-vendor", "settlement", "chargebacks", "kds"),
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
        "Send from the floor. Tickets land on the kitchen or bar ODS for that station and operator — including a second tablet and a kitchen display, not only this station.",
        "Start when you begin prep (Preparing). Bump when the plate/drink is ready. Those actions persist on the location; the originating POS shows Ready without a refresh wait longer than a few seconds.",
        "The originating server’s device toasts, chimes, and vibrates (where the platform allows). The table pulses Up.",
        "Expo or the server marks Delivered on the floor. Recall if you bumped too early.",
        "Serverless food: when every food item on the check is bumped, the guest gets a text, Name, order id is ready. Pick up at the pickup label. A later drink on the bar ticket does not send that text again. Expo or staff tap Picked up to clear the pickup rail. An optional second text waits the minutes set on the venue if they have not picked up.",
        "Mute sound from the header bell. Multi-op: filter All operators or a single stall.",
        "Each ticket stamp (and the paper kitchen ticket) shows venue local time from Settings → Location timezone — not UTC and not the tablet’s zone.",
      ),
      callout(
        "Tickets are live across devices when online",
        "Open checks, sent lines, Start/Bump, table status, and cash payments are stored for the location. A second POS and the kitchen ODS share the same floor while the house is online. Offline, this station still works from its cache and queues the change; other devices catch up when the uplink returns. We do not pretend two tablets share a check with no internet.",
      ),
      tip(
        "Ahead and curbside tickets may wait until the guest is marked arrived — see Online fire rules if a ticket “never showed.”",
      ),
      related("kitchen-bar-routing", "device-roles", "wifi-offline", "floor-tables", "printers-kds", "troubleshooting"),
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
        "That fire writes a venue print job. A docked host, ODS, or the house print agent sends raw 9100 — the guest phone never prints. If no worker is online, the ticket stays open and stations show “N kitchen tickets waiting to print.”",
      ),
      related("kds", "kitchen-bar-routing", "tenders-tips", "printers-kds"),
    ],
  }),
];
