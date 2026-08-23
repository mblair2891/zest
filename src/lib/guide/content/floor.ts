import { callout, p, related, shot, steps, tip, topic, ul, warn, why } from "./helpers";
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
        "Each table shows a status: open, seated, ordering, fired, check, paid, reserved, or dirty. A color bar is the section (Dining, Booth, Bar, or custom).",
      ),
      shot(
        "Floor map with section color bars and an Up badge on a table whose food was just bumped.",
        "Restaurant floor plan with colored section bars on tables.",
      ),
      steps(
        "Open Floor. Filter All, Mine (your sections), or a named section.",
        "Tap an open table. Enter party size and confirm the server if prompted.",
        "Jump to Order to build items, or stay on Floor to watch status.",
        "After pay, the table goes paid → dirty. Busser or server marks it clean for the next turn.",
      ),
      related("sections", "checks-comps", "counter-vs-table", "kds"),
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
        "Servers cannot enter orders on another section’s table.",
        "Servers cannot seat a table in another section.",
        "A manager can grant one extra table for this shift, or just that seating.",
        "Shift grants drop at clock-out. Seating grants drop when the table is cleared.",
        "Settings → Section control chooses which roles are limited and whether bartenders stay on the bar.",
      ),
      steps(
        "Open Staff. Tap section chips on a person (Dining / Booth / Bar).",
        "Use Grant to give one overflow table (shift or seating).",
        "Open Settings → Section control for lock rules.",
        "Recolor or rename sections in the Floor editor.",
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
        "To transfer: Floor → Transfer, tap source then destination (or use merge/split).",
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
        "For table: never take a card on an unnamed counter ticket if the guest is seated — attach the table so KDS and the floor stay in sync.",
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
        "When a table in the right section is open, Seat onto that table.",
        "The assigned server (or the section default) owns the check from there.",
        "Respect section locks — a manager grant is required to seat across sections.",
      ),
      related("floor-tables", "sections", "invites-roles"),
    ],
  }),
];
