import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const ROLE_GUIDE_TOPICS: GuideTopic[] = [
  topic({
    id: "role-platform-admin",
    chapterId: "platform",
    title: "Platform Admin",
    summary: "Tenants, pipeline, and support — not a restaurant PIN.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["admin", "pipeline", "tenants", "demos", "control plane"],
    blocks: [
      why(
        "Platform Admin sees the fleet. It is not a floor login and must not be shared as a demo password.",
      ),
      ul(
        "Console — live organizations only. There are no demo houses.",
        "Pipeline — prospects from intake through contract and onboarding.",
      ),
      steps(
        "Sign in, complete the forced password change, land on the control plane.",
        "Use Console and Pipeline in the header.",
        "Empty tenants is valid until someone completes SaaS onboarding.",
        "Send prospects Get pricing / Request demo — never this Admin session.",
      ),
      callout(
        "Same topic",
        "Deeper tenant/support steps also live under Platform admin: tenants & support.",
      ),
      related("platform-admin", "prospect-demos", "empty-start", "prospect-intake"),
    ],
  }),
  topic({
    id: "role-owner",
    chapterId: "roles",
    title: "Owner / manager",
    summary: "Location, staff, money, and packages after the site is live.",
    roles: ["owner_manager"],
    keywords: ["owner", "manager", "settings", "staff", "money"],
    blocks: [
      why(
        "The owner opens the house, sets PINs and packages, and owns the period close.",
      ),
      ul(
        "Open POS for the location. PIN as owner or manager.",
        "Staff, menu, floor, cash drawer, settlement.",
        "Packages decide which modules appear. Core POS and ODS are the floor.",
      ),
      steps(
        "Confirm the location mode (restaurant vs host + operators) matches how you actually serve.",
        "Add staff PINs and section assignments.",
        "Build enough menu to send a ticket. Do not wait for a demo seed.",
        "Costs → Recipes: describe or upload a recipe, confirm, save. Price recs use those costs.",
        "Close the period on Settle. Guest cards are Quantum Payments.",
      ),
      tip("The Operators Guide overlay is in the header on every surface."),
      related("login", "invites-roles", "host-capture", "type-restaurant", "recipes-prep", "location-training"),
    ],
  }),
  topic({
    id: "role-server",
    chapterId: "roles",
    title: "Server / floor",
    summary: "Tables, checks, send, pay — the guest-facing path.",
    roles: ["server"],
    keywords: ["server", "floor", "check", "seat", "pay"],
    blocks: [
      why(
        "The server owns the check. Kitchen and bar see tickets, not the guest.",
      ),
      steps(
        "PIN in. Your home screen is usually Floor or Order.",
        "Seat (or open a counter check). Tap a table to change status or preview QR. Add items. Send.",
        "Take Quantum Payments when online. If the uplink is down, cash still closes; card requires connection.",
        "Do not open a second check for another operator on a host floor.",
        "Recipe / ingredients on a menu tile or selected check line shows allergens and what’s in the plate — not full prep.",
      ),
      p(
        "On a host + multi-operator floor, food and drinks still live on one guest check. You are not splitting cards by stall.",
      ),
      related("type-restaurant", "type-food-hall", "host-capture", "recipes-prep"),
    ],
  }),
  topic({
    id: "role-kitchen-bar",
    chapterId: "roles",
    title: "Kitchen / bar",
    summary: "Tickets, bump, recall. You do not take the guest card.",
    roles: ["kitchen_bar"],
    keywords: ["kitchen", "bar", "kds", "bump", "ticket"],
    blocks: [
      why(
        "The rail is the source of truth for the line. Bump tells the floor the item is up.",
      ),
      steps(
        "PIN into Kitchen or Bar. You see only your station’s tickets.",
        "Start when you begin, Bump when ready. The originating server’s device toasts, chimes, and vibrates. Expo or floor marks Delivered. Bump still works offline. Do not take payment from the ODS.",
        "On a host floor, bar tickets belong to the bar operator; kitchen tickets to the kitchen operator.",
        "Recipe on a ticket opens full prep steps, quantities, glassware, and garnish in large type.",
      ),
      related("type-food-hall", "type-bar-lounge", "type-restaurant", "recipes-prep"),
    ],
  }),
  topic({
    id: "role-vendor",
    chapterId: "roles",
    title: "Vendor / operator",
    summary: "A stall, kitchen brand, or truck on a host floor.",
    roles: ["vendor_operator", "host_operator"],
    keywords: ["vendor", "operator", "stall", "portal", "settlement"],
    blocks: [
      why(
        "You cook or pour for a host brand. The guest pays the host. You are paid on the period.",
      ),
      ul(
        "Your login is scoped to your entity (Steam Distillery, Diamond House BBQ, …) under the host location.",
        "Full control of your menu, modifiers, 86, tickets/ODS, schedules, and your reports slice.",
        "Peer menus are view-only unless the host grants edit_menu. You cannot change another operator’s settings.",
        "Operator ops: your staff, time clock, and 86 board.",
        "View-only settlement slice. Payout destinations are host-managed — you cannot edit banks, tax, or host branding.",
        "A $35 dispute fee, when filed, splits by merchandise on that check.",
      ),
      p(
        "The Laundry partner-demo (Steam Distillery + Diamond House BBQ) is the rehearsal for this model. It is tagged is_partner_demo — not a public demo site.",
      ),
      related("type-food-hall", "host-capture", "chargebacks", "prospect-demos", "partner-demo"),
    ],
  }),
  topic({
    id: "roles-dashboards",
    chapterId: "roles",
    title: "Roles & dashboards",
    summary: "Each access level lands on a job dashboard. Nav hides what you cannot use.",
    roles: "all",
    keywords: ["role", "dashboard", "access", "PIN", "permissions", "cashier", "accountant"],
    blocks: [
      why(
        "One generic home screen trains nobody. After PIN, you see the work for that job — and only the actions you are allowed.",
      ),
      ul(
        "Owner / manager — sales snapshot, waitlist, staff on, shortcuts to settings, menu, floor, reports.",
        "Server — my sections, open checks, quick order.",
        "Host stand — waitlist, reservations, seating.",
        "Kitchen / expo — ODS-first. Bartender — bar ODS and tabs.",
        "Cashier — counter queue and pay.",
        "Vendor operator — entity dashboard (own menu, tickets, reports). Peer menus view-only unless the host grants. Not host settings or payouts.",
        "Accountant — reports and ledger.",
        "Platform Admin — control plane after Sign in, not a restaurant PIN.",
      ),
      steps(
        "PIN in. Home is that role’s dashboard.",
        "The first time in that role, take the live walkthrough (or skip / replay later).",
        "Nav only lists views you can open. Settings writes are owner/manager.",
        "On The Laundry partner-demo: owner 1000, manager 1001, server 2001, Steam bartender 3001, Diamond cook 4001. See Partner demo — The Laundry.",
      ),
      related("role-walkthroughs", "whats-new-on-login", "role-owner", "role-server", "role-vendor", "location-settings"),
    ],
  }),
  topic({
    id: "location-settings",
    chapterId: "roles",
    title: "Location settings by type",
    summary: "Owner and manager configure only the packs that apply to this house.",
    roles: ["owner_manager", "host_operator"],
    keywords: ["settings", "location", "hours", "cash discount", "kiosk", "settlement"],
    openView: "settings",
    blocks: [
      why(
        "A café does not need a dining-room map pack. A host hall does. The type badge on Settings is the pack you are editing.",
      ),
      ul(
        "Every house: profile, tax, Quantum Payments tenders, cash discount, devices, staff, notifications, hours.",
        "Full-service: sections and floor control.",
        "Bar: tab auto-close.",
        "Counter / QSR / café / ghost: ticket prefix and expo.",
        "Host + multi-operator: Host settings (tax, cash discount, Quantum Payments, payouts, entity permission matrix, device assignment) vs Operators (ops only). Guest operators never edit host MID or payout routing.",
        "Kiosk / waitlist types: kiosk mode, waitlist, reservation check-in.",
      ),
      steps(
        "PIN as owner or manager. Open Home → Location settings.",
        "Confirm the type badge (restaurant, host hall, bar, QSR…).",
        "Save each pack. Live tenants persist on the location. Demo rooms stay local.",
      ),
      related("roles-dashboards", "host-operator-settings", "cash-discount", "feature-kiosk", "type-food-hall"),
    ],
  }),
  topic({
    id: "host-operator-settings",
    chapterId: "roles",
    title: "Host vs guest operator settings",
    summary: "The subscriber host owns location, payouts, the permission matrix, and device assignment. Guest operators get entity-scoped logins.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["host", "operator", "payouts", "settings", "subscriber", "stall"],
    openView: "settings",
    blocks: [
      why(
        "The SaaS customer is the host location. Guest brands that cook or pour there are onboarded onto that host — they are not separate subscribers with their own tax, MID, or payout routing.",
      ),
      ul(
        "Host (owner/manager): profile, tax, cash discount, Quantum Payments location config, floor, kiosk/waitlist, packages, onboard/suspend operators, payout destinations, settlement rules, host cut, chargeback policy, entity permission matrix, all devices.",
        "Guest operator login: own menu (create/edit/86), own tickets/ODS, own reports, own staff and time clock. Peer menus default view-only. Cannot edit another entity unless the host grants edit_menu.",
        "Devices: house assets, not locked roles. Host enrolls tablets. Any device switches via This station (Steam bar ODS, Diamond floor POS, host kiosk, or split ODS).",
      ),
      steps(
        "PIN as host owner. Host settings → Operators to onboard a stall (name, station, payout last 4).",
        "Open Entity permissions. Defaults: view_menu on, edit_menu off, tickets/reports/settlement own-only, devices host-only.",
        "Open Device assignment to enroll. On the tablet, This station → Steam bar ODS or Diamond floor POS — no new hardware, no locked SKU.",
        "Switch Demo mode to Steam Distillery. Edit a Steam item. Diamond items show “view only.”",
        "Switch to Diamond House BBQ. Steam menu is read-only. You cannot change Steam settings.",
      ),
      warn(
        "Payout / settlement bank / payment routing never lives on the guest operator. The host collects the destination at onboard and can change it later.",
      ),
      related("location-settings", "role-vendor", "type-food-hall", "settlement", "device-assignment", "floor-pin-login", "entity-schedule-payroll"),
    ],
  }),
  topic({
    id: "floor-pin-login",
    chapterId: "roles",
    title: "Floor PIN vs back office password",
    summary: "Working staff use a 4-digit PIN on the device. Admin work uses email and password.",
    roles: "all",
    keywords: ["pin", "password", "floor", "kds", "switch user", "back office"],
    blocks: [
      why(
        "A shared tablet is not a laptop. Servers should not type a password between tables. Owners should not run payroll from a four-digit code.",
      ),
      ul(
        "Back office: Sign in with username/email and password. Platform Admin, owners, managers, accountants, entity managers for settings, matrix, full reports, schedule admin, payroll, menu management.",
        "Floor PIN: 4-digit keypad on POS, ODS, host stand. Servers, hosts, bartenders, kitchen, cashiers, expo. Fast Switch user. PIN hashed, scoped to location and entity.",
        "Assigned device still requires the matching entity’s PIN (Steam ODS rejects a Diamond PIN).",
        "Kiosk guests never enter a PIN. Marketing pages never show staff PINs. Platform Admin cannot use a restaurant PIN.",
      ),
      steps(
        "After a location exists, staff use the production floor PIN pad. Each person has their own 4-digit PIN — there is no universal 0000.",
        "Tap Switch user to PIN in the next person without reassigning the tablet.",
        "Open Settings from a floor PIN — you are asked for back-office password.",
      ),
      related("login", "entity-schedule-payroll", "host-operator-settings", "device-assignment", "voice-control", "ai-ops-learning"),
    ],
  }),
  topic({
    id: "entity-schedule-payroll",
    chapterId: "roles",
    title: "Entity schedule & payroll",
    summary: "Each entity schedules and pays its own staff. Host has oversight; edits to guest schedules stay off unless you turn them on.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["schedule", "payroll", "shifts", "overtime", "tips", "steam", "diamond"],
    openView: "schedule",
    blocks: [
      why(
        "Steam Distillery does not write Diamond House BBQ’s week. Diamond does not see Steam payroll unless the host grants view_payroll.",
      ),
      ul(
        "Week view, draft shifts, publish. Floor PIN users see My shifts only.",
        "Payroll report: hours, OT flag, tips, sales, CSV — scoped to the entity.",
        "Host: oversight of every entity. Edit a guest entity’s schedule only if Host may edit guest-entity schedules is on (default off).",
        "Single-operator houses use the same screens under the location owner/manager.",
      ),
      steps(
        "Back office as host or Steam manager. Open Schedule. Add a Steam shift. Publish week.",
        "Open Labor → Payroll. Steam hours only when you are the Steam manager. CSV exports that slice.",
        "PIN as Diamond (7777): you cannot add Steam shifts. Menu still badges Steam items view-only.",
      ),
      related("floor-pin-login", "host-operator-settings", "role-vendor", "laundry-test-venue", "voice-control", "ai-ops-learning"),
    ],
  }),
  topic({
    id: "voice-control",
    chapterId: "roles",
    title: "Voice control by access level",
    summary: "Optional mic on POS, host stand, and ODS. Host turns each role on or off.",
    roles: "all",
    keywords: ["voice", "mic", "speech", "86", "command", "server"],
    openView: "settings",
    blocks: [
      why(
        "Hands are full on the floor. A tap-to-talk mic runs only the commands that role is allowed — and never host money.",
      ),
      ul(
        "Host settings → Voice control: owner, manager, server, host stand, bartender, kitchen, cashier, vendor operator on by default. Busser and accountant off. Kiosk guest always off.",
        "Server/manager: “Add highball to table 12”, “Send table 12”, “86 brisket” if permitted.",
        "Host stand: “Turn on waitlist”, “Set waitlist reason kitchen”.",
        "Kitchen: “86 [item]”, “Bump ticket” on the focused rail.",
        "86, void, and waitlist-on confirm on screen. Ambiguous names show Did you mean…?",
        "Blocked: payouts, permission matrix, platform admin, tax. Floor PIN cannot use voice for those either.",
        "Steam voice cannot 86 a Diamond item. Device assignment still applies.",
      ),
      steps(
        "Host: Settings → Voice control. Leave server on, kiosk off.",
        "PIN as server. Tap the mic. Say “eighty-six brisket plate” and confirm.",
        "PIN as kitchen on an ODS. “Bump ticket” marks the oldest ticket ready on that rail.",
      ),
      warn("Voice is a shortcut, not a second permission system. RBAC and entity grants still win."),
      related("ai-ops-learning", "floor-pin-login", "host-operator-settings", "role-vendor"),
    ],
  }),
  topic({
    id: "ai-ops-learning",
    chapterId: "roles",
    title: "AI ops recommendations that learn",
    summary: "Shift cards and report insights. Accept, dismiss, or snooze — the house remembers.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["ai", "labor", "recommendation", "learn", "dismiss", "accept"],
    openView: "hq",
    blocks: [
      why(
        "A labor tip you always dismiss should get quieter. One you accept on busy dinners should rank higher next time — at this location, not across tenants.",
      ),
      ul(
        "Live AI ops card on owner/manager (and vendor) Home: labor vs sales, slow tickets, waitlist vs idle tables.",
        "Accept records the decision and may open Schedule or Labor so you confirm. It never clocks anyone out.",
        "Dismiss downranks that type in similar dayparts. Snooze hides it for 20 minutes.",
        "Reports → AI insights shows “Based on your past decisions” when a pattern exists.",
        "Demo rooms learn only inside the demo. Live tenants never share decisions.",
        "Steam AI cannot change Diamond.",
      ),
      steps(
        "Open Home as host. Read the labor vs sales card.",
        "Dismiss it twice — confidence drops and the card notes you’ve dismissed this kind of tip.",
        "Accept it — later runs say Based on your past decisions and rank it higher.",
      ),
      related("voice-control", "location-settings", "roles-dashboards", "laundry-test-venue"),
    ],
  }),
];
