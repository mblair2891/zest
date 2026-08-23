import type { EmployeeRole, PosView } from "./types";

export type ManualAudience = EmployeeRole[] | "all";

export interface ManualBlock {
  type: "p" | "ul" | "ol" | "tip" | "warn" | "steps";
  text?: string;
  items?: string[];
}

export interface ManualSection {
  id: string;
  title: string;
  summary: string;
  /** Who this chapter is written for */
  audience: ManualAudience;
  /** Optional deep-link into POS */
  openView?: PosView;
  blocks: ManualBlock[];
}

export interface ProductUpdate {
  id: string;
  /** ISO date YYYY-MM-DD */
  date: string;
  title: string;
  summary: string;
  /** Roles that should see this update; "all" = everyone */
  roles: ManualAudience;
  /** Jump target in the interactive manual */
  manualSectionId?: string;
  tags?: string[];
}

/** Bump MANUAL_VERSION when shipping a batch of docs/features together */
export const MANUAL_VERSION = "2026.08.13";
export const MANUAL_EDITION = "Interactive · August 2026";

/**
 * Newest first. Keep ~10–15 recent entries so the login popup stays useful.
 * When you ship a feature, add a row here so the What’s New popup surfaces it.
 */
export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "upd_2026_08_13_summex_pay",
    date: "2026-08-13",
    title: "Summex Payments is the only processor",
    summary:
      "Integrations no longer offers Stripe, Square, or other card processors. Every check runs through Summex Payments. Deposits, rates, terminals, and disputes live on that panel. Delivery and accounting partners stay.",
    roles: ["owner", "manager"],
    manualSectionId: "hq-integrations",
    tags: ["payments", "integrations"],
  },
  {
    id: "upd_2026_08_13_gift_ledger",
    date: "2026-08-13",
    title: "First-party gift cards + import",
    summary:
      "Gift balances live only in Summex. Issue, reload, freeze, and void from Guests. Import CSV from Square, Toast, Clover, Shopify, or a generic file — one-way, then those systems are not used again.",
    roles: ["owner", "manager", "server", "bartender"],
    manualSectionId: "menu-guests",
    tags: ["gift", "import"],
  },
  {
    id: "upd_2026_08_13_wifi",
    date: "2026-08-13",
    title: "WiFi-first house network",
    summary:
      "No wired drop at every station. Staff stay on the house SSID. If the internet goes out, WiFi still runs the floor, KDS, and cash. Card captures queue until the processor is back.",
    roles: "all",
    manualSectionId: "network",
    tags: ["wifi", "offline", "hardware"],
  },
  {
    id: "upd_2026_08_13_venues",
    date: "2026-08-13",
    title: "Venue types & team logins",
    summary:
      "Home now starts with restaurant, food hall, truck pod, ghost kitchen, catering, bar, café, QSR, or SaaS. Each venue has its own staff quick logins.",
    roles: "all",
    manualSectionId: "intro",
    tags: ["login", "venues"],
  },
  {
    id: "upd_2026_08_13_sections",
    date: "2026-08-13",
    title: "Color-coded section assignments",
    summary:
      "Assign Dining, Booth, and Bar to staff. Servers cannot seat or order outside their section unless a manager grants a single table for the shift or that seating. Floor tables show section colors. Limits live in Settings → Section control.",
    roles: ["owner", "manager", "server", "host", "bartender", "busser"],
    manualSectionId: "sections",
    tags: ["floor", "staff", "sections"],
  },
  {
    id: "upd_2026_08_13_bump_notify",
    date: "2026-08-13",
    title: "Kitchen bump notifications",
    summary:
      "When kitchen or bar bumps a ticket, the floor gets a toast, chime, and inbox alert. Tables pulse with an Up badge for 90 seconds. Mute or enable desktop alerts from the bell.",
    roles: ["owner", "manager", "server", "host", "bartender", "kitchen", "busser"],
    manualSectionId: "kds",
    tags: ["kitchen", "floor", "alerts"],
  },
  {
    id: "upd_2026_08_11_manual",
    date: "2026-08-11",
    title: "In-app user manual & What’s New",
    summary:
      "Searchable interactive manual lives inside Summex. After each login you’ll see recent updates for your access level, with an option to silence until the next release.",
    roles: "all",
    manualSectionId: "manual-help",
    tags: ["help", "training"],
  },
  {
    id: "upd_2026_08_11_order_ahead",
    date: "2026-08-11",
    title: "Order ahead, table QR & kitchen fire rules",
    summary:
      "Guests order ahead online, check in with a claim code or table QR, and kitchen can wait until arrival, fire immediately, or delay. Staff Online board has Fire rules for takeout, curbside, QR, and delivery.",
    roles: ["owner", "manager", "server", "host", "kitchen", "bartender"],
    manualSectionId: "online-ahead",
    tags: ["online", "qr", "kitchen"],
  },
  {
    id: "upd_2026_08_10_marketing",
    date: "2026-08-10",
    title: "Marketing hub, social & location websites",
    summary:
      "Campaign planner, Google/social hooks, and per-location public websites under Website / Marketing. Gift cards and loyalty sit with Guests.",
    roles: ["owner", "manager"],
    manualSectionId: "marketing-web",
    tags: ["marketing", "loyalty"],
  },
  {
    id: "upd_2026_08_10_android",
    date: "2026-08-10",
    title: "Native Android shell & Summex Store",
    summary:
      "Capacitor Android app plus Play-style station hub at Summex Store — Floor, Kitchen KDS, Bar, Manager profiles for tablets and Galaxy devices.",
    roles: ["owner", "manager"],
    manualSectionId: "devices",
    tags: ["android", "hardware"],
  },
  {
    id: "upd_2026_08_09_packages",
    date: "2026-08-09",
    title: "Commercial packages & package preview",
    summary:
      "Toggle packages per location in Platform. Header package preview simulates what each package unlocks for training and demos.",
    roles: ["owner", "manager"],
    manualSectionId: "packages",
    tags: ["saas", "billing"],
  },
  {
    id: "upd_2026_08_08_labor",
    date: "2026-08-08",
    title: "Labor clock windows & red-flag review",
    summary:
      "Clock-out windows after last ticket, red-flag auto-approve rules, and payroll export paths under Labor.",
    roles: ["owner", "manager"],
    manualSectionId: "labor",
    tags: ["labor", "payroll"],
  },
  {
    id: "upd_2026_08_07_settlement",
    date: "2026-08-07",
    title: "Multi-vendor settlement (no Connect-only payouts)",
    summary:
      "Single guest pay, period vendor payouts net of card fees and host cut, cash distribution reports for halls and pods.",
    roles: ["owner", "manager"],
    manualSectionId: "settlement",
    tags: ["settlement", "hall"],
  },
  {
    id: "upd_2026_08_06_ai",
    date: "2026-08-06",
    title: "AI stock wizard & Drink AI",
    summary:
      "Inventory AI for par/reorder suggestions; Drink AI helps bartenders with builds, upsells, and 86 awareness.",
    roles: ["owner", "manager", "bartender", "kitchen", "server"],
    manualSectionId: "ai-tools",
    tags: ["ai", "inventory", "bar"],
  },
  {
    id: "upd_2026_08_05_truck",
    date: "2026-08-05",
    title: "Truck pod operations",
    summary:
      "Pad assignment, power/utilities tracking, and pod-specific settlement paths for multi-truck sites.",
    roles: ["owner", "manager"],
    manualSectionId: "truck-pod",
    tags: ["truck", "pod"],
  },
  {
    id: "upd_2026_08_04_rbac",
    date: "2026-08-04",
    title: "Role-based access (PIN access levels)",
    summary:
      "Menus hide tools your role cannot use. Quick login chips demo Owner through Busser personas.",
    roles: "all",
    manualSectionId: "roles",
    tags: ["security", "roles"],
  },
  {
    id: "upd_2026_08_03_kds",
    date: "2026-08-03",
    title: "Kitchen & bar KDS routing",
    summary:
      "Tickets route by station and vendor; bump, recall, and multi-course holds work on Kitchen and Bar views.",
    roles: ["owner", "manager", "kitchen", "bartender"],
    manualSectionId: "kds",
    tags: ["kitchen", "bar"],
  },
  {
    id: "upd_2026_08_02_floor",
    date: "2026-08-02",
    title: "Floor map & server sections",
    summary:
      "Visual table states, seat-aware ordering, and host/server collaboration on the floor plan.",
    roles: ["owner", "manager", "server", "host", "busser"],
    manualSectionId: "floor",
    tags: ["floor", "foh"],
  },
];

