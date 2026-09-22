import type { Table } from "@/lib/pos/types";
import { barRailLocal, isArchitectureKind } from "@/lib/pos/floor-architecture";

/** Walls, doors, windows, host stand, and the bar rail. No dining chairs. */
export function FloorArchitectureMark({ table }: { table: Table }) {
  if (!isArchitectureKind(table.kind)) return null;
  if (table.kind === "bar_top") {
    const pts = barRailLocal(table.barShape ?? "straight", table.points);
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return (
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        data-floor-bar="slab"
        data-floor-bar-shape={table.barShape ?? "straight"}
      >
        <path d={d} fill="none" stroke="#3d2914" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
        <text x="50" y="46" textAnchor="middle" fontSize="14" fill="#f4efe6" fontWeight={700}>
          BAR
        </text>
      </svg>
    );
  }
  if (table.kind === "host_stand") {
    return (
      <div
        data-floor-host="stand"
        className="flex h-full w-full items-center justify-center rounded-md bg-[#6b4a2a] text-[10px] font-bold text-[#f4efe6]"
      >
        Host
      </div>
    );
  }
  const tone =
    table.kind === "window" ? "bg-[#c9d7e0]" : table.kind === "door" ? "bg-[#efe6d8]" : "bg-[#3d2914]";
  return (
    <div
      data-floor-arch={table.kind}
      className={`h-full w-full rounded-sm ${tone} ${table.kind === "door" ? "border-2 border-[#3d2914]" : ""}`}
    />
  );
}
