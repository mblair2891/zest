import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { Table } from "@/lib/pos/types";
import { cn } from "@/lib/utils";
import { isArchitectureKind, liveArchCaption, planToLocal, storedBarPlan } from "@/lib/pos/floor-architecture";

/** Walls, doors, windows, host stand, and the bar rail. No dining chairs. */
export function FloorArchitectureMark({
  table,
  selected,
  className,
  variant = "editor",
  onBarPointerDown,
  onShapePointerDown,
  children,
  extend,
  pxPerIn = 2,
}: {
  table: Table;
  selected?: boolean;
  className?: string;
  /** Live map uses the editor's dark brown so lines stay visible on the wood. */
  variant?: "editor" | "live";
  onBarPointerDown?: (event: ReactPointerEvent<SVGPathElement>) => void;
  onShapePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
  /** Plan units to draw past each centerline end when this wall shares a corner. */
  extend?: { start: number; end: number };
  /** Layout pixels per inch, so the grab stroke is about 8 inches wide. */
  pxPerIn?: number;
}) {
  if (!isArchitectureKind(table.kind)) return null;
  const rotation = ((Number(table.rotation) || 0) % 360 + 360) % 360;
  const spin = { transform: `rotate(${rotation}deg)`, transformOrigin: "center center" } as const;
  const live = variant === "live";
  const caption = live ? liveArchCaption(table) : null;
  if (table.kind === "bar_top") {
    const plan = storedBarPlan(table);
    const pts = plan.length >= 2 ? planToLocal(plan, table) : [{ x: 4, y: 50 }, { x: 96, y: 50 }];
    const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const hitPx = Math.max(12, pxPerIn * 8);
    return (
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full overflow-visible bg-transparent"
        data-floor-bar="stroke"
        data-floor-bar-shape={table.barShape ?? "straight"}
        data-floor-rotation={rotation}
        data-bar-legs={(table.legLengths ?? []).join(",")}
        data-floor-bar-selected={selected ? "1" : "0"}
        data-floor-arch-tone="stroke"
        style={{ ...spin, pointerEvents: "none", background: "transparent" }}
      >
        <path
          d={d}
          fill="none"
          stroke="transparent"
          strokeWidth={hitPx}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ pointerEvents: "stroke" }}
          onPointerDown={onBarPointerDown}
        />
        <path
          d={d}
          fill="none"
          stroke="#111"
          strokeWidth={4}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          data-floor-bar-stroke="1"
          style={{ pointerEvents: "none" }}
        />
      </svg>
    );
  }
  if (table.kind === "host_stand") {
    return (
      <div
        data-floor-host="stand"
        data-floor-rotation={rotation}
        data-floor-spin=""
        data-floor-arch-tone={live ? "dark" : "editor"}
        className={cn("relative h-full w-full", className)}
        style={spin}
        onPointerDown={onShapePointerDown}
      >
        <div className="flex h-full w-full items-center justify-center rounded-md bg-[#6b4a2a] text-[10px] font-bold text-[#f4efe6]">
          Host
        </div>
        {children}
      </div>
    );
  }
  const tone = live
    ? "bg-[#3d2914]"
    : table.kind === "window"
      ? "bg-[#c9d7e0]"
      : table.kind === "door"
        ? "bg-[#efe6d8]"
        : "bg-[#3d2914]";
  const doorEdge = table.kind === "door" ? (live ? "border-2 border-[#1a120c]" : "border-2 border-[#3d2914]") : "";
  const grow = table.kind === "wall" ? (extend?.start ?? 0) + (extend?.end ?? 0) : 0;
  const fillStyle =
    grow > 0 && table.w > 0
      ? {
          left: `${((-(extend?.start ?? 0)) / table.w) * 100}%`,
          width: `${((table.w + grow) / table.w) * 100}%`,
        }
      : undefined;
  return (
    <div
      data-floor-arch={table.kind}
      data-floor-rotation={rotation}
      data-floor-spin=""
      data-floor-arch-tone={live ? "dark" : "editor"}
      className={cn("relative h-full w-full", className)}
      style={spin}
      onPointerDown={onShapePointerDown}
    >
      <div
        data-floor-wall-join={table.kind === "wall" && grow > 0 ? "1" : undefined}
        className={cn("rounded-sm", tone, doorEdge, fillStyle ? "absolute top-0 h-full" : "h-full w-full")}
        style={fillStyle}
      />
      {caption ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-[9px] font-medium leading-none text-[#f4efe6]"
          style={{ transform: `rotate(${-rotation}deg)` }}
        >
          {caption}
        </span>
      ) : null}
      {children}
    </div>
  );
}