export const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "intro",
    title: "Welcome to Summex",
    summary: "What Summex is and how this interactive manual works.",
    audience: "all",
    blocks: [
      {
        type: "p",
        text: "Summex is a hospitality operating system for restaurants, multi-vendor food halls, and truck pods. It combines front-of-house POS, kitchen display, labor, settlement, inventory intelligence, guest ordering, marketing sites, and a SaaS platform for multi-site operators.",
      },
      {
        type: "p",
        text: "Tagline: Service, sharp. Built by Michael Blair & Andy Baida.",
      },
      {
        type: "tip",
        text: "Use the search box and role filter on the left. Chapters you cannot act on are still readable for cross-training. Open in app jumps to a live module when your access level allows.",
      },
      {
        type: "ul",
        items: [
          "Home lists venue types (restaurant, hall, pod, ghost kitchen, catering, bar, café, QSR) plus the SaaS platform.",
          "Open a venue to see that team’s PIN pad and staff logins — server, barista, dispatch, and so on.",
          "Access level (role) plus extra station rights control which menu items appear after PIN login.",
          "Packages (Platform) control which modules are licensed per location.",
          "Guest pay is single-check; vendor payouts settle by period with host cut + fees.",
        ],
      },
    ],
  },
  {
    id: "manual-help",
    title: "Using this manual & What’s New",
    summary: "In-app help, update popups, and silencing until the next release.",
    audience: "all",
    blocks: [
      {
        type: "steps",
        items: [
          "Tap Help / Manual in the header (always visible after sign-in).",
          "Browse chapters, search keywords, or filter by your role.",
          "On each login, What’s New lists recent updates for your access level.",
          "Check “Don’t show again until the next update” to silence the popup until a newer release ships.",
        ],
      },
      {
        type: "tip",
        text: "When a feature ships, add a PRODUCT_UPDATES entry so staff see it at login. The interactive manual is the living source of truth next to the product.",
      },
    ],
  },
  {
    id: "getting-started",
    title: "Getting started & PIN login",
    summary: "Sign in, quick role logins, shell layout, sign out.",
    audience: "all",
    blocks: [
      {
        type: "steps",
        items: [
          "Open Summex on the terminal, tablet, or browser.",
          "Enter your 4-digit staff PIN, or use Quick login by access level.",
          "Confirm your name and access level in the header.",
          "Use only the menu items shown — unauthorized tools are hidden.",
        ],
      },
      {
        type: "ul",
        items: [
          "Demo PINs: Owner 9999 · Manager 0000 · Server 1111 · Bartender 3333 · Host 4444 · Kitchen 5555 · Busser 7777.",
          "Header: brand, clock, location, open checks, package preview (dev), name + role, Help, SaaS rocket, sign out.",
          "Desktop left nav is role-filtered; phone bottom dock shows top shortcuts.",
          "Sign out returns to PIN. It does not clock you out of Labor — use Labor for that.",
        ],
      },
    ],
  },
  {
    id: "roles",
    title: "Access levels (roles)",
    summary: "What each PIN level can open.",
    audience: "all",
    blocks: [
      {
        type: "ul",
        items: [
          "Owner — full site + Platform SaaS surfaces.",
          "Manager — day-to-day ops, money, labor, reports; no SaaS billing console.",
          "Server — floor, order, takeout, hall, waitlist, guests, drink AI, online.",
          "Bartender — bar KDS, order, takeout, drink AI, guests, stock awareness.",
          "Host — waitlist, floor, guests, online.",
          "Kitchen — kitchen KDS, recipes, checklists, inventory.",
          "Busser — floor table turns only.",
        ],
      },
      {
        type: "tip",
        text: "If a deep link tries to open a blocked view, Summex returns you to your role home screen.",
      },
    ],
  },
  {
    id: "floor",
    title: "Floor & tables",
    summary: "Table map, seating, and server sections.",
    audience: ["owner", "manager", "server", "host", "busser"],
    openView: "floor",
    blocks: [
      {
        type: "p",
        text: "The floor plan shows table state (available, seated, ordering, check, dirty). Tap a table to open or resume the check. Hosts seat parties; servers build orders; bussers mark dirty → clean.",
      },
      {
        type: "steps",
        items: [
          "Open Floor from the menu.",
          "Select a table; confirm party size / server if prompted.",
          "Jump to Order to build items, or return to Floor to monitor status.",
          "After pay, busser clears dirty tables for the next turn.",
        ],
      },
      {
        type: "tip",
        text: "Each section has a color bar on the table. Servers only work their assigned sections unless a manager grants an extra table. See Section assignments.",
      },
    ],
  },
  {
    id: "sections",
    title: "Section assignments",
    summary: "Assign color-coded sections, extra tables, and order limits.",
    audience: ["owner", "manager", "server", "host", "bartender"],
    openView: "employees",
    blocks: [
      {
        type: "p",
        text: "Every floor section (Dining, Booth, Bar, or custom) has a color. Managers assign one or more sections to each server or bartender on Staff. The floor map paints a color bar on every table so the room is readable at a glance.",
      },
      {
        type: "ul",
        items: [
          "Servers cannot enter orders on a table in another section.",
          "Servers cannot seat a table in another section.",
          "A manager can grant a single extra table for this shift, or just that seating.",
          "Shift grants drop at clock-out. Seating grants drop when the table is cleared.",
          "A manager PIN can override a table for this login when Settings allow it.",
        ],
      },
      {
        type: "steps",
        items: [
          "Open Staff. Tap section chips on a person to assign Dining / Booth / Bar.",
          "Use Grant to give one overflow table (shift or seating).",
          "Open Settings → Section control to choose which roles are limited, hide other sections, or lock bartenders to the bar.",
          "Recolor or rename sections in the Floor editor.",
        ],
      },
      {
        type: "warn",
        text: "Demo: Jordan (PIN 1111) is Dining plus a shift grant on booth 12. Sam (PIN 2222) is Booth only — dining and bar tables stay locked unless granted.",
      },
    ],
  },
  {
    id: "ordering",
    title: "Ordering & checks",
    summary: "Build items, modifiers, hold/fire, pay.",
    audience: ["owner", "manager", "server", "bartender"],
    openView: "order",
    blocks: [
      {
        type: "ol",
        items: [
          "Choose category → item → modifiers.",
          "Use seat numbers on multi-guest tables when needed.",
          "Hold a course or Send to fire unsent lines to KDS.",
          "Pay with card (simulated), cash, gift, or other tenders.",
        ],
      },
      {
        type: "warn",
        text: "Voids/comps may require a manager PIN (demo manager PIN 0000).",
      },
    ],
  },
  {
    id: "kds",
    title: "Kitchen & bar displays (KDS)",
    summary: "Tickets, bump, recall, stations.",
    audience: ["owner", "manager", "kitchen", "bartender"],
    openView: "kitchen",
    blocks: [
      {
        type: "p",
        text: "Kitchen and Bar views show tickets routed by station and vendor. Bump completed tickets; recall if needed. Online/order-ahead fires appear with labels like T12, Ahead #5006, or Curbside White Tesla.",
      },
      {
        type: "ul",
        items: [
          "Kitchen — expo / hot line.",
          "Bar — cocktails and beverage tickets.",
          "Order-ahead tickets may wait until guest check-in (see Online fire rules).",
          "Bump notifies the floor: toast + chime + bell inbox. Table on the floor map shows Up for 90 seconds.",
          "Open the header bell to review, mute sound, or turn on desktop alerts.",
        ],
      },
    ],
  },
  {
    id: "host",
    title: "Host stand",
    summary: "Waitlist, reservations, seating.",
    audience: ["owner", "manager", "host", "server"],
    openView: "waitlist",
    blocks: [
      {
        type: "p",
        text: "Host manages walk-ins, quoted waits, and reservations. Seat parties onto available tables on the floor plan.",
      },
    ],
  },
  {
    id: "online-ahead",
    title: "Online, order ahead, table QR & curbside",
    summary: "Guest order site, claim codes, kitchen fire modes.",
    audience: ["owner", "manager", "server", "host", "kitchen", "bartender"],
    openView: "online",
    blocks: [
      {
        type: "p",
        text: "Guests use the public Order online page for order ahead, pickup, curbside, or delivery. Table stickers open /table/{label} so guests can order at the seat or check in an ahead order.",
      },
      {
        type: "steps",
        items: [
          "Guest places order ahead → receives order # and claim code.",
          "Default fire mode for ahead/curbside: wait until arrival.",
          "On arrival: scan table QR → I ordered ahead → enter claim code, or staff marks Guest arrived on Online board.",
          "Kitchen receives tickets when fire rules say so (immediate, on arrival, delay after order, delay after arrival).",
        ],
      },
      {
        type: "ul",
        items: [
          "Staff Online board filters: Active, Awaiting guest, Kitchen hold.",
          "Fire rules panel sets defaults per channel and whether guests may choose.",
          "Table QR can auto-accept and fire immediately for dine-in QR orders.",
          "Curbside stores vehicle color/description for runners.",
        ],
      },
      {
        type: "tip",
        text: "Demo seed includes claim A7K2 (order ahead) and curbside ready with vehicle — use for training without placing a new order.",
      },
    ],
  },
  {
    id: "takeout-hall",
    title: "Takeout & hall cart",
    summary: "Named takeout, tabs, multi-vendor hall pay.",
    audience: ["owner", "manager", "server", "bartender"],
    openView: "takeout",
    blocks: [
      {
        type: "p",
        text: "Takeout creates named pickup orders or bar tabs. Hall cart lets a guest order across stalls with one payment; KDS and settlement still split by vendor.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments, cash & tips",
    summary: "Tenders, drawer, tip workflows.",
    audience: ["owner", "manager", "server", "bartender"],
    openView: "cash",
    blocks: [
      {
        type: "ul",
        items: [
          "Card — simulated auth + tip; no live processor unless connected.",
          "Cash — tender + change; Cash view tracks float and sales.",
          "Gift card — code against demo balances (Guests).",
          "House / other — demo room charge style paths.",
        ],
      },
    ],
  },
  {
    id: "settlement",
    title: "Multi-vendor settlement",
    summary: "Host cut, fees, period vendor payouts.",
    audience: ["owner", "manager"],
    openView: "settlement",
    blocks: [
      {
        type: "p",
        text: "Guests pay once. Sales are attributed to vendors. Close a period to generate payouts: gross − card fees − host cut (and commons) = net to vendor. Cash distribution reports support halls that settle cash on site.",
      },
      {
        type: "warn",
        text: "This is product-owned ledger settlement — not Stripe Connect auto-split. ACH/export may be simulated in demo.",
      },
    ],
  },
  {
    id: "labor",
    title: "Labor & clock rules",
    summary: "Time clock, windows, red flags, payroll export.",
    audience: ["owner", "manager"],
    openView: "labor",
    blocks: [
      {
        type: "p",
        text: "Labor defines schedule, clock-in/out, and policy windows. Clock-out long after the last closed ticket can raise a red flag for manager review (auto-approve rules configurable).",
      },
    ],
  },
  {
    id: "ai-tools",
    title: "AI stock & Drink AI",
    summary: "Inventory intelligence and bartender assist.",
    audience: ["owner", "manager", "bartender", "kitchen", "server"],
    openView: "inventory_ai",
    blocks: [
      {
        type: "ul",
        items: [
          "AI stock — pars, reorder suggestions, supplier-aware wizards.",
          "Drink AI — builds, substitutions, upsells, 86 awareness for bar and servers.",
        ],
      },
    ],
  },
  {
    id: "menu-guests",
    title: "Menu, guests, gift & loyalty",
    summary: "Menu admin, CRM, gift cards, points.",
    audience: ["owner", "manager", "server", "bartender", "host"],
    openView: "customers",
    blocks: [
      {
        type: "p",
        text: "Menu admin maintains categories, items, modifiers, and channels. Guests store profiles, notes/allergies, and loyalty. Gift cards are a first-party Summex ledger — issue, reload, freeze, void, and import from Square/Toast/Clover. Redeem never calls an outside gift network.",
      },
    ],
  },
  {
    id: "marketing-web",
    title: "Marketing & location websites",
    summary: "Campaigns, social/Google hooks, public site pages.",
    audience: ["owner", "manager"],
    openView: "marketing",
    blocks: [
      {
        type: "p",
        text: "Marketing hub plans campaigns and social/Google touchpoints. Website tools publish per-location public pages (guest-facing site route).",
      },
    ],
  },
  {
    id: "reports",
    title: "Reports",
    summary: "Sales, labor, and ops reporting.",
    audience: ["owner", "manager"],
    openView: "reports",
    blocks: [
      {
        type: "p",
        text: "Reports summarize sales by daypart, server, tender, and category. Use with Cash for drawer reconciliation.",
      },
    ],
  },
  {
    id: "hq-integrations",
    title: "HQ, integrations & vendors",
    summary: "Ops hub, marketplace connections, vendor portal.",
    audience: ["owner", "manager"],
    openView: "hq",
    blocks: [
      {
        type: "p",
        text: "HQ is the multi-module ops home. Card processing is always Summex Payments — you do not connect Stripe or Square. Integrations covers delivery, accounting, payroll, marketing, and hardware. Vendor portal is for stall operators inside a hall.",
      },
    ],
  },
  {
    id: "truck-pod",
    title: "Truck pod",
    summary: "Pads, utilities, pod settlement.",
    audience: ["owner", "manager"],
    openView: "truck_pod",
    blocks: [
      {
        type: "p",
        text: "Assign trucks to pads, track power/utilities, and settle pod fees alongside food sales where configured.",
      },
    ],
  },
  {
    id: "packages",
    title: "Packages & SaaS platform",
    summary: "Location packages, billing lens, /platform console.",
    audience: ["owner", "manager"],
    blocks: [
      {
        type: "p",
        text: "Commercial packages (POS Core, KDS, Online, Labor, Settlement, Marketing, etc.) toggle per location in Summex Platform. The header Package preview lens simulates a single package for demos without changing real licensing.",
      },
      {
        type: "steps",
        items: [
          "Open SaaS via the rocket icon or login card → /platform.",
          "Select org/location → enable packages.",
          "In POS, use Package preview to train staff on a restricted menu.",
        ],
      },
    ],
  },
  {
    id: "devices",
    title: "Devices, Android & Summex Store",
    summary: "BYOD vs lease, Capacitor app, station profiles.",
    audience: ["owner", "manager"],
    blocks: [
      {
        type: "p",
        text: "Hardware policy covers BYOD phones/tablets, leased 27″ Android stations, and Galaxy test fleet guidance. The native Android shell loads Summex; Summex Store installs station profiles (Floor, Kitchen, Bar, Manager).",
      },
      {
        type: "tip",
        text: "Open Summex Store from the login screen (App store · stations) without signing into POS.",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings & floor editor",
    summary: "Restaurant config and layout editing.",
    audience: ["owner", "manager"],
    openView: "settings",
    blocks: [
      {
        type: "p",
        text: "Settings holds restaurant identity, tax, auto-grat, happy hour, and manager PIN. Floor editor repositions tables for the live map.",
      },
    ],
  },
  {
    id: "workflows",
    title: "Day-in-the-life workflows",
    summary: "Quick playbooks by access level.",
    audience: "all",
    blocks: [
      {
        type: "ul",
        items: [
          "Server — login → floor → seat/order → fire → pay → next table.",
          "Bartender — bar KDS + order for tabs; Drink AI for builds.",
          "Host — waitlist → seat → hand off to server.",
          "Kitchen — KDS only; bump when plated; watch Ahead/Curbside labels.",
          "Manager — HQ board, labor red flags, settlement close, Online fire rules.",
          "Owner — packages, platform, settlement policy, marketing sites, devices.",
          "Busser — floor dirty → available; keep turns moving.",
        ],
      },
    ],
  },
  {
    id: "network",
    title: "House WiFi & offline",
    summary:
      "WiFi-only site fabric. Internet can die; the house still runs on local WiFi.",
    audience: "all",
    openView: "settings",
    blocks: [
      {
        type: "p",
        text: "Classic POS runs a private Ethernet plant: switch, hubs, a CAT6 drop at every station, isolated from the office LAN. That wiring is expensive, slow to change, and still fails when a cable or switch dies. Summex is WiFi-first.",
      },
      {
        type: "p",
        text: "One business access point (or a small mesh) publishes a staff SSID (default Summex-House) and a guest SSID that never sees POS traffic. Handhelds, KDS, printers, and card readers join the staff SSID. One station is the house hub — it holds the live checks. Satellites talk to the hub over WiFi, not the cloud.",
      },
      {
        type: "p",
        text: "Internet is only the uplink on the access point. If the ISP goes out, the WiFi LAN is still up. Floor, kitchen, bar, cash, and local gift keep working. Card captures, new online orders, cloud loyalty, and email receipts sit in the cloud queue until the uplink returns, then they flush automatically.",
      },
      {
        type: "steps",
        items: [
          "Put the AP where the dining room and kitchen both hear it. WiFi 6/6E if you can.",
          "Name a staff SSID and a guest SSID. Isolate guest. Do not put POS devices on guest.",
          "Designate the drawer / counter tablet as the house hub (Settings → House network).",
          "Join every station to the staff SSID. Ethernet is optional, never required.",
          "Tap the WiFi chip in the header to see peers, queue, and to simulate an outage.",
        ],
      },
      {
        type: "tip",
        text: "If the access point itself dies, this terminal still has its local checks. Other stations cannot see each other until WiFi is back. That is why a second AP (or a cheap mesh node) is the only spare part most houses need — not a closet full of switches.",
      },
      {
        type: "ul",
        items: [
          "Works offline through house WiFi: tables, orders, KDS bump, cash, comps, local gift, clock-in.",
          "Queues until internet: card capture, marketplace orders, cloud gift/loyalty, email/SMS, SaaS billing.",
          "Simulate internet outage in Settings or the WiFi sheet to rehearse a shift with no ISP.",
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "Troubleshooting & FAQ",
    summary: "Common issues and demo limits.",
    audience: "all",
    blocks: [
      {
        type: "ul",
        items: [
          "Can’t see a menu item? Wrong access level or package preview lens is filtering it.",
          "Kitchen never got an ahead order? Fire mode is on_arrival — guest must check in or staff must mark arrived / fire now.",
          "Prices look wrong after an update? Reset demo data from Settings (owner) if local storage is stale.",
          "Internet died? House WiFi still runs the floor. Tap the WiFi chip — card captures queue until the ISP is back.",
          "Card pay “failed”? Demo may still succeed offline — live Stripe Terminal is not always active.",
          "Popup every login? That’s What’s New. Silence until next update, or open the full manual for detail.",
        ],
      },
    ],
  },
  {
    id: "glossary",
    title: "Glossary",
    summary: "Key Summex terms.",
    audience: "all",
    blocks: [
      {
        type: "ul",
        items: [
          "Check / order — guest bill; may include multi-vendor lines.",
          "Ticket — kitchen/bar fire group from a check.",
          "Claim code — short code for order-ahead check-in.",
          "Fire mode — when kitchen receives the ticket (immediate, arrival, delays).",
          "Host cut — building operator share of vendor sales.",
          "Package — licensed module bundle on a location.",
          "Pad — truck parking/power slip in pod mode.",
          "House hub — the station that holds live checks; satellites reach it over WiFi.",
          "Staff SSID — isolated WiFi for POS, KDS, printers, readers. Not guest.",
          "Red-flag clock-out — clock-out outside policy window after last ticket.",
        ],
      },
    ],
  },
];

export function sectionVisibleToRole(
  section: ManualSection,
  role: EmployeeRole,
): boolean {
  if (section.audience === "all") return true;
  return section.audience.includes(role);
}

export function updateVisibleToRole(
  update: ProductUpdate,
  role: EmployeeRole,
): boolean {
  if (update.roles === "all") return true;
  return update.roles.includes(role);
}

/** Newest-first updates for a role, capped */
export function updatesForRole(
  role: EmployeeRole,
  limit = 10,
): ProductUpdate[] {
  return PRODUCT_UPDATES.filter((u) => updateVisibleToRole(u, role)).slice(
    0,
    limit,
  );
}

/** Chronologically latest update id among the full catalog (for silence watermark) */
export function latestUpdateId(): string {
  return PRODUCT_UPDATES[0]?.id ?? MANUAL_VERSION;
}

export function isNewerThan(
  updateId: string,
  watermarkId: string | null,
): boolean {
  if (!watermarkId) return true;
  const ids = PRODUCT_UPDATES.map((u) => u.id);
  const a = ids.indexOf(updateId);
  const b = ids.indexOf(watermarkId);
  // Lower index = newer. Unknown ids treated as newer.
  if (a < 0) return true;
  if (b < 0) return true;
  return a < b;
}

export function hasUnseenUpdates(
  role: EmployeeRole,
  silencedAfterUpdateId: string | null,
): boolean {
  const forRole = updatesForRole(role, 20);
  if (forRole.length === 0) return false;
  if (!silencedAfterUpdateId) return true;
  return forRole.some((u) => isNewerThan(u.id, silencedAfterUpdateId));
}

export function searchSections(
  query: string,
  role: EmployeeRole | "all",
): ManualSection[] {
  const q = query.trim().toLowerCase();
  return MANUAL_SECTIONS.filter((s) => {
    if (role !== "all" && !sectionVisibleToRole(s, role)) return false;
    if (!q) return true;
    const hay = [s.title, s.summary, ...s.blocks.flatMap((b) => [b.text ?? "", ...(b.items ?? [])])]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}
