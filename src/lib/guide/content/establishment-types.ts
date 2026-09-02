import { callout, cta, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const ESTABLISHMENT_TYPE_TOPICS: GuideTopic[] = [
  topic({
    id: "type-restaurant",
    chapterId: "types",
    title: "Full-service restaurant",
    summary: "Tables, sections, host stand, kitchen and bar on one brand.",
    roles: "all",
    keywords: ["restaurant", "dining room", "sections", "host stand", "full service"],
    openView: "floor",
    blocks: [
      why(
        "A restaurant is one guest-facing brand. The floor is tables in sections. Kitchen and bar still split tickets; the guest pays once.",
      ),
      p(
        "Use this type when you run a dining room — not a hall of operators, not a counter-only window.",
      ),
      ul(
        "Stations: host stand, dining sections, optional bar, kitchen / expo.",
        "Floor: drag-and-drop layout, color-coded statuses, optional SLA flash. Host seats; servers keep the check.",
        "Typical nav: Floor, Order, Kitchen, Bar, Cash, Menu.",
      ),
      steps(
        "Seat a table from the floor map (or draw the room in Floor editor).",
        "Add food and drinks on one check. Status colors move as you send.",
        "Send — kitchen sees plates, bar sees drinks.",
        "Print a check with pay QR, or take Quantum Payments once. Closed tables need bus, then empty.",
      ),
      ul(
        "Access: owner, manager, server, host stand, bartender, kitchen, busser, cashier, accountant.",
        "Dashboards: server sees sections; host sees waitlist; kitchen is ODS-first.",
        "Reports & AI insights are on this location — not a SaaS portfolio.",
      ),
      callout(
        "Payments",
        "Quantum Payments is the only guest card. Cash and first-party gift sit beside it. There is no processor picker.",
      ),
      callout(
        "Tips",
        "Typical: individual + mix-based tip-out. Switch to FOH or dual pool if the house shares. Pooling rules vary by state — Summex calculates policy only.",
      ),
      p(
        "When the dining room is full, turn Waitlist on. The kiosk shows a wait range and takes the guest’s phone. Reservation check-in is last name + code.",
      ),
      cta(
        "/get-pricing",
        "Onboard a restaurant",
        "Create a real location through SaaS. There is no seeded demo house.",
      ),
      related("type-food-hall", "floor-editor", "floor-status", "table-qr", "feature-waitlist", "feature-kiosk", "tip-pooling"),
    ],
  }),
  topic({
    id: "type-food-hall",
    chapterId: "types",
    title: "Host + multi-operator (food hall)",
    summary: "One guest check, bar vs kitchen operators, settlement split.",
    roles: "all",
    keywords: [
      "food hall",
      "host",
      "multi-operator",
      "host venue",
      "operator a",
      "operator b",
      "settlement",
    ],
    openView: "hall",
    blocks: [
      why(
        "When more than one operator feeds the same guest, the house still presents one brand and one card. Operators are paid from the period ledger — not from a second terminal.",
      ),
      p(
        "The guest sits at the host brand. Lines keep their operator. Kitchen and bar rails stay apart. Capture is Quantum Payments under the host.",
      ),
      ul(
        "Host brand — guest-facing name on the receipt (example: Host Venue).",
        "Bar operator — drinks and bar tickets (example: Operator B).",
        "Kitchen operator — food and kitchen tickets (example: Operator A).",
        "Stations: host stand / floor (color-coded map + table QR), bar ODS, kitchen ODS, shared cash.",
      ),
      steps(
        "Seat under the host. Do not open a second check for the other operator.",
        "Add a drink (bar operator) and a plate (kitchen operator) on the same check.",
        "Send once. Bar sees only bar lines; kitchen sees only kitchen lines.",
        "Pay once with Quantum Payments under the host brand.",
        "On Settle, merchandise, card fees, and the host cut allocate per operator.",
        "If a dispute is filed — only then — a $35 fee splits by merchandise share on that check.",
      ),
      ul(
        "Access includes vendor_operator (Operator A, Operator B) plus host, cashier, and accountant.",
        "Vendor dashboards are operator ops: tickets, 86, staff. Host settings hold payouts and tax.",
      ),
      callout(
        "Host + operators",
        "Onboard a food-hall style location with two operators to rehearse bar vs kitchen on one guest check. Example names in this guide are not tenants.",
      ),
      warn(
        "Customer tenants appear after SaaS onboarding. There is no public demo site and no seeded catalog.",
      ),
      cta(
        "/get-pricing",
        "Onboard a host + operators location",
        "Intake and the setup wizard create a real tenant. Marketing Get pricing is this path.",
      ),
      callout(
        "Tips",
        "Each employer inherits or overrides the location pool. Dual pool if food vs drink operators share a floor. The host does not pool across operators unless that employer says so.",
      ),
      related("host-capture", "chargebacks", "system-ledger", "single-vs-multi", "type-restaurant", "tip-pooling"),
    ],
  }),
  topic({
    id: "type-bar-lounge",
    chapterId: "types",
    title: "Bar & lounge",
    summary: "Tabs first, cocktail ODS, optional small plates.",
    roles: "all",
    keywords: ["bar", "lounge", "tab", "cocktails", "well"],
    openView: "bar",
    blocks: [
      why(
        "Service starts at the well. A named tab is the check — not a dining-room four-top.",
      ),
      ul(
        "Stations: bar / well, optional lounge tables, light kitchen for plates.",
        "Floor: bar rail plus lounge section if you have table service.",
        "Order flow: open tab → build the round → send cocktail ODS → pay Quantum Payments.",
      ),
      steps(
        "Open a named tab (or seat a lounge table).",
        "Add cocktails; small plates still route to kitchen.",
        "Bump the bar rail when the glass is up.",
        "Close on Quantum Payments. One receipt, house brand.",
      ),
      callout(
        "Payments",
        "Quantum Payments is the only guest card. Tabs are not a second processor.",
      ),
      callout(
        "Tips",
        "Typical: bar pool — all wells together, or each well on its own. Mix-based tip-out is optional.",
      ),
      p(
        "A lounge waitlist is the same kiosk flow. Tabs are not a substitute for a quoted wait when the room is full.",
      ),
      cta("/get-pricing", "Onboard a bar & lounge"),
      related("type-restaurant", "feature-waitlist", "feature-kiosk", "tip-pooling"),
    ],
  }),
  topic({
    id: "type-qsr",
    chapterId: "types",
    title: "Quick service",
    summary: "Counter and make line. No table map required.",
    roles: "all",
    keywords: ["qsr", "counter", "window", "quick service", "drive-thru"],
    openView: "order",
    blocks: [
      why(
        "Speed is the product. The check is the queue — not a seated dining room.",
      ),
      ul(
        "Stations: counter register, make line / kitchen, optional drive-thru.",
        "Floor: none, or a single counter marker.",
        "Order flow: open check → add items → send line → pay → complete.",
      ),
      steps(
        "Open a counter check.",
        "Add mains and a drink. Kitchen vs fountain still split.",
        "Send. The make line is the source of truth.",
        "Take Quantum Payments at the register and close.",
      ),
      callout("Payments", "One card at the counter. Quantum Payments only."),
      callout(
        "Tips",
        "Typical: individual. Team pool if the counter shares. Pooling rules vary by state — policy only.",
      ),
      p(
        "QSR kiosks usually stay on Order. Enable Combined only if you also take names for a make-line wait.",
      ),
      cta("/get-pricing", "Onboard a QSR"),
      related("type-cafe", "type-ghost-kitchen", "feature-kiosk", "tip-pooling"),
    ],
  }),
  topic({
    id: "type-cafe",
    chapterId: "types",
    title: "Café / bakery",
    summary: "Counter, espresso bar, and pastry on one check.",
    roles: "all",
    keywords: ["cafe", "café", "bakery", "espresso", "pastry", "counter"],
    openView: "order",
    blocks: [
      why(
        "Barista and baker share a guest. They do not share a station.",
      ),
      ul(
        "Stations: counter, espresso bar, pastry / kitchen.",
        "Floor: counter queue. Tables are optional.",
        "Order flow: counter check → drink + pastry → route apart → pay once.",
      ),
      steps(
        "Open a counter check.",
        "Add a drink (bar) and a pastry (kitchen).",
        "Send so each station gets its ticket.",
        "Pay once with Quantum Payments.",
      ),
      callout(
        "Tips",
        "Typical: team pool (counter + espresso), or individual + tip-out between bar and pastry.",
      ),
      cta("/get-pricing", "Onboard a café"),
      related("type-qsr", "type-bar-lounge", "feature-kiosk", "tip-pooling"),
    ],
  }),
  topic({
    id: "type-truck-pod",
    chapterId: "types",
    title: "Truck pod",
    summary: "Pads, power, and window orders under a lot host.",
    roles: "all",
    keywords: ["truck", "pod", "pad", "lot", "window"],
    openView: "truck_pod",
    blocks: [
      why(
        "The lot host owns pads and power. Each truck still runs its own window. The guest is not in a dining room.",
      ),
      ul(
        "Stations: lot / pad map, truck window, truck kitchen.",
        "Floor: pads, not tables.",
        "Order flow: window check → truck ODS → pay. Host capture is optional by agreement.",
      ),
      steps(
        "Open the lot map. Pads are the floor.",
        "Take a window order on the truck brand.",
        "Kitchen tickets stay on the truck ODS.",
        "When the host captures, Quantum Payments is still the only card.",
      ),
      callout(
        "Multi-operator",
        "A pod can settle trucks like a hall settles stalls. Use host + operators when more than one window feeds a shared capture.",
      ),
      callout(
        "Tips",
        "Typical: individual per window. The lot host does not pool across trucks.",
      ),
      cta("/get-pricing", "Onboard a truck pod"),
      related("type-food-hall", "host-capture", "settlement", "tip-pooling"),
    ],
  }),
  topic({
    id: "type-ghost-kitchen",
    chapterId: "types",
    title: "Ghost kitchen",
    summary: "No dining room. Brands, expo, and dispatch.",
    roles: "all",
    keywords: ["ghost", "cloud kitchen", "dispatch", "takeout", "expo"],
    openView: "kitchen",
    blocks: [
      why(
        "There is no host stand. Expo and courier handoff replace the dining room.",
      ),
      ul(
        "Stations: make line, expo, dispatch / takeout.",
        "Floor: none.",
        "Order flow: takeout check → kitchen rail → handoff → Quantum Payments on the brand.",
      ),
      steps(
        "Open a dispatch / takeout check.",
        "Send to the make line.",
        "Bump when the bag is ready.",
        "Close on Quantum Payments. No second processor for delivery.",
      ),
      callout(
        "Tips",
        "Typical: individual — no dining-room pool.",
      ),
      cta("/get-pricing", "Onboard a ghost kitchen"),
      related("type-qsr", "type-catering", "kds", "tip-pooling"),
    ],
  }),
  topic({
    id: "type-catering",
    chapterId: "types",
    title: "Catering",
    summary: "Event checks, packing, and a kitchen that is not a dining room.",
    roles: "all",
    keywords: ["catering", "event", "off-site", "pack", "commissary"],
    openView: "order",
    blocks: [
      why(
        "The check is the job — not a seated four-top. Production happens in a commissary or packing line.",
      ),
      ul(
        "Stations: sales / coordinator, prep kitchen, packing, runner.",
        "Floor: optional. The event is the unit of work.",
        "Order flow: build the event check → send pack list → close the job on Quantum Payments.",
      ),
      steps(
        "Open an event check.",
        "Add plates and sides for the drop.",
        "Send so the commissary line sees the pack list.",
        "Capture once for the job.",
      ),
      callout(
        "Tips",
        "Typical: team pool on the event crew, or individual.",
      ),
      cta("/get-pricing", "Onboard a catering kitchen"),
      related("type-ghost-kitchen", "type-restaurant", "menu-modifiers", "tip-pooling"),
    ],
  }),
];
