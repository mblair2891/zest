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
        "Help button (header): ask a task. Answers from this guide for Platform Admin — not a second guide browser. Floor staff never see CRM Help.",
      ),
      steps(
        "Log in at app.summex.app/login with username and password (no Google/X). Complete the forced password change. You land on the platform dashboard — not the sales home.",
        "Use Console and Pipeline in the header.",
        "Empty tenants is valid until someone completes SaaS onboarding. Click a listed tenant to open that venue’s settings.",
        "Send prospects Get pricing — never this Admin session.",
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
        "Log in at app.summex.app/login. You open that house (venue home), not the marketing page. PIN as owner or manager. Floor: Entire location or By section. Combine tables (lowest number). Reports → AI analysis; Settings for daily/weekly.",
        "Staff, menu, floor, cash drawer, settlement. Loss-prevention gates and exception queue (Home feed + Reports).",
        "Packages decide which modules appear. Core POS and ODS are the floor.",
        "Optional Employment (HR) is per entity: host or a tenant operator as employer. Flags and visibility live on HR → Flags.",
      ),
      steps(
        "Confirm the location mode (restaurant vs host + operators) matches how you actually serve.",
        "Add staff PINs and section assignments.",
        "Build enough menu to send a ticket. Do not wait for a demo seed.",
        "Costs → Recipes: describe or upload a recipe, confirm, save. Price recs use those costs.",
        "Close the period on Settle. Guest cards are Quantum Payments.",
      ),
      tip("The Operators Guide overlay is in the header on every surface."),
      p(
        "Help button (header): ask how to do a task. Answers from this guide for owner/manager and this location — not a second guide browser.",
      ),
      related("login", "invites-roles", "host-capture", "type-restaurant", "recipes-prep", "location-training", "hr-employment", "loss-prevention"),
    ],
  }),
  topic({
    id: "role-host-stand",
    chapterId: "roles",
    title: "Host stand",
    summary: "Floor, seat, waitlist and reservations, to-go. Not server till close.",
    roles: ["server", "owner_manager"],
    keywords: ["host stand", "seat", "waitlist", "reservation", "to-go", "host PIN"],
    openView: "waitlist",
    blocks: [
      why(
        "The host stand runs the door and to-go, not the kitchen rail and not another entity’s 86 board.",
      ),
      ul(
        "After PIN: floor map, seat, waitlist / reservation check-in, open a to-go check.",
        "You do not 86 another entity’s recipes by default. You do not close a server’s till.",
        "Help only explains seating, waitlist, and to-go — not Devices, Publish, or ODS bump.",
      ),
      steps(
        "PIN in on a host station. Home is the host stand. Floor and To-go are two large buttons — not a dense toolbar.",
        "Seat from the floor map. Check in waitlist and reservations.",
        "Open to-go from Takeout. Pay if the house allows host tenders.",
      ),
      warn("PIN is not clock-in. A host PIN cannot bump ODS or edit menus."),
      related("floor-pin-login", "role-server", "kiosk-waitlist", "shift-allowables"),
    ],
  }),
  topic({
    id: "role-server",
    chapterId: "roles",
    title: "Server / floor",
    summary: "Assigned sections, one check, send, pay, own closeout.",
    roles: ["server"],
    keywords: ["server", "floor", "check", "seat", "pay", "closeout"],
    openView: "floor",
    blocks: [
      why(
        "The server owns the check. Kitchen and bar see tickets, not the guest.",
      ),
      ul(
        "Assigned sections and tables. Order both menus onto one check on a shared venue. Send. Pay if the house allows. Transfer or release a table. Own closeout.",
        "Cannot bump ODS, edit menus, or open Devices.",
        "Peer venue: you can sell both brands on one check. You cannot edit the other entity’s menu or schedule.",
      ),
      steps(
        "PIN in. Home is Floor or Order — not a list of every module. On an 8\" handheld the menu is full width; tap Check for the slide-over.",
        "Open a table in your section. Add food and drink to one check. Send.",
        "Bar tab opens your assigned section stools — tap a stool. To-go does not use the floor.",
        "Pay when the house allows. Close your own till at end of shift.",
      ),
      warn("A server PIN cannot bump the kitchen rail or change Devices."),
      related("role-host-stand", "role-bartender", "role-kitchen", "hr-staff-basics", "server-closeout"),
    ],
  }),
  topic({
    id: "role-bartender",
    chapterId: "roles",
    title: "Bartender",
    summary: "Bar well, drink send, own drawer. Bar ODS bump only on an ODS station.",
    roles: ["kitchen_bar"],
    keywords: ["bartender", "bar", "well", "drink", "ods", "drawer"],
    openView: "order",
    blocks: [
      why(
        "The well is the bartender’s job. Seating the dining room is the host’s unless you were granted it.",
      ),
      ul(
        "Bar well orders and drink send. Own drawer if assigned.",
        "Bar tab opens your assigned section rail (color-coded stools). Tap a stool to open or attach the check. That is not seating the dining room.",
        "Bump bar ODS only when this tablet is an Order Display station.",
        "Cannot seat the dining room unless a host grant is on.",
      ),
      steps(
        "PIN in on an order station to ring the well. Bar tab → pick a stool in your section, then ring. On a bar ODS tablet, Start and Bump drinks.",
        "Close your own drawer if the house assigned you one.",
      ),
      warn("A bartender PIN does not run the host stand."),
      related("role-kitchen", "role-server", "role-host-stand", "type-bar-lounge"),
    ],
  }),
  topic({
    id: "role-kitchen",
    chapterId: "roles",
    title: "Kitchen",
    summary: "ODS only: Start and Bump. No payments, no drawer, no price edits.",
    roles: ["kitchen_bar"],
    keywords: ["kitchen", "ods", "bump", "ticket", "expo"],
    openView: "kitchen",
    blocks: [
      why(
        "The rail is the source of truth for the line. Bump tells the floor the plate is up.",
      ),
      ul(
        "Kitchen PIN is ODS only — Start and Bump.",
        "No payments, no cash drawer, no menu price edits.",
        "86 is own recipes, not another entity’s board.",
      ),
      steps(
        "PIN into Kitchen. You see this station’s tickets.",
        "Start when you begin. Bump when ready. Do not take a card from the ODS.",
      ),
      related("role-bartender", "role-server", "recipes-prep", "printers-kds"),
    ],
  }),
  topic({
    id: "role-kitchen-bar",
    chapterId: "roles",
    title: "Kitchen / bar (index)",
    summary: "Two PIN jobs: kitchen ODS and bartender well. Separate pages.",
    roles: ["kitchen_bar"],
    keywords: ["kitchen", "bar", "kds", "bump", "ticket"],
    blocks: [
      why("Kitchen and bartender are different PINs. Each gets only that job’s tools."),
      ul(
        "Kitchen — ODS Start/Bump. See Kitchen.",
        "Bartender — well orders, drink send, bar ODS if that station. See Bartender.",
      ),
      related("role-kitchen", "role-bartender", "recipes-prep"),
    ],
  }),
  topic({
    id: "role-busser",
    chapterId: "roles",
    title: "Busser",
    summary: "Dirty → clean tables only. No orders, no payments.",
    roles: ["server"],
    keywords: ["busser", "dirty", "clean", "table", "turn"],
    openView: "floor",
    blocks: [
      why("A busser turns tables. They do not ring or tender."),
      ul(
        "After PIN: mark tables dirty then clean.",
        "No orders, no payments, no ODS, no Devices.",
      ),
      steps(
        "PIN in. Open Floor.",
        "Tap a dirty table. Mark clean when it is reset.",
      ),
      related("role-host-stand", "role-server", "floor-pin-login"),
    ],
  }),
  topic({
    id: "role-supervisor",
    chapterId: "roles",
    title: "Supervisor",
    summary: "Floor, expedite, voids/comp within limits, clock exceptions. Not Publish.",
    roles: ["owner_manager"],
    keywords: ["supervisor", "expedite", "void", "comp", "clock exception"],
    openView: "floor",
    blocks: [
      why(
        "A supervisor runs the floor and exceptions. They are not a manager and not Platform Admin.",
      ),
      ul(
        "Floor plus expedite (ODS). Voids and comps within house limits. Clock exceptions.",
        "No platform CRM. No Publish unless the person is also a manager.",
        "Does not close a server’s till; they can approve closeout exceptions the house allows.",
      ),
      steps(
        "PIN in. Home is the floor.",
        "Expedite the rail. Approve a void/comp within limits. Resolve a clock exception in Labor.",
      ),
      related("role-owner", "floor-pin-login", "loss-prevention", "shift-allowables"),
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
        "Password login at app.summex.app/login (Entity admin). Never a PIN pad, never platform CRM. Scoped to your selling entity.",
        "Dashboard: your menu, recipes, costs/invoices, schedule and payroll export, reports, 86, and staff PINs for this entity.",
        "You cannot edit the other entity’s menu, payout, or labor. Reports and labor % use owned lines (what this entity is paid).",
        "Peer menus are view-only on the floor unless the venue grant allows selling them. You cannot change another operator’s settings.",
        "A $35 dispute fee, when filed, splits by merchandise on that check.",
        "On a shared venue there is no fake host merchant. Help answers from this guide for your entity — not host payouts or platform CRM.",
      ),
      p(
        "Rehearse this model by onboarding a host + two operators. There is no seeded catalog.",
      ),
      related("type-food-hall", "host-capture", "chargebacks", "settlement"),
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
        "Manager — venue back office, all floor tools, Devices, Publish, closeout approve. Not platform CRM.",
        "Supervisor — floor, expedite, voids/comp within limits, clock exceptions. Not Publish.",
        "Server — assigned sections, one check, send, pay, own closeout. Not ODS bump, not menus, not Devices.",
        "Host stand — seat, waitlist/reservations, to-go. Not server till close.",
        "Bartender — bar well, drink send, own drawer, bar ODS if that station. Not seating the dining room unless granted.",
        "Kitchen — ODS Start/Bump only. No pay, no drawer, no price edits.",
        "Busser — dirty → clean only.",
        "Password dashboards (never the PIN pad): Platform Admin · host owner · venue admin · entity owner · entity manager · accountant. Tiles are subscribed modules only. Deep links match API grants.",
        "Entity owner — that brand: sales, labor %, 86, menu, invoices, schedule, payout, payments.",
        "Entity manager — same ops plus floor tools from back office. No billing/payments settings.",
        "Accountant — reports, hours export, gift liability. No Devices. No 86.",
        "Host owner (host + tenants) — venue health, every entity, Devices, Publish, combined and per-entity reports.",
        "Venue admin (shared venue) — same minus host-merchant chrome. Not a landlord brand.",
        "PIN roles stay on the station home (host floor, server order, kitchen ODS) — not these dashboards.",
        "Platform Admin — control plane after Sign in, not a restaurant PIN.",
      ),
      steps(
        "PIN in. Home is that role’s dashboard.",
        "The first time in that role, take the live walkthrough (or skip / replay later).",
        "Nav only lists tools that job needs. A live station has no dropdown of every view. Change-device stays for managers in training/demo only.",
        "Staff PINs are unique to this location. There is no universal PIN.",
        "Help button (header): ask how to do a task. Answers from this guide for that role and this location.",
      ),
      related("role-walkthroughs", "login", "role-owner", "role-server", "role-host-stand", "role-bartender", "role-kitchen", "role-busser", "role-supervisor", "role-vendor", "location-settings"),
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
        "Every house: profile, tax, Quantum Payments tenders, cash discount, devices, staff, notifications, hours, staffing recs (cut/hold/add — never auto clock-out), scheduled AI ops jobs.",
        "Full-service: sections and floor control.",
        "Bar: tab auto-close.",
        "Counter / QSR / café / ghost: ticket prefix and expo.",
        "Host + multi-operator: Host settings (tax, cash discount, Quantum Payments, payouts, entity permission matrix, device assignment) vs Operators (ops only). Guest operators never edit host merchant or payout routing.",
        "Kiosk / waitlist types: kiosk mode, waitlist, reservation check-in, SMS on/off and monthly cap (defaults to platform included; location may only go lower).",
      ),
      steps(
        "PIN as owner or manager. Open Home → Location settings.",
        "Confirm the type badge (restaurant, host hall, bar, QSR…).",
        "Save each pack. Settings persist on the location for every paired tablet.",
      ),
      related("roles-dashboards", "host-operator-settings", "cash-discount", "feature-kiosk", "type-food-hall"),
    ],
  }),
  topic({
    id: "host-operator-settings",
    chapterId: "roles",
    title: "Host vs guest operator settings",
    summary: "Host owner/manager password login has full tenant ops. Tenant entity logins stay on their own slice. Shared venue has no host role.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["host", "operator", "payouts", "settings", "subscriber", "stall"],
    openView: "settings",
    blocks: [
      why(
        "The SaaS customer is the host location. Guest brands that cook or pour there are onboarded onto that host — they are not separate subscribers with their own tax, MID, or payout routing.",
      ),
      ul(
        "Host owner/manager (password at app.summex.app/login): Devices, floor, every tenant menu, reports, costs, labor, payments split, grants, payout destinations, settlement, host cut, entity permission matrix. Full tenant ops data — not a PIN pad.",
        "Tenant entity login: own menu, recipes, costs/invoices, schedule/payroll export, reports, 86, staff PINs for that entity only. Cannot edit another tenant’s menu, payout, or labor.",
        "Shared venue: no host role. Venue admin is not a landlord merchant. Each operator completes their own Quantum Payments and menu.",
        "Devices: house assets, not locked roles. Host enrolls tablets. Any device switches via This station (Operator B bar ODS, Operator A floor POS, host kiosk, or split ODS).",
      ),
      steps(
        "Sign in as host owner/manager at app.summex.app/login. Open the host dashboard — Devices, Floor, Menus, Reports, Costs, Labor, Payments, Grants.",
        "Open Grants / Entity permissions. Defaults: view_menu on, edit_menu off for tenant-to-tenant, tickets/reports/settlement own-only, devices host-only. Host can still edit every tenant.",
        "Invite a tenant. They get an entity admin email + temp password (force change) at /login — never a PIN.",
        "Sign in as that tenant. Only that brand’s slice is editable.",
        "Floor staff still PIN on the station. Password login never hits the PIN pad.",
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
        "A shared tablet is not a laptop. Servers should not type a password between tables. Owners should not export hours from a four-digit code.",
      ),
      ul(
        "Back office: Sign in with username/email and password. Platform Admin, owners, managers, accountants, entity managers for settings, matrix, full reports, schedule admin, hours export, menu management.",
        "Prime once: Open POS from that signed-in session while online. After that the station is PIN-only — not /login.",
        "Floor PIN: 4-digit keypad on the station (order, ODS, or host). Servers, hosts, bartenders, kitchen, cashiers, expo. Fast Switch user. PIN hashed, scoped to location and entity.",
        "PIN ≠ clock ≠ closeout. The pad logs you into the station. After PIN, if you are off the clock and inside that entity’s allowed clock-in window for today’s shift, a prompt offers Clock in for this shift? — Clock in or Not now. Outside the window: no prompt; Labor can still red-flag a later punch. Already on the clock: no prompt. Password login never shows it.",
        "Assigned device still requires the matching entity’s PIN (Operator A ODS rejects an Operator B PIN).",
        "Printed receipts group lines by vendor. The guest still holds one check.",
        "Kiosk guests never enter a PIN. Marketing pages never show a PIN pad or staff PINs. Platform Admin cannot use a restaurant PIN.",
      ),
      steps(
        "After a location exists, prime the tablet once from the control plane. Staff then use the production floor PIN pad. Each person has their own 4-digit PIN — there is no universal 0000.",
        "Tap Switch user to PIN in the next person without reassigning the tablet.",
        "Clock in from Labor, or accept Clock in for this shift? after PIN when you are inside the allowed window. Not now does not punch.",
        "Closeout is Cash — not PIN and not clock-out.",
        "Open Settings from a floor PIN — you are asked for back-office password.",
      ),
      related("login", "shift-allowables", "device-roles", "entity-schedule-payroll", "host-operator-settings", "device-assignment", "voice-control", "ai-ops-learning"),
    ],
  }),
  topic({
    id: "entity-schedule-payroll",
    chapterId: "roles",
    title: "Entity schedule & hours export",
    summary: "Each entity schedules its own staff and exports hours. Summex does not process payroll.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["schedule", "payroll", "shifts", "overtime", "tips", "operator", "adp", "intuit", "csv"],
    openView: "schedule",
    blocks: [
      why(
        "The food operator’s week is not the bar operator’s week. Each entity owns employees, shifts, pay period, clock rules, overtime flags, and labor % on owned lines.",
      ),
      ul(
        "Scheduling has an entity switcher. Default is the entity the logged-in manager belongs to. Venue admin can view both boards — they are never one merged calendar.",
        "Publish week publishes that entity only. It does not merge the other calendar.",
        "You cannot drag a bar-operator person onto the food operator’s board without an explicit “work for other entity this shift” grant (same idea as an extra table outside section). Shift grants drop at clock-out.",
        "Clock in / PIN is still the venue tablet. Hours post to the entity on the shift, or the person’s home entity if they have no shift.",
        "Reports and AI labor use that entity’s sales basis only (owned lines on a shared venue).",
        "Boards stay empty until you add staff in Users. No users or shifts are auto-created.",
        "Hours export stays entity-scoped. Summex does not process payroll.",
      ),
      steps(
        "Open Schedule. Confirm the switcher is your home entity (bar operator or food operator).",
        "Add a shift for that entity’s staff. Publish week — the other entity’s board is unchanged.",
        "To put a bar-operator person on the food operator tonight: venue admin grants work for other entity this shift, then drop them on that entity’s day.",
        "PIN in on any tablet. Clock in from Labor (or the optional after-PIN prompt when inside the window). Hours land on the shift’s entity.",
      ),
      related("shift-allowables", "payroll-export", "floor-pin-login", "host-operator-settings", "role-vendor"),
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
        "Operator A voice cannot 86 an Operator B item. Device assignment still applies.",
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
        "Live AI ops card on owner/manager/host (and vendor) Home: staffing cut/hold/add, slow tickets, waitlist vs idle tables.",
        "Accept records the decision. A cut rec offers Notify employee to close out — it never clocks anyone out.",
        "Dismiss downranks that type in similar dayparts. Snooze hides it for 20 minutes.",
        "Reports → AI insights shows “Based on your past decisions” when a pattern exists.",
        "Learning stays on this location. Tenants never share decisions.",
        "Operator A AI cannot change Operator B.",
      ),
      steps(
        "Open Home as host. Read the labor vs sales card.",
        "Dismiss it twice — confidence drops and the card notes you’ve dismissed this kind of tip.",
        "Accept it — later runs say Based on your past decisions and rank it higher.",
      ),
      related("voice-control", "location-settings", "roles-dashboards", "ai-insights", "ops-jobs", "staffing-recs"),
    ],
  }),
  topic({
    id: "staffing-recs",
    chapterId: "roles",
    title: "Realtime staffing cut / hold / add",
    summary:
      "Recommendations only. Manager decides. Never auto clock-out. Optional notify to close out.",
    roles: ["owner_manager", "host_operator", "vendor_operator", "server", "kitchen_bar"],
    keywords: ["staffing", "cut", "hold", "add", "labor", "idle", "waitlist", "ODS"],
    openView: "labor",
    blocks: [
      why(
        "The floor needs a live read of labor vs demand — not a bot that punches people out. Summex recommends cut, hold, or add. You decide.",
      ),
      p(
        "Location settings → Staffing recs (also Labor → Rules): on/off, min headcount per role, labor % target and high alert, sales-per-labor-hour floor, idle minutes with no tables or tickets before a cut, no-cut windows (open/close padding plus optional rush lock by daypart), lookahead from reservations, waitlist, and typical turn. Notify manager, host, and/or expo. Optional ADD recs when waitlist, quoted wait, or ODS depth exceeds thresholds.",
      ),
      p(
        "The engine watches sales velocity vs the same daypart baseline, open tables, ODS depth and times, waitlist, reservations, clocked-in roles, and a labor $ proxy (hours × house hourly rate — not a payroll run). It emits recommend_cut, recommend_hold, or recommend_add with reasons.",
      ),
      p(
        "Accept and dismiss are stored so later recs can weight your house. Accept is not a clock-out. On a cut rec, Notify employee to close out pings them to finish tables and close out when ready.",
      ),
      warn(
        "Recommendations only. The manager decides. Summex never auto clock-out.",
      ),
      related("ai-ops-learning", "ops-jobs", "shift-allowables", "roles-dashboards", "labor-basis"),
    ],
  }),
  topic({
    id: "labor-basis",
    chapterId: "roles",
    title: "Labor vs what they are paid",
    summary:
      "On a shared venue, each entity’s labor %, SPLH, food/pour cost, and staffing recs use owned lines — not the whole guest check.",
    roles: ["owner_manager", "host_operator", "vendor_operator"],
    keywords: ["labor", "owned lines", "SPLH", "food cost", "pour cost", "peer venue", "staffing"],
    openView: "settings",
    blocks: [
      why(
        "The bar operator is paid for drinks. The food operator is paid for food. Mixing both into one labor % lies about the house.",
      ),
      p(
        "Location settings → Labor basis (peer venue and host + tenants). Per entity: owned lines (default on a shared venue), all-check sales, or selected categories. Labor $, labor %, SPLH, food cost, pour cost, and staffing recs use that basis only. Recs label it — bar operator labor vs beverage sales $.",
      ),
      ul(
        "Owned lines: what that entity is paid on card capture. Bar operator = drink/bar lines. Food operator = food lines.",
        "All-check: whole guest check. Rare on a shared floor.",
        "Selected categories: pick the categories that count.",
        "Shared venue costs (rent, utilities): optional allocation % per entity. Off by default. Do not dump the same cost into both labor %.",
        "Tip-out and pools stay the existing rules. They do not mix into labor % unless you turn on tips in labor.",
      ),
      steps(
        "Owner: Location settings → Labor basis. Confirm each operator is on owned lines. Entity admin reports and labor % always use owned lines for that brand.",
        "Publish if tablets should pick up the setting. Staff keep the last snapshot until Switch user.",
        "Read staffing recs and cost pictures with the basis in the line.",
      ),
      warn(
        "Do not run bar-operator labor against food-operator sales. Do not allocate 100% of rent to every entity.",
      ),
      related("staffing-recs", "device-roles", "android-kiosk", "cost-control", "tip-pooling"),
    ],
  }),
];
