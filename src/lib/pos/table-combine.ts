/**
 * Live floor: drag table A onto table B so A joins B's party.
 * Checks stay on the table they were opened on unless moved on purpose.
 * Separating never deletes items.
 */
import type { Table } from "./types";

function displayLabel(t: Table): string {
  return t.originalLabel ?? t.label;
}

function groupRootId(tables: Table[], id: string): string {
  const t = tables.find((x) => x.id === id);
  if (!t) return id;
  return t.mergedIntoId ?? id;
}

function groupMembers(tables: Table[], rootId: string): Table[] {
  if (!tables.some((t) => t.id === rootId)) return [];
  return tables.filter((t) => t.id === rootId || t.mergedIntoId === rootId);
}

function floorMapNumber(label: string): string {
  const s = String(label ?? "")
    .trim()
    .replace(/^table\s+/i, "");
  return s || String(label ?? "").trim();
}

export const FLOOR_COMBINE_ROLES = ["host", "server", "bartender", "manager", "owner", "supervisor"] as const;

type CheckLike = {
  id: string;
  number?: string | number;
  status: string;
  tableId?: string;
  lines?: Array<{ voided?: boolean; sent?: boolean }>;
};

export function tableToken(label: string): string {
  const raw = String(label || "").trim();
  if (/^t\d+/i.test(raw)) return `T${raw.replace(/^t/i, "")}`;
  const n = raw.match(/(\d+)/);
  if (n) return `T${n[1]}`;
  return raw || "Table";
}

export function canCombineTables(opts: {
  role?: string | null;
  clockedIn?: boolean;
  combineRequiresManager?: boolean;
  managerPinOk?: boolean;
}): { ok: true } | { ok: false; error: string } {
  if (!opts.clockedIn) return { ok: false, error: "Clock in before combining tables" };
  const role = String(opts.role || "");
  if (!FLOOR_COMBINE_ROLES.includes(role as (typeof FLOOR_COMBINE_ROLES)[number])) {
    return { ok: false, error: "Host, server, bartender, or manager can combine tables" };
  }
  const manager = role === "manager" || role === "owner" || role === "supervisor";
  if (opts.combineRequiresManager && !manager && !opts.managerPinOk) {
    return { ok: false, error: "Manager PIN required to combine" };
  }
  return { ok: true };
}

export function partyHeader(tables: Table[], tableId: string): string {
  const root = groupRootId(tables, tableId);
  const members = groupMembers(tables, root);
  const primary = members.find((t) => t.id === root) ?? members[0];
  if (!primary) return "Table";
  const joined = members.filter((t) => t.id !== primary.id);
  const head = tableToken(displayLabel(primary));
  if (!joined.length) return head;
  return `${head} + ${joined.map((t) => tableToken(displayLabel(t))).join(" + ")}`;
}

export function clusterNumbers(tables: Table[], primaryId: string): { primary: string; joined: string[] } {
  const root = groupRootId(tables, primaryId);
  const members = groupMembers(tables, root);
  const primary = members.find((t) => t.id === root);
  const joined = members.filter((t) => t.id !== root);
  return {
    primary: floorMapNumber(displayLabel(primary ?? members[0]!)),
    joined: joined.map((t) => floorMapNumber(displayLabel(t))),
  };
}

function openOn(orders: CheckLike[], tableId: string): CheckLike[] {
  return orders.filter((o) => o.status === "open" && o.tableId === tableId);
}

export function dragJoinParty<T extends CheckLike>(opts: {
  tables: Table[];
  orders: T[];
  dragId: string;
  ontoId: string;
}): { ok: true; tables: Table[]; orders: T[] } | { ok: false; error: string } {
  const onto = groupRootId(opts.tables, opts.ontoId);
  const drag = groupRootId(opts.tables, opts.dragId);
  if (!opts.tables.some((t) => t.id === onto) || !opts.tables.some((t) => t.id === drag)) {
    return { ok: false, error: "Table not on this floor" };
  }
  if (onto === drag) return { ok: false, error: "Already one party" };
  const moving = groupMembers(opts.tables, drag).map((t) => t.id);
  const existing = groupMembers(opts.tables, onto)
    .map((t) => t.id)
    .filter((id) => id !== onto);
  const childIds = [...new Set([...existing, ...moving])];
  const tables = opts.tables.map((t) => {
    if (t.id === onto) {
      return { ...t, mergedIntoId: undefined, mergedChildIds: childIds };
    }
    if (childIds.includes(t.id)) {
      return { ...t, mergedIntoId: onto, mergedChildIds: undefined };
    }
    return t;
  });
  return { ok: true, tables, orders: opts.orders };
}

