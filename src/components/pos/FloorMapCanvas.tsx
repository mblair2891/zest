import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Table } from "@/lib/pos/types";
import { floorFit, floorMapNumber, tablePixelBox } from "@/lib/pos/floor-fit";
import { FloorFixtureArt } from "@/components/pos/FloorFixtureArt";
import { cn } from "@/lib/utils";

export type FloorMapItem = {
  table: Table;
  fill: string;
  ink: string;
  flashing: boolean;
  dim: boolean;
};

/**
 * Order / host floor. Status-colored shapes, table number only.
 * The plan is scaled to the canvas (64px minimum). Pinch and drag to pan.
 */
export function FloorMapCanvas({
  items,
  onTableClick,
}: {
  items: FloorMapItem[];
  onTableClick: (table: Table) => void;
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
    const moved = dragRef.current?.moved || suppress.current;
    dragRef.current = null;
    downOn.current = null;
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
      className="relative min-h-0 flex-1 overflow-hidden bg-bg"
      data-floor-map="status"
      data-floor-chairs="0"
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
        {items.map((item) => {
          const box = tablePixelBox(item.table, fit.pxPerPct, 64);
          const num = floorMapNumber(item.table.label);
          return (
            <button
              key={item.table.id}
              type="button"
              data-table-id={item.table.id}
              data-floor-label={num}
              aria-label={`Table ${num}`}
              onClick={() => {
                if (suppress.current) {
                  suppress.current = false;
                  return;
                }
                onTableClick(item.table);
              }}
              style={{
                left: box.left,
                top: box.top,
                width: box.width,
                height: box.height,
                color: item.ink,
                containerType: "size",
              }}
              className={cn(
                "absolute border-0 bg-transparent p-0",
                item.flashing && "table-sla-flash-thin",
                item.dim && "opacity-55",
              )}
            >
              <FloorFixtureArt
                table={item.table}
                tableFill={item.fill}
                outline={item.fill}
                label={num}
                rotation={item.table.rotation ?? 0}
                mode="status"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
