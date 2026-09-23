import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Table } from "@/lib/pos/types";
import { floorMapNumber } from "@/lib/pos/floor-fit";
import { DEFAULT_ROOM, ROOM_FIT_MARGIN_PX, fitRoomToView, fixturePixelBox } from "@/lib/pos/floor-dimensions";
import { usePosStore } from "@/lib/pos/store";
import { FloorFixtureArt } from "@/components/pos/FloorFixtureArt";
import { FloorArchitectureMark } from "@/components/pos/FloorArchitectureMark";
import { isArchitectureKind, wallEndExtensions } from "@/lib/pos/floor-architecture";
import { cn } from "@/lib/utils";

function isBarSeat(table: Table): boolean {
  return table.kind === "barstool" || table.shape === "bar";
}

/** One BAR rail behind the numbered seat pills. Seats stay labels, not chair art. */
function barSlab(
  items: FloorMapItem[],
  room: { widthIn: number; depthIn: number },
  pxPerIn: number,
) {
  const seats = items.filter((i) => isBarSeat(i.table));
  if (!seats.length) return null;
  const boxes = seats.map((i) => fixturePixelBox(i.table, room, pxPerIn));
  const left = Math.min(...boxes.map((b) => b.left)) - 12;
  const top = Math.min(...boxes.map((b) => b.top)) - 28;
  const right = Math.max(...boxes.map((b) => b.left + b.width)) + 12;
  const bottom = Math.max(...boxes.map((b) => b.top + b.height)) + 14;
  const width = Math.max(72, right - left);
  const depth = Math.max(12, pxPerIn * 24);
  const midY = (top + bottom) / 2;
  return (
    <svg
      className="pointer-events-none absolute z-[1] overflow-visible"
      data-floor-bar="slab"
      data-floor-bar-stroke="1"
      data-floor-bar-depth={24}
      style={{ left, top: midY - depth / 2, width, height: depth }}
    >
      <rect
        x={1}
        y={1}
        width={Math.max(1, width - 2)}
        height={Math.max(1, depth - 2)}
        fill="transparent"
        stroke="#111"
        strokeWidth={2}
      />
    </svg>
  );
}

export type FloorMapItem = {
  table: Table;
  fill: string;
  ink: string;
  /** Empty tables draw a dark ring and a clear center. */
  hollow?: boolean;
  flashing: boolean;
  dim: boolean;
  /** Joined table numbers, drawn smaller on the same fill. */
  joined?: string[];
};

/**
 * Order / host floor. Status-colored shapes, table number only.
 * The plan is scaled to the canvas (64px minimum). Pinch and drag to pan.
 */
