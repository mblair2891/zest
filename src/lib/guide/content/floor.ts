import { callout, ol, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
import type { GuideTopic } from "../types";

export const FLOOR_TOPICS: GuideTopic[] = [
  topic({
    id: "floor-tables",
    chapterId: "floor",
    title: "Tables & the floor map",
    summary: "Seat, order, transfer, and turn a table.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: ["floor", "tables", "seat", "map", "turn"],
    openView: "floor",
    blocks: [
      why(
        "The floor map is the live picture of the room. If table state is wrong, kitchen, payment, and turns all drift.",
      ),
      p(
        "Each table is colored by dining status: empty, sat with no order, drinks fired, food fired, food delivered, dining unpaid, or closed and needs bus. A color bar on the top edge is the section (Dining, Booth, Bar, or a custom room). When a status sits past its flash minutes, the table pulses.",
      ),
      shot(
        "Floor map with section color bars and an Up badge on a table whose food was just bumped.",
        "Restaurant floor plan with colored section bars on tables.",
      ),
      steps(
        "Open Floor. Filter All, Mine (your assigned sections), or a named section. Server view defaults to Mine.",
        "Tap an open table. Enter party size. Host stand can assign a server for that section.",
        "Jump to Order to build items, or stay on Floor to watch status.",
        "Release table moves an open check into the offer pool. Another server Accepts — ownership transfers and the audit log records who released, who accepted, and when. Manager can force reassign.",
        "After pay, the table goes closed · needs bus. Busser or server marks it cleaned and it returns to empty.",
      ),
      related("floor-status", "floor-editor", "table-qr", "sections", "checks-comps", "counter-vs-table", "kds"),
    ],
  }),
  topic({
    id: "sections",
    chapterId: "floor",
    title: "Sections, assignments, limits",
    summary: "Color-coded sections, extra-table grants, and order limits.",
    roles: ["owner_manager", "server"],
    keywords: ["section", "assignment", "grant", "dining", "booth", "limits"],
    openView: "employees",
    blocks: [
      why(
        "Section control stops a server from seating or ordering a table that is not theirs — unless a manager grants it.",
      ),
      ul(
        "Tables belong to sections. Staff are assigned to section(s) for the shift.",
        "Server view prioritizes tables in assigned sections (Mine).",
        "Servers cannot enter orders on another section’s table.",
        "Servers cannot seat a table in another section.",
        "Release table: the open check moves to released / unassigned (offer pool). Accept table: the next server takes ownership; audit records who released, who accepted, when.",
        "A manager can force reassign. Host stand can seat into a section and assign a server.",
        "A manager can grant one extra table for this shift, or just that seating.",
        "Shift grants drop at clock-out. Seating grants drop when the table is cleared.",
      ),
      steps(
        "Open Staff. Tap section chips on a person (Dining / Booth / Bar).",
        "Host stand: seat a table, pick the server for that section.",
        "Server A: Floor → table → Release table. Server B: accept from the Released / unassigned strip.",
        "Use Grant to give one overflow table (shift or seating).",
        "Open Settings → Section control for lock rules.",
      ),
      tip(
        "The floor paints a color bar on every table so the room is readable at a glance — including for a host walking the floor.",
      ),
      related("floor-tables", "checks-comps", "invites-roles"),
    ],
  }),
  topic({
    id: "checks-comps",
    chapterId: "floor",
    title: "Opening checks, transfers, comps & voids",
    summary: "Start a check, move it, and apply manager-gated comps/voids.",
    roles: ["owner_manager", "server"],
    keywords: ["check", "transfer", "comp", "void", "manager pin"],
    openView: "order",
    blocks: [
      why(
        "Every guest bill is a check. Transfers keep ownership honest. Comps and voids are the two ways money leaves a check without a tender — they need a manager when policy says so.",
      ),
      steps(
        "Open a table or start Takeout / a bar tab. That creates the check.",
        "Send items to fire them. Unsent lines can still be edited freely.",
        "To move a party to another table: Floor → Transfer, tap source then destination (or use merge/split).",
        "To hand a check to another server: Release table, then the other server Accepts (or a manager force-reassigns).",
        "To void or comp a line, choose Void/Comp. If Settings require it, enter a manager PIN.",
        "Never void a closed check to “fix” a card — use the correct tender or a manager adjustment.",
      ),
      warn(
        "Manager PIN is a station override, not Platform Admin. Owners set whether comps/voids require it in Settings.",
      ),
      related("floor-tables", "tenders-tips", "audit", "counter-vs-table"),
    ],
  }),
  topic({
    id: "counter-vs-table",
    chapterId: "floor",
    title: "Counter vs table service",
    summary: "QSR/café flow versus seated dining.",
    roles: ["owner_manager", "server"],
    keywords: ["counter", "qsr", "cafe", "table service", "takeout"],
    openView: "takeout",
    blocks: [
      why(
        "The same POS covers a seated dining room and a counter. The difference is whether a table holds the check.",
      ),
      ul(
        "Table service — seat on Floor → Order → fire → pay on the table → bus.",
        "Counter / QSR — Takeout or Order without a table, name the ticket, pay (often before fire), kitchen bumps, guest is called.",
        "Bar tab — named tab, items fire as you go, pay at the end. Still Quantum Payments for cards.",
      ),
      steps(
        "For counter: open Takeout, name the guest, build the check, take payment, send.",
        "For table: never take a card on an unnamed counter ticket if the guest is seated — attach the table so ODS and the floor stay in sync.",
        "Hall / pod guests can still pay once at a host stand even if they ordered at several stalls.",
      ),
      related("floor-tables", "multi-operator-orders", "tenders-tips"),
    ],
  }),
  topic({
    id: "host-stand",
    chapterId: "floor",
    title: "Host stand (waitlist & seating)",
    summary: "Walk-ins, quoted waits, reservations, handoff to the server.",
    roles: ["owner_manager", "server"],
    keywords: ["host stand", "waitlist", "reservation", "seat", "quoted wait"],
    openView: "waitlist",
    blocks: [
      why(
        "The FOH host keeps the door honest so servers are not seating over each other. This is not the hall Host Venue role.",
      ),
      steps(
        "Open Host / Waitlist. Add a walk-in with party size and quoted wait.",
        "When a table in the right section is empty, seat onto that table. Optionally assign the server for that section.",
        "Tap a table to change status, preview QR, or jump to the check. Server PIN sessions can update status and open the order.",
        "The assigned server owns the check. They may Release it to the offer pool; another server Accepts.",
        "Respect section locks — a manager grant is required to seat across sections.",
      ),
      related("floor-tables", "floor-status", "table-qr", "sections", "invites-roles"),
    ],
  }),
  topic({
    id: "floor-editor",
    chapterId: "floor",
    title: "Floorplan editor",
    summary: "Drag-and-drop rooms, tables, booths, and barstools. The live floor uses the same layout.",
    roles: ["owner_manager", "host_operator"],
    keywords: ["floor editor", "drag", "resize", "booth", "barstool", "layout", "room"],
    openView: "floor_editor",
    blocks: [
      why(
        "The runtime floor is the saved layout — not a list. If the map is wrong, hosts seat the wrong room and QR tokens sit on the wrong sticker.",
      ),
      ul(
        "Owner, manager, and host stand draw the room.",
        "Place table, booth, barstool, or other. Drag to move. Corner handle resizes.",
        "Properties: label, seats, room/section, shape, kind. Each seat gets a stable table QR token.",
        "Rooms are sections. Multi-room houses switch rooms in the editor and on the live floor.",
        "Layout saves to the location (all paired tablets pick it up). Rotate a token if a sticker is compromised.",
      ),
      steps(
        "Open Floor → Floor editor (or Floor editor in nav).",
        "Add a table, booth, or barstool. Drag it onto the canvas. Resize from the corner.",
        "Set label, seats, and room. Show QR and copy the guest link.",
        "Return to Floor. The live map uses this layout and the status colors from Settings.",
      ),
      tip(
        "Go live always keeps the floorplan. Practice checks can be erased; tables stay where you drew them.",
      ),
      related("floor-tables", "floor-status", "table-qr", "sections"),
    ],
  }),
  topic({
    id: "floor-status",
    chapterId: "floor",
    title: "Table statuses, colors & flash",
    summary: "Pipeline from empty to cleaned, host-mapped colors, SLA flash.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: ["status", "flash", "SLA", "color", "sat", "bus", "cleaned"],
    openView: "settings",
    blocks: [
      why(
        "Color is how a host reads the room from the stand. Flash is how a table that sat too long gets attention without a radio call.",
      ),
      ol(
        "Empty",
        "Sat · no order",
        "Drinks fired",
        "Food fired",
        "Food delivered",
        "Dining · unpaid",
        "Closed · needs bus — cleaned returns to empty",
      ),
      p(
        "Host settings choose which steps are on, the color per status, flash minutes (0/blank = off), who may tap a status (server, host, manager), and who may seat (host stand, manager, or both).",
      ),
      ul(
        "Auto: first drink send → drinks fired; food send → food fired; kitchen bump → delivered then dining unpaid; pay complete → closed · needs bus.",
        "Manual: tap a table on Floor and pick a status. Busser typically marks cleaned.",
        "When minutes are exceeded the table pulses and a staff notice fires. A status change clears the flash.",
      ),
      steps(
        "Settings → Floor statuses, flash & QR.",
        "Turn steps on or off. Map colors. Set flash minutes (0/blank = off).",
        "Seat a table and wait past the sat · no order threshold to see the pulse.",
      ),
      related("floor-tables", "floor-editor", "table-qr", "host-stand"),
    ],
  }),
  topic({
    id: "table-qr",
    chapterId: "floor",
    title: "QR order & pay",
    summary: "Full, hybrid, or pay-only table QR. Guest pays with Quantum Payments on the host check.",
    roles: ["owner_manager", "server", "host_operator"],
    keywords: ["QR", "table QR", "pay QR", "hybrid", "full QR", "token"],
    openView: "settings",
    blocks: [
      why(
        "The sticker on the table is a deep link to that seat at this location. Guests add to the open host check. Capture is always Quantum Payments under the host brand.",
      ),
      ul(
        "A · Full QR — menu, order, and pay at the table.",
        "B · Hybrid — staff seats and starts the check; guests add follow-up food and drinks on the open check.",
        "C · Pay QR only — staff orders; the guest pays via table QR or the printed check QR.",
        "Links: /t/{token} (stable) or /table/{label}. Pay: add ?pay=1.",
      ),
      steps(
        "Pick the QR mode in Settings → Floor statuses, flash & QR.",
        "Print or copy the table QR from Floor (tap a table) or Floor editor.",
        "On Order, Check prints a pay QR for the open ticket.",
        "Guest scan adds to that table’s check when the mode allows. Hybrid will not open an empty table.",
        "Pay is Quantum Payments on the host check. Multi-operator lines keep operator tags; the card is still one host capture.",
      ),
      warn(
        "Tokens are location-scoped. Rotate a token if a sticker walks. Live cards on QR pay still require an approved Quantum application — available in training as sandbox.",
      ),
      related("floor-tables", "floor-status", "quantum-payments", "host-capture", "type-food-hall"),
    ],
  }),
];
