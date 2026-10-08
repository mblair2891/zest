import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

const UPHOLSTERY = "#6b5344";
const SEAT = "#d9cfc3";

/** Low sofa: short back, arms at the ends, one seat. No seat dots. */
export function FloorCouchGlyph({
  fill,
  outline,
  hollow = false,
  solid = false,
}: {
  fill: string;
  outline: string;
  hollow?: boolean;
  solid?: boolean;
}) {
  const upholstery = solid || hollow ? fill : UPHOLSTERY;
  const seat = solid || hollow ? fill : SEAT;
  const hair = hollow
    ? {
        fill: "none" as const,
        stroke: outline,
        strokeWidth: 1.25,
        vectorEffect: "non-scaling-stroke" as const,
      }
    : null;
  const body = hair ?? {
    fill: upholstery,
    stroke: solid ? "none" : outline,
    strokeWidth: solid ? 0 : 2.5,
  };
  const cushion = hair ?? {
    fill: seat,
    stroke: solid ? "none" : outline,
    strokeWidth: solid ? 0 : 1.5,
  };
  return (
    <g data-floor-couch="">
      <rect x="8" y="28" width="84" height="16" rx="6" {...body} />
      <rect x="6" y="36" width="14" height="48" rx="6" {...body} />
      <rect x="80" y="36" width="14" height="48" rx="6" {...body} />
      <rect x="18" y="42" width="64" height="40" rx="5" {...cushion} />
    </g>
  );
}

export function FloorCouchMark({
  tableFill,
  outline,
  rotation = 0,
  label,
  sectionColor,
  className,
  children,
  onPointerDown,
}: {
  tableFill: string;
  outline: string;
  rotation?: number;
  label?: string;
  sectionColor?: string;
  className?: string;
  children?: ReactNode;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      data-floor-spin=""
      data-floor-nubs="0"
      data-floor-couch=""
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onPointerDown={onPointerDown}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
        <FloorCouchGlyph fill={tableFill} outline={outline} />
        {sectionColor ? <rect x="38" y="2" width="24" height="4" rx="1.5" fill={sectionColor} /> : null}
      </svg>
      {label ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-center text-[11px] font-semibold tabular leading-none"
          style={{ transform: `rotate(${-rotation}deg)` }}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export function FloorCouchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={cn("h-4 w-4 shrink-0", className)}
      aria-hidden
      data-floor-couch-icon=""
    >
      <FloorCouchGlyph fill="#efe6d8" outline="#6b5344" />
    </svg>
  );
}
