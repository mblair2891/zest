import type { Employee, Order, OrderLine } from "./types";
import type { ActionResult } from "./pos-store";

export type SplitMode = "seat" | "items" | "even" | "piles" | "custom_amount";

export type SplitSpec =
  | { mode: "seat" }
  | { mode: "items"; lineIds: string[] }
  | { mode: "even"; parts: number }
  | { mode: "piles"; piles: string[][] }
  | { mode: "custom_amount"; amountsCents: number[] };

export function canMutateCheck(emp: Employee | null, order: Order): ActionResult {
  if (!emp) return { ok: false, error: "Not signed in" };
  if (emp.role === "owner" || emp.role === "manager") return { ok: true };
  if (
    emp.role === "server" ||
    emp.role === "bartender" ||
    emp.role === "host" ||
    emp.role === "cashier"
  ) {
    if (
      emp.role === "server" &&
      order.serverId &&
      order.serverId !== emp.id
    ) {
      return {
        ok: false,
        error: "Only the assigned server or a manager can split or move this check",
      };
    }
    return { ok: true };
  }
  return { ok: false, error: "This role cannot split or move checks" };
}

export function openLines(order: Order): OrderLine[] {
  return order.lines.filter((l) => !l.voided);
}

export function partitionBySeat(lines: OrderLine[]): Map<number | "shared", OrderLine[]> {
  const m = new Map<number | "shared", OrderLine[]>();
  for (const l of lines) {
    const key = l.seat && l.seat > 0 ? l.seat : "shared";
    const arr = m.get(key) ?? [];
    arr.push(l);
    m.set(key, arr);
  }
  return m;
}

export function roundRobin(lines: OrderLine[], parts: number): OrderLine[][] {
  const n = Math.max(2, Math.min(8, Math.floor(parts)));
  const piles: OrderLine[][] = Array.from({ length: n }, () => []);
  lines.forEach((l, i) => {
    piles[i % n]!.push(l);
  });
  return piles;
}

/** Keep operator / vendor tags on every moved line. */
export function cloneMovedLine(line: OrderLine): OrderLine {
  return {
    ...line,
    vendorId: line.vendorId,
    vendorName: line.vendorName,
  };
}
