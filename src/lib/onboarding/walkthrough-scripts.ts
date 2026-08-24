import type { TourDefinition, TourStep } from "@/lib/demo/tour-scripts";
import type { WalkthroughKey } from "./context";

function w(
  id: string,
  title: string,
  subtitle: string,
  steps: TourStep[],
): TourDefinition {
  return { id, title, subtitle, kind: "walkthrough", steps };
}

const OWNER: TourDefinition = w(
  "walkthrough:owner",
  "Owner workflow",
  "Your house — snapshot, settings, reports.",
  [
    {
      id: "ow-home",
      title: "Owner Home",
      script:
        "This is your job dashboard. Live sales, open checks, waitlist, and who is on the clock. Nav on the left only shows what an owner can open.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "ow-settings",
      title: "Location settings",
      script:
        "On a hall, this is Host settings — tax, Quantum Payments, cash discount, payout destinations. Guest operators never open this pack.",
      selector: "[data-demo='settings']",
      view: "settings",
    },
    {
      id: "ow-staff",
      title: "Staff PINs",
      script:
        "Add people and access levels. Servers stay in their sections. Vendor operators only see their stall on a host floor.",
      selector: "[data-demo='employees']",
      view: "employees",
    },
    {
      id: "ow-floor",
      title: "Floor",
      script:
        "The map is the same screen servers use. You can grant a table outside a section when the room is slammed.",
      selector: "[data-demo='floor']",
      view: "floor",
    },
    {
      id: "ow-reports",
      title: "Reports",
      script:
        "Sales, tenders, ticket times, waitlist. Export CSV. This is the house recap — not a platform portfolio.",
      selector: "[data-demo='reports']",
      view: "reports",
    },
    {
      id: "ow-ai",
      title: "AI insights",
      script:
        "Run analysis on this location. Recommendations jump to a screen. They do not rewrite prices by themselves.",
      selector: "[data-demo='ai-insights']",
      view: "reports",
    },
    {
      id: "ow-settle",
      title: "Settlement",
      script:
        "On a host floor, you own payouts and period close. Guest operators see a report slice only. Guest cards stay Quantum Payments. A $35 dispute fee splits by merchandise.",
      selector: "[data-demo='settlement']",
      view: "settlement",
    },
    {
      id: "ow-offline",
      title: "Offline",
      script:
        "If internet drops, this house still seats, sends, bumps, and takes cash. Card needs a connection. The Wi‑Fi chip shows the outbox. Failed syncs are yours to clear.",
      selector: "[data-demo='network-chip']",
      view: "hq",
    },
    {
      id: "ow-done",
      title: "Replay any time",
      script:
        "Replay this workflow from Guide or Replay workflow in the header. Latest updates appear after login until you silence them.",
      selector: "[data-demo='home']",
      view: "hq",
    },
  ],
);

const MANAGER: TourDefinition = w(
  "walkthrough:manager",
  "Manager workflow",
  "Floor, staff, reports — not org billing.",
  [
    {
      id: "mg-home",
      title: "Manager Home",
      script:
        "Same snapshot as the owner for this location. You run the shift. You do not delete the organization.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "mg-floor",
      title: "Floor and sections",
      script:
        "Watch covers. Grant a table when a server is out of section. The map is live, not a mock.",
      selector: "[data-demo='floor']",
      view: "floor",
    },
    {
      id: "mg-kitchen",
      title: "Kitchen glance",
      script:
        "Open tickets. If the pit is backed up, that is a labor and fire-time problem — reports will say so.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "mg-staff",
      title: "Who is on",
      script: "Clock, PINs, and section assignments. Comps and voids are your PIN, not the server’s.",
      selector: "[data-demo='employees']",
      view: "employees",
    },
    {
      id: "mg-reports",
      title: "Reports",
      script: "Shift recap: tenders, voids, ticket times. Run AI insights when you want a recommendation on this house.",
      selector: "[data-demo='reports']",
      view: "reports",
    },
    {
      id: "mg-settings",
      title: "Location settings",
      script:
        "You can edit packs for this type. Cash discount, hours, kiosk, waitlist. Org billing stays with the owner on the control plane.",
      selector: "[data-demo='settings']",
      view: "settings",
    },
    {
      id: "mg-done",
      title: "Replay",
      script: "Replay from Guide whenever you train a new manager on this house.",
      selector: "[data-demo='home']",
      view: "hq",
    },
  ],
);