export function moveChecksToPrimary<T extends CheckLike>(opts: {
  tables: Table[];
  orders: T[];
  primaryId: string;
}): { ok: true; tables: Table[]; orders: T[] } | { ok: false; error: string } {
  const root = groupRootId(opts.tables, opts.primaryId);
  const childIds = new Set(groupMembers(opts.tables, root).filter((t) => t.id !== root).map((t) => t.id));
  if (!childIds.size) return { ok: false, error: "Not a combined party" };
  const orders = opts.orders.map((o) =>
    o.status === "open" && o.tableId && childIds.has(o.tableId) ? { ...o, tableId: root } : o,
  );
  return { ok: true, tables: opts.tables, orders };
}

function detach(table: Table, orders: CheckLike[]): Table {
  const still = openOn(orders, table.id);
  let status = table.status;
  if (!still.length) status = "empty";
  else if (!still.some((o) => (o.lines ?? []).some((l) => !l.voided && l.sent))) status = "sat_no_order";
  return {
    ...table,
    mergedIntoId: undefined,
    mergedChildIds: undefined,
    label: table.originalLabel ?? table.label,
    seats: table.originalSeats ?? table.seats,
    status,
    statusSince: Date.now(),
    orderId: still[0]?.id,
  };
}

export function separateMember<T extends CheckLike>(opts: {
  tables: Table[];
  orders: T[];
  primaryId: string;
  removeId: string;
  transferToId?: string;
}): { ok: true; tables: Table[]; orders: T[] } | { ok: false; error: string } {
  const root = groupRootId(opts.tables, opts.primaryId);
  const members = groupMembers(opts.tables, root);
  const remove = members.find((t) => t.id === opts.removeId);
  if (!remove || remove.id === root) return { ok: false, error: "That table is not joined to this party" };
  const checks = openOn(opts.orders, remove.id);
  let orders = opts.orders;
  if (checks.length) {
    const dest = String(opts.transferToId || "");
    const destOk = members.some((t) => t.id === dest && t.id !== remove.id);
    if (!destOk) {
      return {
        ok: false,
        error: `Transfer or close ${tableToken(displayLabel(remove))}'s open check before separating`,
      };
    }
    const ids = new Set(checks.map((c) => c.id));
    orders = orders.map((o) => (ids.has(o.id) ? { ...o, tableId: dest } : o));
  }
  const tables = opts.tables.map((t) => {
    if (t.id === remove.id) return detach(t, orders);
    if (t.id === root) {
      const next = (t.mergedChildIds ?? members.filter((m) => m.id !== root).map((m) => m.id)).filter(
        (id) => id !== remove.id,
      );
      return { ...t, mergedChildIds: next.length ? next : undefined };
    }
    return t;
  });
  return { ok: true, tables, orders };
}

export function separateAll<T extends CheckLike>(opts: {
  tables: Table[];
  orders: T[];
  primaryId: string;
  moveChecksToPrimary?: boolean;
}): { ok: true; tables: Table[]; orders: T[] } | { ok: false; error: string } {
  const root = groupRootId(opts.tables, opts.primaryId);
  const children = groupMembers(opts.tables, root).filter((t) => t.id !== root);
  if (!children.length) return { ok: false, error: "Not a combined party" };
  const blocked = children.filter((t) => openOn(opts.orders, t.id).length > 0);
  if (blocked.length && !opts.moveChecksToPrimary) {
    const names = blocked.map((t) => tableToken(displayLabel(t))).join(", ");
    return {
      ok: false,
      error: `Transfer or close open checks on ${names} before separating`,
    };
  }
  let orders = opts.orders;
  if (opts.moveChecksToPrimary && blocked.length) {
    const moved = moveChecksToPrimary({ tables: opts.tables, orders, primaryId: root });
    if (!moved.ok) return moved;
    orders = moved.orders;
  }
  const childIds = new Set(children.map((t) => t.id));
  const tables = opts.tables.map((t) => {
    if (childIds.has(t.id)) return detach(t, orders);
    if (t.id === root) return { ...t, mergedChildIds: undefined };
    return t;
  });
  return { ok: true, tables, orders };
}
