import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { Table } from "@/lib/pos/types";
import { cn } from "@/lib/utils";
import {
  barClosedShape,
  barDepthIn,
  barFaceLabel,
  barLabelPose,
  uprightCounterDeg,
  barSlabEdges,
  doorSwingHeightPct,
  doorSwingSign,
  isArchitectureKind,
  liveArchCaption,
  storedBarPlan,
  type RoomInches,
} from "@/lib/pos/floor-architecture";
import { DEFAULT_ROOM } from "@/lib/pos/floor-dimensions";
import { spansAlong } from "@/lib/pos/floor-room";

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
  gaps,
  pxPerIn: _pxPerIn = 2,
  room = DEFAULT_ROOM,
  spinDeg = 0,
}: {
  table: Table;
  selected?: boolean;
  className?: string;
  /** Live and the editor share the same wall, door, and window paint. */
  variant?: "editor" | "live";
  onBarPointerDown?: (event: ReactPointerEvent<SVGPathElement>) => void;
  onShapePointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children?: ReactNode;
  /** Length units skipped where a door or window cuts this wall. */
  gaps?: { start: number; end: number }[];
  /** Plan units to draw past each centerline end when this wall shares a corner. */
  extend?: { start: number; end: number };
  /** Kept so callers can pass the room scale. The slab uses inches, not a hairline stroke. */
  pxPerIn?: number;
  room?: RoomInches;
  /** Spin already applied by a parent. The editor rotates the bar outside this mark. */
  spinDeg?: number;
}) {
  if (!isArchitectureKind(table.kind)) return null;
  const rotation = ((Number(table.rotation) || 0) % 360 + 360) % 360;
  const spin = { transform: `rotate(${rotation}deg)`, transformOrigin: "center center" } as const;
  const live = variant === "live";
  const caption = live ? liveArchCaption(table) : null;
  const openingAttr = table.openingOf || undefined;
  const gapList = (gaps ?? []).filter((gap) => gap.end > gap.start + 0.02);
  if (table.kind === "bar_top") {
    const plan = storedBarPlan(table);
    const depth = barDepthIn(table.widthIn);
    const closed = barClosedShape(table.barShape, plan);
    const { outer, inner } = barSlabEdges(plan, depth, room, closed);
    const loc = (p: { x: number; y: number }) => `${p.x - table.x} ${p.y - table.y}`;
    const chain = (pts: { x: number; y: number }[]) =>
      pts.map((p, i) => `${i === 0 ? "M" : "L"} ${loc(p)}`).join(" ");
    const d = closed
      ? `${chain(outer)} Z ${chain(inner)} Z`
      : `${chain(outer)} ${[...inner].reverse().map((p, i) => `${i === 0 ? "L" : "L"} ${loc(p)}`).join(" ")} Z`;
    const visual = ((rotation + spinDeg) % 360 + 360) % 360;
    const pose = barLabelPose(plan, room, table, depth, visual);
    const face = barFaceLabel(table.label);
    const glyph = pose ? uprightCounterDeg(pose.legDeg + visual) : 0;
    return (
      <div
        className="relative h-full w-full overflow-visible bg-transparent"
        data-floor-bar="slab"
        data-floor-bar-shape={table.barShape ?? "straight"}
        data-floor-bar-depth={depth}
        data-floor-rotation={visual}
        data-bar-legs={(table.legLengths ?? []).join(",")}
        data-floor-bar-selected={selected ? "1" : "0"}
        data-floor-arch-tone="outline"
        style={{ ...spin, pointerEvents: "none", background: "transparent" }}
      >
        <svg
          viewBox={`0 0 ${Math.max(table.w, 0.4)} ${Math.max(table.h, 0.4)}`}
          preserveAspectRatio="none"
          className="h-full w-full overflow-visible bg-transparent"
        >
          <path
            d={d}
            fill="transparent"
            fillRule={closed ? "evenodd" : "nonzero"}
            stroke="#111"
            strokeWidth={1.5}
            strokeLinejoin="miter"
            vectorEffect="non-scaling-stroke"
            data-floor-bar-fill="none"
            data-floor-bar-stroke="1"
            style={{ pointerEvents: "fill" }}
            onPointerDown={onBarPointerDown}
          />
        </svg>
        {pose ? (
          <div
            data-floor-bar-label={face}
            data-floor-label-upright="1"
            data-floor-bar-leg={pose.leg}
            data-floor-bar-stack={pose.stack ? "1" : "0"}
            className="pointer-events-none absolute flex items-center justify-center overflow-hidden"
            style={{
              left: `calc(${pose.leftPct}% - ${pose.alongPct / 2}%)`,
              top: `calc(${pose.topPct}% - ${pose.thickPct / 2}%)`,
              width: `${pose.alongPct}%`,
              height: `${pose.thickPct}%`,
              transform: `rotate(${pose.legDeg}deg)`,
              transformOrigin: "center center",
              containerType: "size",
            }}
          >
            <div className="flex h-full w-full items-center justify-center">
              {pose.stack ? (
                <span className="flex items-center justify-center">
                  {face.split("").map((ch, i) => (
                    <span
                      key={`${ch}-${i}`}
                      style={{
                        display: "inline-block",
                        transform: `rotate(${glyph}deg)`,
                        fontSize: "62cqh",
                        fontWeight: 500,
                        color: "#111",
                        lineHeight: 1,
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </span>
              ) : (
                <span
                  style={{
                    transform: `rotate(${glyph}deg)`,
                    fontSize: "58cqh",
                    fontWeight: 500,
                    color: "#111",
                    letterSpacing: "0.06em",
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {face}
                </span>
              )}
            </div>
          </div>
        ) : null}
      </div>
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
  if (table.kind === "door") {
    const swingH = doorSwingHeightPct(table, room);
    const swingSign = doorSwingSign(rotation, table.x + table.w / 2, table.y + table.h / 2);
    return (
      <div
        data-floor-arch="door"
        data-floor-door="gap"
        data-floor-rotation={rotation}
        data-floor-spin=""
        data-floor-arch-tone="editor"
        data-floor-opening={openingAttr}
        className={cn("relative h-full w-full overflow-visible bg-transparent", className)}
        style={spin}
        onPointerDown={onShapePointerDown}
      >
        <svg
          data-floor-door-swing=""
          data-floor-door-swing-sign={swingSign}
          viewBox="0 0 100 100"
          preserveAspectRatio="xMinYMin meet"
          className="pointer-events-none absolute left-0 overflow-visible"
          style={{
            top: "50%",
            width: "100%",
            height: `${swingH}%`,
            transform: swingSign < 0 ? "scaleY(-1)" : undefined,
            transformOrigin: "top left",
          }}
        >
          <path
            d="M 0 0 L 0 100 M 100 0 A 100 100 0 0 1 0 100"
            fill="none"
            stroke="#3d2914"
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {caption ? (
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-[9px] font-medium leading-none text-[#3d2914]"
            style={{ transform: `rotate(${-rotation}deg)` }}
          >
            {caption}
          </span>
        ) : null}
        {children}
      </div>
    );
  }
  const tone = table.kind === "window" ? "bg-[#c9d7e0]" : "bg-[#3d2914]";
  const grow = table.kind === "wall" ? (extend?.start ?? 0) + (extend?.end ?? 0) : 0;
  const fillStyle =
    grow > 0 && table.w > 0
      ? {
          left: `${((-(extend?.start ?? 0)) / table.w) * 100}%`,
          width: `${((table.w + grow) / table.w) * 100}%`,
        }
      : undefined;
  const editorSpans =
    table.kind === "wall" && gapList.length && table.w > 0
      ? spansAlong(-(extend?.start ?? 0), table.w + (extend?.end ?? 0), gapList)
      : null;
  return (
    <div
      data-floor-arch={table.kind}
      data-floor-rotation={rotation}
      data-floor-spin=""
      data-floor-arch-tone="editor"
      data-floor-opening={openingAttr}
      className={cn("relative h-full w-full overflow-visible", className)}
      style={spin}
      onPointerDown={onShapePointerDown}
    >
      {editorSpans ? (
        editorSpans.map((span, index) => (
          <div
            key={`${span.start}-${index}`}
            data-floor-wall="outline"
            data-floor-wall-join={grow > 0 ? "1" : undefined}
            className={cn("absolute top-0 h-full rounded-sm", tone)}
            style={{
              left: `${(span.start / table.w) * 100}%`,
              width: `${((span.end - span.start) / table.w) * 100}%`,
            }}
          />
        ))
      ) : table.kind === "window" ? (
        <div
          data-floor-window="pane"
          className={cn("h-full w-full rounded-sm", tone)}
        />
      ) : (
        <div
          data-floor-wall="outline"
          data-floor-wall-join={grow > 0 ? "1" : undefined}
          className={cn("rounded-sm", tone, fillStyle ? "absolute top-0 h-full" : "h-full w-full")}
          style={fillStyle}
        />
      )}
      {caption ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-[9px] font-medium leading-none",
            table.kind === "window" ? "text-[#3d2914]" : "text-[#f4efe6]",
          )}
          style={{ transform: `rotate(${-rotation}deg)` }}
        >
          {caption}
        </span>
      ) : null}
      {children}
    </div>
  );
}