const SERVER: TourDefinition = w(
  "walkthrough:server",
  "Server workflow",
  "Sections, order, send, pay.",
  [
    {
      id: "sv-home",
      title: "Your dashboard",
      script:
        "Open checks on your sections, seated tables, and kitchen-up alerts. You do not see settings or another server’s sections.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "sv-floor",
      title: "Floor and sections",
      script:
        "Color-coded sections. Seat only where you are assigned unless a manager grants a table.",
      selector: "[data-demo='floor']",
      view: "floor",
      action: "seat",
    },
    {
      id: "sv-order",
      title: "Build the check",
      script:
        "One guest check. On a host floor, food and drinks from different stalls still live here. Do not open a second card for another operator.",
      selector: "[data-demo='order']",
      view: "order",
      action: "add_food",
    },
    {
      id: "sv-send",
      title: "Send",
      script:
        "Send once. Kitchen and bar split the ticket. The guest never runs two cards.",
      selector: "[data-demo='order']",
      view: "order",
      action: "send",
    },
    {
      id: "sv-pay",
      title: "Quantum Payments",
      script:
        "Take the card here. Quantum Payments is the only guest processor. Cash discount, if the house enabled it, is a tender — not a second gateway.",
      selector: "[data-demo='order']",
      view: "order",
      action: "pay",
    },
    {
      id: "sv-up",
      title: "Kitchen up",
      script:
        "When the pit bumps, you get a toast and the table pulses Up. Run the food. You do not bump tickets from the floor.",
      selector: "[data-demo='floor']",
      view: "floor",
    },
    {
      id: "sv-offline",
      title: "If the internet dies",
      script:
        "Keep selling. Cash and send still work. Card shows Card requires connection. Do not open a second check.",
      selector: "[data-demo='network-chip']",
      view: "order",
    },
    {
      id: "sv-done",
      title: "That’s the job",
      script:
        "Seat, order, send, pay. Replay from Guide if you want the path again.",
      selector: "[data-demo='home']",
      view: "hq",
    },
  ],
);

const HOST: TourDefinition = w(
  "walkthrough:host",
  "Host stand workflow",
  "Waitlist, reservations, seating.",
  [
    {
      id: "hs-home",
      title: "Host Home",
      script:
        "Waiting parties, open tables, seated covers. You own the door — not the check.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "hs-wait",
      title: "Waitlist",
      script:
        "Names, party size, quoted wait. The guest kiosk can join this same list. Staff notify when a table is ready.",
      selector: "[data-demo='waitlist']",
      view: "waitlist",
      action: "waitlist_join",
    },
    {
      id: "hs-floor",
      title: "Seat the floor",
      script:
        "When a table opens, seat from the map. Assign the server’s section. Do not leave a party on waitlist after they sit.",
      selector: "[data-demo='floor']",
      view: "floor",
      action: "seat",
    },
    {
      id: "hs-res",
      title: "Reservation check-in",
      script:
        "Check-in is last name plus a short code. The kiosk can do this for the guest. You can do it here at the stand.",
      selector: "[data-demo='waitlist']",
      view: "waitlist",
    },
    {
      id: "hs-kiosk",
      title: "Kiosk is for guests",
      script:
        "Large targets, order or waitlist or check-in. You stay on this stand. Demo mode can switch the device if you are training.",
      selector: "[data-demo='device-switcher'], [data-demo='waitlist']",
      view: "waitlist",
    },
    {
      id: "hs-done",
      title: "Replay",
      script: "Replay from Guide when you train a new host.",
      selector: "[data-demo='home']",
      view: "hq",
    },
  ],
);

const BARTENDER: TourDefinition = w(
  "walkthrough:bartender",
  "Bartender workflow",
  "Well, tabs, bump.",
  [
    {
      id: "bt-home",
      title: "Bar Home",
      script: "Open bar tickets and tabs. You pour. You do not take the dining-room card unless you are closing a tab.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "bt-kds",
      title: "Bar rail",
      script:
        "This is the cocktail KDS. Tickets tagged bar land here — not the pit. Start, bump, recall.",
      selector: "[data-demo='bar']",
      view: "bar",
    },
    {
      id: "bt-bump",
      title: "Bump",
      script:
        "Bump tells the floor the drink is up. On a host floor you only see your operator’s rail.",
      selector: "[data-demo='bar']",
      view: "bar",
      action: "bump_bar",
    },
    {
      id: "bt-tab",
      title: "Named tabs",
      script: "Open a tab at the well. Food still routes to kitchen on the same guest check.",
      selector: "[data-demo='order']",
      view: "order",
      action: "add_drink",
    },
    {
      id: "bt-pay",
      title: "Close the tab",
      script: "Quantum Payments once. House brand on the receipt. No second processor.",
      selector: "[data-demo='order']",
      view: "order",
      action: "pay",
    },
    {
      id: "bt-done",
      title: "Replay",
      script: "Replay from Guide. Device · KDS Bar is the same rail on a dedicated screen.",
      selector: "[data-demo='bar']",
      view: "bar",
    },
  ],
);

