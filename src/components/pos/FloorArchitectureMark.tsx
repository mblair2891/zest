import type { PointerEvent as ReactPointerEvent } from "react";
import type { Table } from "@/lib/pos/types";
import { isArchitectureKind, planToLocal, storedBarPlan } from "@/lib/pos/floor-architecture";

/** Walls, doors, windows, host stand, and the bar rail. No dining chairs. */
export function FloorArchitectureMark({
  table,
  selected,
  onBarPointerDown,
}: {
  table: Table;
  selected?: boolean;
  onBarPointerDown?: (event: ReactPointerEvent<SVGPathElement>) => void;
}) {
  if (!isArchitectureKind(table.kind)) return null;
  const rotation = ((Number(table.rotation) || 0) % 360 + 360) % 360;
  const spin = { transform: `rotate(${rotation}deg)`, transformOrigin: "center center" } as const;
  if (table.kind === "bar_top") {
    const plan = storedBarPlan(table);
    const pts = planToLocal(plan, table);
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    return (
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full"
        data-floor-bar="slab"
        data-floor-bar-shape={table.barShape ?? "straight"}
        data-floor-rotation={rotation}
        data-bar-legs={(table.legLengths ?? []).join(",")}
        data-floor-bar-selected={selected ? "1" : "0"}
        style={{ ...spin, pointerEvents: "none" }}
      >
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={28}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "stroke" }}
          onPointerDown={onBarPointerDown}
        />
        <path
          d={d}
          fill="none"
          stroke={selected ? "var(--primary)" : "#3d2914"}
          strokeWidth={14}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
        <text x="50" y="46" textAnchor="middle" fontSize="14" fill="#f4efe6" fontWeight={700} style={{ pointerEvents: "none" }}>
          BAR
        </text>
      </svg>
    );
  }
  if (table.kind === "host_stand") {
    return (
      <div
        data-floor-host="stand"
        data-floor-rotation={rotation}
        className="flex h-full w-full items-center justify-center rounded-md bg-[#6b4a2a] text-[10px] font-bold text-[#f4efe6]"
        style={spin}
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
      data-floor-rotation={rotation}
      className={`h-full w-full rounded-sm ${tone} ${table.kind === "door" ? "border-2 border-[#3d2914]" : ""}`}
      style={spin}
    />
  );
}
