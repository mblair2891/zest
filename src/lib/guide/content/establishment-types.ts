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
        "Floor: color-coded sections. Host seats; servers keep the check.",
        "Typical nav: Floor, Order, Kitchen, Bar, Cash, Menu.",
      ),
      steps(
        "Seat a table from the floor map.",
        "Add food and drinks on one check.",
        "Send — kitchen sees plates, bar sees drinks.",
        "Print and take Quantum Payments once. Close the table.",
      ),
      ul(
        "Access: owner, manager, server, host stand, bartender, kitchen, busser, cashier, accountant.",
        "Dashboards: server sees sections; host sees waitlist; kitchen is KDS-first.",
        "Reports & AI insights are on this location — not a SaaS portfolio.",
      ),
      callout(
        "Payments",
        "Quantum Payments is the only guest card. Cash and first-party gift sit beside it. There is no processor picker.",
      ),
      p(
        "When the dining room is full, turn Waitlist on. The kiosk shows a wait range and takes the guest’s phone. Reservation check-in is last name + code.",
      ),
      cta(
        "/demo/restaurant/tour",
        "Open restaurant guided demo",
        "Seat, course, pay — then waitlist and check-in.",
      ),
      related("type-food-hall", "feature-waitlist", "feature-kiosk", "prospect-demos"),
    ],
  }),
  topic({
    id: "type-food-hall",
    chapterId: "types",
    title: "Host + multi-operator (food hall)",
    summary: "The Laundry model: one guest check, bar vs kitchen operators, settlement split.",
    roles: "all",
    keywords: [
      "food hall",
      "host",
      "multi-operator",
      "the laundry",
      "steam distillery",
      "diamond house",
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
        "Host brand — guest-facing name on the receipt (example: The Laundry).",
        "Bar operator — drinks and bar tickets (example: Steam Distillery).",
        "Kitchen operator — food and kitchen tickets (example: Diamond House BBQ).",
        "Stations: host stand / floor, bar KDS, kitchen KDS, shared cash.",
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
        "Access includes vendor_operator (Steam Distillery, Diamond House BBQ) plus host, cashier, and accountant.",
        "Vendor dashboards are scoped to that operator’s tickets and settlement share.",
      ),
      callout(
        "The Laundry (prospect demo)",
        "Steam Distillery is bar-only. Diamond House BBQ is kitchen. The guest never pays Steam or Diamond House directly. This is a labeled demo house, not a live tenant. Start guided demo on Platform → Demos (or /demo/food_hall/tour) to walk it with voiceover on the live floor.",
      ),
      warn(
        "Do not mix this demo into Tenants or statistics. Platform → Demos is the control surface. Reset demos never deletes live orgs.",
      ),
      cta(
        "/demo/food_hall/tour",
        "Open The Laundry guided demo",
        "Public /demo/food_hall. Exit returns to the demo list — not the control plane.",
      ),
      related("host-capture", "chargebacks", "system-ledger", "prospect-demos", "type-restaurant"),
    ],
  }),
  topic({
    id: "type-bar-lounge",
    chapterId: "types",
    title: "Bar & lounge",
    summary: "Tabs first, cocktail KDS, optional small plates.",
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
        "Order flow: open tab → build the round → send cocktail KDS → pay Quantum Payments.",
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
      p(
        "A lounge waitlist is the same kiosk flow. Tabs are not a substitute for a quoted wait when the room is full.",
      ),
      cta("/demo/bar_lounge/tour", "Open bar & lounge guided demo"),
      related("type-restaurant", "feature-waitlist", "prospect-demos"),
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
      p(
        "QSR kiosks usually stay on Order. Enable Combined only if you also take names for a make-line wait.",
      ),
      cta("/demo/qsr/tour", "Open QSR guided demo"),
      related("type-cafe", "type-ghost-kitchen", "prospect-demos"),
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
      cta("/demo/cafe/tour", "Open café guided demo"),
      related("type-qsr", "type-bar-lounge", "prospect-demos"),
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
        "Order flow: window check → truck KDS → pay. Host capture is optional by agreement.",
      ),
      steps(
        "Open the lot map. Pads are the floor.",
        "Take a window order on the truck brand.",
        "Kitchen tickets stay on the truck KDS.",
        "When the host captures, Quantum Payments is still the only card.",
      ),
      callout(
        "Multi-operator",
        "A pod can settle trucks like a hall settles stalls. Use host + operators when more than one window feeds a shared capture.",
      ),
      cta("/demo/truck_pod/tour", "Open truck pod guided demo"),
      related("type-food-hall", "host-capture", "prospect-demos"),
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
      cta("/demo/ghost_kitchen/tour", "Open ghost kitchen guided demo"),
      related("type-qsr", "type-catering", "prospect-demos"),
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
      cta("/demo/catering/tour", "Open catering guided demo"),
      related("type-ghost-kitchen", "type-restaurant", "prospect-demos"),
    ],
  }),
];
