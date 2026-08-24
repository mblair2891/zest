import { callout, p, related, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const ROLE_GUIDE_TOPICS: GuideTopic[] = [
  topic({
    id: "role-platform-admin",
    chapterId: "platform",
    title: "Platform Admin",
    summary: "Tenants, pipeline, demos, and support — not a restaurant PIN.",
    visibility: "platform",
    roles: ["platform_admin"],
    keywords: ["admin", "pipeline", "tenants", "demos", "control plane"],
    blocks: [
      why(
        "Platform Admin sees the fleet. It is not a floor login and must not be shared as a demo password.",
      ),
      ul(
        "Console — live organizations only. Demo houses do not appear here.",
        "Pipeline — prospects from intake through contract and onboarding.",
        "Demos — shareable type rooms and the full product tour. Isolated from tenants.",
      ),
      steps(
        "Sign in, complete the forced password change, land on the control plane.",
        "Use Console, Pipeline, and Demos in the header. The choice sticks until you click another.",
        "Empty tenants is valid. Do not expect demo orgs in statistics.",
        "Send prospects a /demo/{type} link — never this Admin session.",
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
        "Packages decide which modules appear. Core POS and KDS are the floor.",
      ),
      steps(
        "Confirm the location mode (restaurant vs host + operators) matches how you actually serve.",
        "Add staff PINs and section assignments.",
        "Build enough menu to send a ticket. Do not wait for a demo seed.",
        "Close the period on Settle. Guest cards are Quantum Payments.",
      ),
      tip("The Operators Guide overlay is in the header on every surface."),
      related("login", "invites-roles", "host-capture", "type-restaurant"),
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
        "Seat (or open a counter check). Add items. Send.",
        "Take Quantum Payments when online. If the uplink is down, cash still closes; card requires connection.",
        "Do not open a second check for another operator on a host floor.",
      ),
      p(
        "On a host + multi-operator floor, food and drinks still live on one guest check. You are not splitting cards by stall.",
      ),
      related("type-restaurant", "type-food-hall", "host-capture"),
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
        "Start, bump, or recall. Bump still works offline on this station. Do not take payment from the KDS.",
        "On a host floor, bar tickets belong to the bar operator; kitchen tickets to the kitchen operator.",
      ),
      related("type-food-hall", "type-bar-lounge", "type-restaurant"),
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
        "Full control of your menu, modifiers, 86, tickets/KDS, schedules, and your reports slice.",
        "Peer menus are view-only unless the host grants edit_menu. You cannot change another operator’s settings.",
        "Operator ops: your staff, time clock, and 86 board.",
        "View-only settlement slice. Payout destinations are host-managed — you cannot edit banks, tax, or host branding.",
        "A $35 dispute fee, when filed, splits by merchandise on that check.",
      ),
      p(
        "The Laundry demo (Steam Distillery + Diamond House BBQ) is the rehearsal for this model. It is not a live tenant.",
      ),
      related("type-food-hall", "host-capture", "chargebacks", "prospect-demos"),
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
        "Kitchen / expo — KDS-first. Bartender — bar KDS and tabs.",
        "Cashier — counter queue and pay.",
        "Vendor operator — entity dashboard (own menu, tickets, reports). Peer menus view-only unless the host grants. Not host settings or payouts.",
        "Accountant — reports and ledger.",
        "Platform Admin — control plane after Sign in, not a restaurant PIN.",
      ),
      steps(
        "PIN in. Home is that role’s dashboard.",
        "The first time in that role, take the live walkthrough (or skip / replay later).",
        "Nav only lists views you can open. Settings writes are owner/manager.",
        "On The Laundry, PIN 9999 owner, 1111 server, 5555 kitchen, 6666 Steam operator, 7777 Diamond operator.",
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
        "Guest operator login: own menu (create/edit/86), own tickets/KDS, own reports, own staff and time clock. Peer menus default view-only. Cannot edit another entity unless the host grants edit_menu.",
        "Devices: house assets. Host assigns any tablet to any entity + function (Steam bar KDS, Diamond floor POS, host kiosk).",
      ),
      steps(
        "PIN as host owner. Host settings → Operators to onboard a stall (name, station, payout last 4).",
        "Open Entity permissions. Defaults: view_menu on, edit_menu off, tickets/reports/settlement own-only, devices host-only.",
        "Open Device assignment. Point Tablet A at Steam bar KDS and Tablet B at Diamond floor POS — no new hardware.",
        "Switch Demo mode to Steam Distillery. Edit a Steam item. Diamond items show “view only.”",
        "Switch to Diamond House BBQ. Steam menu is read-only. You cannot change Steam settings.",
      ),
      warn(
        "Payout / settlement bank / payment routing never lives on the guest operator. The host collects the destination at onboard and can change it later.",
      ),
      related("location-settings", "role-vendor", "type-food-hall", "settlement", "device-assignment"),
    ],
  }),
];