const KITCHEN: TourDefinition = w(
  "walkthrough:kitchen",
  "Kitchen workflow",
  "Tickets, bump, 86.",
  [
    {
      id: "kt-home",
      title: "Expo Home",
      script: "Open pit tickets. You cook. You do not take the guest card from this screen.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "kt-rail",
      title: "Kitchen rail",
      script:
        "Tickets fire here. On a host floor you only see your operator — Diamond House does not see Steam’s well.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "kt-bump",
      title: "Bump",
      script:
        "Bump tells the floor the plate is up. Toast, chime, table pulse. Do not bump someone else’s ticket.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
      action: "bump_kitchen",
    },
    {
      id: "kt-86",
      title: "86",
      script:
        "86 lives on the item, not a sticky note. Servers see it on the next add. Ask a manager if you cannot 86.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "kt-offline",
      title: "Offline pit",
      script:
        "Tickets already on this station still bump when internet is down. New sends from the floor land if you are on the same device or LAN. Cloud reports wait.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "kt-done",
      title: "Device mode",
      script:
        "Kitchen KDS as a device is this same rail full-screen. Replay from Guide whenever you train a new expo.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
  ],
);

const CASHIER: TourDefinition = w(
  "walkthrough:cashier",
  "Cashier workflow",
  "Counter queue and pay.",
  [
    {
      id: "ca-home",
      title: "Register Home",
      script: "Counter queue. You own pay at the register — not table sections.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "ca-order",
      title: "Open a check",
      script: "The check is the queue. Add items. Food and drinks still route to their stations.",
      selector: "[data-demo='order']",
      view: "order",
      action: "counter_open",
    },
    {
      id: "ca-add",
      title: "Add items",
      script: "Scan or tap. Modifiers before send. You do not need a seated table for counter service.",
      selector: "[data-demo='order']",
      view: "order",
      action: "add_food",
    },
    {
      id: "ca-pay",
      title: "Pay once",
      script:
        "Quantum Payments at the register. Cash drawer if they pay cash. Cash discount is a house setting, not a second processor.",
      selector: "[data-demo='order']",
      view: "order",
      action: "pay",
    },
    {
      id: "ca-cash",
      title: "Cash drawer",
      script: "Paid-in, paid-out, and the drop live here. You do not close the period unless you also have manager access.",
      selector: "[data-demo='cash']",
      view: "cash",
    },
    {
      id: "ca-done",
      title: "Replay",
      script: "Replay from Guide when you train a new cashier.",
      selector: "[data-demo='home']",
      view: "hq",
    },
  ],
);

const VENDOR: TourDefinition = w(
  "walkthrough:vendor_operator",
  "Vendor operator workflow",
  "Operator ops — not host settings.",
  [
    {
      id: "vo-home",
      title: "Your stall",
      script:
        "This dashboard is your entity. Edit your menu and tickets. Peer menus are view-only unless the host grants edit. You never change another stall’s settings.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "vo-ops",
      title: "Operator ops",
      script:
        "Staff, time clock, 86, and your week. Open Menu for your items — foreign rows badge as view only. You do not get host tax, cash discount, or payout routing. You cannot write another entity’s schedule or payroll.",
      selector: "[data-demo='operator-ops']",
      view: "vendor_portal",
    },
    {
      id: "vo-tickets",
      title: "Your tickets",
      script:
        "Kitchen or bar rail — only your lines. Bump your food. You do not take the guest card.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "vo-slice",
      title: "Your settlement slice",
      script:
        "Merchandise, fees, host cut — view only. A $35 dispute fee, when filed, splits by your share. You cannot mark payouts sent or edit the host MID.",
      selector: "[data-demo='operator-ops']",
      view: "vendor_portal",
    },
    {
      id: "vo-reports",
      title: "Your reports",
      script: "Reports are your mix, not the hall’s. AI insights stay on this operator.",
      selector: "[data-demo='reports']",
      view: "reports",
    },
    {
      id: "vo-done",
      title: "Replay",
      script: "Replay from Guide. On a multi-operator demo, switch stalls from Demo mode to see the other brand.",
      selector: "[data-demo='home']",
      view: "hq",
    },
  ],
);

const ACCOUNTANT: TourDefinition = w(
  "walkthrough:accountant",
  "Accountant workflow",
  "Reports, ledger, settlement — limited ops.",
  [
    {
      id: "ac-home",
      title: "Finance Home",
      script: "You see money, not the floor map as a server. Nav hides seating and 86.",
      selector: "[data-demo='home']",
      view: "hq",
    },
    {
      id: "ac-reports",
      title: "Reports",
      script: "Sales, tenders, comps, ticket times. Export CSV. This location only — not a SaaS rollup.",
      selector: "[data-demo='reports']",
      view: "reports",
    },
    {
      id: "ac-ai",
      title: "AI insights",
      script: "Cost vs ordering and performance when inventory is linked. Apply jumps; it does not post a journal for you.",
      selector: "[data-demo='ai-insights']",
      view: "reports",
    },
    {
      id: "ac-ledger",
      title: "Ledger",
      script:
        "Append-only Quantum Payments ledger: capture, allocations, dispute fee. CSV export. Do not rewrite a row out of band.",
      selector: "[data-demo='ledger']",
      view: "ledger",
    },
    {
      id: "ac-settle",
      title: "Settlement",
      script: "Period close and operator rows on a host floor. Guest cards are Quantum Payments.",
      selector: "[data-demo='settlement']",
      view: "settlement",
    },
    {
      id: "ac-done",
      title: "Replay",
      script: "Replay from Guide. You still cannot seat a table or bump a ticket.",
      selector: "[data-demo='home']",
      view: "hq",
    },
  ],
);

const KIOSK: TourDefinition = w(
  "walkthrough:kiosk",
  "Guest kiosk workflow",
  "Order, waitlist, check-in — large targets.",
  [
    {
      id: "ki-home",
      title: "Guest kiosk",
      script:
        "This screen is for the guest. Staff stay on the stand. Large targets. House name on the header.",
      route: { to: "/kiosk" },
      selector: "[data-demo='kiosk-home']",
      kioskPane: "home",
    },
    {
      id: "ki-order",
      title: "Order",
      script: "Guest builds a check. It still routes to kitchen and bar. Pay is Quantum Payments.",
      selector: "[data-demo='kiosk-order'], [data-demo='kiosk-home']",
      kioskPane: "order",
    },
    {
      id: "ki-wait",
      title: "Waitlist",
      script:
        "Join the same list the host stand sees. Quoted wait uses the house estimate, not a guess on the glass.",
      selector: "[data-demo='kiosk-waitlist'], [data-demo='kiosk-home']",
      kioskPane: "waitlist",
    },
    {
      id: "ki-check",
      title: "Check in",
      script:
        "Reservation check-in: last name plus a short code. Demo code is listed on the host stand topic.",
      selector: "[data-demo='kiosk-checkin'], [data-demo='kiosk-home']",
      kioskPane: "checkin",
    },
    {
      id: "ki-switch",
      title: "Back to staff",
      script:
        "Demo mode switches this device back to Floor POS, KDS, or a role. Live kiosks stay locked to guests.",
      selector: "[data-demo='device-switcher'], [data-demo='kiosk-home']",
    },
  ],
);

const KDS_KITCHEN: TourDefinition = w(
  "walkthrough:kds_kitchen",
  "Kitchen KDS",
  "Dedicated pit display.",
  [
    {
      id: "kd-rail",
      title: "Kitchen KDS",
      script:
        "This device is the pit. Tickets from the floor and kiosk land here. You bump. You do not pay.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "kd-ticket",
      title: "Read the ticket",
      script: "Item, mods, table or counter number, operator on a host floor. Start when you fire.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "kd-bump",
      title: "Bump",
      script: "Bump notifies the floor. Recall if you bumped too soon.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
      action: "bump_kitchen",
    },
    {
      id: "kd-scope",
      title: "Your station only",
      script: "Bar tickets do not belong here. Switch Demo mode to KDS Bar to see the well.",
      selector: "[data-demo='device-switcher'], [data-demo='kitchen']",
      view: "kitchen",
    },
    {
      id: "kd-done",
      title: "Replay",
      script: "Replay from Guide. Sign out of the device when the shift ends.",
      selector: "[data-demo='kitchen']",
      view: "kitchen",
    },
  ],
);

const KDS_BAR: TourDefinition = w(
  "walkthrough:kds_bar",
  "Bar KDS",
  "Dedicated well display.",
  [
    {
      id: "kb-rail",
      title: "Bar KDS",
      script: "This device is the well. Cocktail tickets only. Kitchen stays on the other screen.",
      selector: "[data-demo='bar']",
      view: "bar",
    },
    {
      id: "kb-bump",
      title: "Bump",
      script: "Bump tells the floor the round is up.",
      selector: "[data-demo='bar']",
      view: "bar",
      action: "bump_bar",
    },
    {
      id: "kb-scope",
      title: "Operator rail",
      script: "On a host floor this is your bar brand only. Food tickets never appear here.",
      selector: "[data-demo='bar']",
      view: "bar",
    },
    {
      id: "kb-switch",
      title: "Switch device",
      script: "Demo mode returns you to Floor POS or Kitchen KDS. Live bar displays stay locked.",
      selector: "[data-demo='device-switcher'], [data-demo='bar']",
      view: "bar",
    },
    {
      id: "kb-done",
      title: "Replay",
      script: "Replay from Guide when you train a new well.",
      selector: "[data-demo='bar']",
      view: "bar",
    },
  ],
);

const PLATFORM: TourDefinition = w(
  "walkthrough:platform_admin",
  "Platform Admin workflow",
  "Console, pipeline, demos — not a restaurant PIN.",
  [
    {
      id: "pa-console",
      title: "Console",
      script:
        "Live organizations only. Demo houses are tagged demo and never appear in tenants, billing, or statistics.",
      route: { to: "/dashboard" },
      selector: "[data-demo='platform-console-nav'], [data-demo='platform-console']",
      platformSurface: "console",
    },
    {
      id: "pa-tenants",
      title: "Tenants",
      script:
        "Empty tenants is valid. Do not expect The Laundry here. Support actions stay on the live org.",
      selector: "[data-demo='platform-console']",
      platformSurface: "console",
    },
    {
      id: "pa-pipe",
      title: "Pipeline",
      script:
        "Prospects from intake through quote, contract, and onboarding. This is SaaS, not a floor login.",
      selector: "[data-demo='platform-pipeline-nav'], [data-demo='platform-pipeline']",
      platformSurface: "pipeline",
    },
    {
      id: "pa-demos",
      title: "Demos",
      script:
        "Share a type link or the full product tour. Isolated rooms. Never send Admin credentials to a prospect.",
      selector: "[data-demo='platform-demos-nav']",
      platformSurface: "demos",
    },
    {
      id: "pa-pos",
      title: "Open POS",
      script:
        "Open POS launches a location you already onboarded. Product demos stay under Demos.",
      selector: "[data-demo='platform-open-pos']",
      platformSurface: "console",
    },
    {
      id: "pa-done",
      title: "Replay",
      script:
        "Replay from Guide. Location staff never see these platform notes in Latest updates.",
      selector: "[data-demo='platform-console-nav']",
      platformSurface: "console",
    },
  ],
);

export const WALKTHROUGH_TOURS: Record<string, TourDefinition> = {
  "walkthrough:owner": OWNER,
  "walkthrough:manager": MANAGER,
  "walkthrough:server": SERVER,
  "walkthrough:host": HOST,
  "walkthrough:bartender": BARTENDER,
  "walkthrough:kitchen": KITCHEN,
  "walkthrough:cashier": CASHIER,
  "walkthrough:vendor_operator": VENDOR,
  "walkthrough:accountant": ACCOUNTANT,
  "walkthrough:kiosk": KIOSK,
  "walkthrough:kds_kitchen": KDS_KITCHEN,
  "walkthrough:kds_bar": KDS_BAR,
  "walkthrough:platform_admin": PLATFORM,
};

export function getWalkthrough(key: WalkthroughKey): TourDefinition | null {
  if (key === "busser") return SERVER;
  return WALKTHROUGH_TOURS[`walkthrough:${key}`] ?? null;
}

export function listWalkthroughIds(): string[] {
  return Object.keys(WALKTHROUGH_TOURS);
}