export function FloorMapCanvas({
  items,
  onTableClick,
  onCombine,
}: {
  items: FloorMapItem[];
  onTableClick: (table: Table) => void;
  /** Drag table A onto table B. A joins B. */
  onCombine?: (draggedId: string, ontoId: string) => void;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 800, h: 600 });
  const [cam, setCam] = useState({ s: 1, x: 0, y: 0 });
  const camRef = useRef(cam);
  camRef.current = cam;
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const dragRef = useRef<{
    x: number;
    y: number;
    ox: number;
    oy: number;
    moved: boolean;
  } | null>(null);
  const suppress = useRef(false);
  const downOn = useRef<string | null>(null);
  const tableDrag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setView({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const room = usePosStore((s) => s.floorRoom) ?? DEFAULT_ROOM;
  const fit = useMemo(
    () =>
      fitRoomToView({
        room,
        viewW: view.w,
        viewH: view.h,
        marginPx: ROOM_FIT_MARGIN_PX,
      }),
    [room, view.w, view.h],
  );

  useEffect(() => {
    setCam({ s: 1, x: fit.originX, y: fit.originY });
  }, [fit.originX, fit.originY, fit.pxPerIn]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    suppress.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    const hit = (e.target as HTMLElement | null)?.closest?.("[data-table-id]");
    downOn.current = hit?.getAttribute("data-table-id") ?? null;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size >= 2) {
      const [a, b] = [...pts.current.values()];
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)),
        scale: camRef.current.s,
      };
      dragRef.current = null;
      return;
    }
    dragRef.current = {
      x: e.clientX,
      y: e.clientY,
      ox: camRef.current.x,
      oy: camRef.current.y,
      moved: false,
    };
    tableDrag.current = downOn.current
      ? { id: downOn.current, x: e.clientX, y: e.clientY, moved: false }
      : null;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pts.current.values()];
      const dist = Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y));
      const next = Math.min(4, Math.max(0.5, pinchRef.current.scale * (dist / pinchRef.current.dist)));
      setCam((c) => ({ ...c, s: next }));
      suppress.current = true;
      return;
    }
    const td = tableDrag.current;
    if (td) {
      if (Math.hypot(e.clientX - td.x, e.clientY - td.y) > 12) td.moved = true;
      if (td.moved) {
        suppress.current = true;
        return;
      }
    }
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.hypot(dx, dy) > 10) d.moved = true;
    if (!d.moved) return;
    suppress.current = true;
    setCam((c) => ({ ...c, x: d.ox + dx, y: d.oy + dy }));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pts.current.delete(e.pointerId);
    if (pts.current.size < 2) pinchRef.current = null;
    const tapped = downOn.current;
    const dragged = tableDrag.current;
    tableDrag.current = null;
    const moved = dragRef.current?.moved || dragged?.moved || suppress.current;
    dragRef.current = null;
    downOn.current = null;
    if (dragged?.moved && onCombine) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const dest = (el as HTMLElement | null)?.closest?.("[data-table-id]")?.getAttribute("data-table-id");
      if (dest && dest !== dragged.id) onCombine(dragged.id, dest);
      suppress.current = true;
      return;
    }
    if (tapped && !moved && pts.current.size === 0) {
      const item = items.find((i) => i.table.id === tapped);
      if (item) onTableClick(item.table);
      suppress.current = true;
      return;
    }
  };

  return (
    <div
      ref={viewRef}
      className="relative min-h-0 flex-1 overflow-hidden bg-white"
      data-floor-map="status"
      data-floor-canvas="white"
      data-floor-chairs="0"
      data-floor-table-count={items.length}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: fit.worldW,
          height: fit.worldH,
          transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`,
          transformOrigin: "0 0",
        }}
      >
        {items.some((i) => i.table.kind === "bar_top") ? null : barSlab(items, room, fit.pxPerIn)}
        {items.map((item) => {
          const arch = isArchitectureKind(item.table.kind);
          const bar = !arch && (item.table.kind === "barstool" || item.table.shape === "bar");
          const box = fixturePixelBox(item.table, room, fit.pxPerIn);
          const num = floorMapNumber(item.table.label);
          const fill = item.fill && item.fill !== "transparent" ? item.fill : "#f4efe6";
          return (
            <button
              key={item.table.id}
              type="button"
              data-table-id={item.table.id}
              data-floor-label={num}
              data-floor-seat={bar ? "pill" : "table"}
              aria-label={bar ? `Seat ${num}` : `Table ${num}`}
              onClick={() => {
                if (suppress.current) {
                  suppress.current = false;
                  return;
                }
                onTableClick(item.table);
              }}
              data-floor-rotation={((Number(item.table.rotation) || 0) % 360 + 360) % 360}
              data-floor-bar-hit={item.table.kind === "bar_top" ? "path" : undefined}
              style={{
                left: bar ? box.left + box.width / 2 - 22 : box.left,
                top: bar ? box.top + box.height / 2 - 16 : box.top,
                width: bar ? 44 : box.width,
                height: bar ? 32 : box.height,
                color: bar ? "#1a120c" : item.ink,
                background: bar ? "#f4efe6" : undefined,
                containerType: "size",
                transform: bar ? `rotate(${(Number(item.table.rotation) || 0) % 360}deg)` : undefined,
                transformOrigin: "center center",
              }}
              className={cn(
                "absolute border-0 p-0",
                item.table.kind === "bar_top" && "pointer-events-none",
                bar
                  ? "z-[2] flex items-center justify-center rounded-full border border-[#1a120c]/15 text-sm font-bold tabular shadow-sm"
                  : "bg-transparent",
                item.flashing && "table-sla-flash-thin",
                item.dim && "ring-2 ring-black/30",
              )}
            >
              {arch ? (
                <FloorArchitectureMark
                  table={item.table}
                  variant="live"
                  room={room}
                  pxPerIn={fit.pxPerIn}
                  extend={
                    item.table.kind === "wall"
                      ? wallEndExtensions(
                          item.table,
                          items
                            .map((i) => i.table)
                            .filter((w) => w.kind === "wall" && w.id !== item.table.id),
                        )
                      : undefined
                  }
                />
              ) : bar ? (
                <span className="pointer-events-none">{num}</span>
              ) : (
                <FloorFixtureArt
                  table={{ ...item.table, kind: item.table.kind === "barstool" ? "table" : item.table.kind, shape: item.table.shape === "bar" ? "rect" : item.table.shape }}
                  tableFill={fill}
                  outline={fill}
                  label={num}
                  joined={item.joined}
                  rotation={item.table.rotation ?? 0}
                  mode="status"
                  hollow={item.hollow}
                  ink={item.ink}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
