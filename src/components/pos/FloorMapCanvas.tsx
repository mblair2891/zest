import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Table } from "@/lib/pos/types";
import { floorFit, floorMapNumber, planPixelBox, tablePixelBox } from "@/lib/pos/floor-fit";
import { FloorFixtureArt } from "@/components/pos/FloorFixtureArt";
import { FloorArchitectureMark } from "@/components/pos/FloorArchitectureMark";
import { isArchitectureKind } from "@/lib/pos/floor-architecture";
import { cn } from "@/lib/utils";

function isBarSeat(table: Table): boolean {
  return table.kind === "barstool" || table.shape === "bar";
}

/** One BAR rail behind the numbered seat pills. Seats stay labels, not chair art. */
function barSlab(items: FloorMapItem[], pxPerPct: number) {
  const seats = items.filter((i) => isBarSeat(i.table));
  if (!seats.length) return null;
  const boxes = seats.map((i) => tablePixelBox(i.table, pxPerPct, 40));
  const left = Math.min(...boxes.map((b) => b.left)) - 12;
  const top = Math.min(...boxes.map((b) => b.top)) - 28;
  const right = Math.max(...boxes.map((b) => b.left + b.width)) + 12;
  const bottom = Math.max(...boxes.map((b) => b.top + b.height)) + 14;
  return (
    <div
      className="pointer-events-none absolute z-[1] flex items-start rounded-2xl bg-[#3d2914] px-3 pt-1 text-sm font-bold tracking-wide text-[#f4efe6]"
      data-floor-bar="slab"
      style={{ left, top, width: Math.max(72, right - left), height: Math.max(56, bottom - top) }}
    >
      BAR
    </div>
  );
}

export type FloorMapItem = {
  table: Table;
  fill: string;
  ink: string;
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

  const fit = useMemo(
    () =>
      floorFit({
        tables: items.map((i) => i.table),
        tapRects: items.filter((i) => !isArchitectureKind(i.table.kind)).map((i) => i.table),
        viewW: view.w,
        viewH: view.h,
        minTapPx: 64,
      }),
    [items, view.w, view.h],
  );

  useEffect(() => {
    setCam({ s: 1, x: fit.originX, y: fit.originY });
  }, [fit.originX, fit.originY, fit.pxPerPct]);

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
      className="floor-wood relative min-h-0 flex-1 overflow-hidden"
      data-floor-map="status"
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
        {items.some((i) => i.table.kind === "bar_top") ? null : barSlab(items, fit.pxPerPct)}
        {items.map((item) => {
          const arch = isArchitectureKind(item.table.kind);
          const bar = !arch && (item.table.kind === "barstool" || item.table.shape === "bar");
          const box = arch
            ? planPixelBox(item.table, fit.pxPerPct)
            : tablePixelBox(item.table, fit.pxPerPct, bar ? 40 : 72);
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
                color: item.ink,
                background: bar ? fill : undefined,
                containerType: "size",
                transform: bar ? `rotate(${(Number(item.table.rotation) || 0) % 360}deg)` : undefined,
                transformOrigin: "center center",
              }}
              className={cn(
                "absolute border-0 p-0",
                item.table.kind === "bar_top" && "pointer-events-none",
                bar
                  ? "z-[2] flex items-center justify-center rounded-full text-sm font-bold tabular shadow-sm"
                  : "bg-transparent",
                item.flashing && "table-sla-flash-thin",
                item.dim && "ring-2 ring-black/30",
              )}
            >
              {arch ? (
                <FloorArchitectureMark table={item.table} variant="live" />
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
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
