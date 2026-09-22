import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BoothKind } from "@/lib/pos/floor-booth";
import { seatingScale } from "@/lib/pos/floor-seating";

const BENCH = "#4a3a34";
const BENCH_STITCH = "#5c4a43";

export function FloorBoothMark({
  kind,
  tableFill,
  benchFill = BENCH,
  outline,
  rotation = 0,
  label,
  sectionColor,
  className,
  children,
  w = 18,
  h = 18,
  seats = 4,
  solid = false,
}: {
  kind: BoothKind;
  tableFill: string;
  benchFill?: string;
  outline: string;
  rotation?: number;
  label?: string;
  sectionColor?: string;
  className?: string;
  children?: ReactNode;
  w?: number;
  h?: number;
  seats?: number;
  /** Status block: booth silhouette in the status fill. No bench stitches or seat marks. */
  solid?: boolean;
}) {
  const scale = seatingScale({ w, h, seats });
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
        {kind === "booth_4" ? (
          <Booth4Paths
            tableFill={tableFill}
            benchFill={solid ? tableFill : benchFill}
            outline={outline}
            benchVy={scale.benchVy}
            solid={solid}
          />
        ) : kind === "booth_u" ? (
          <BoothUPaths
            tableFill={tableFill}
            benchFill={solid ? tableFill : benchFill}
            outline={outline}
            benchVx={scale.benchVx}
            benchVy={scale.benchVy}
            solid={solid}
          />
        ) : (
          <BoothLPaths
            tableFill={tableFill}
            benchFill={solid ? tableFill : benchFill}
            outline={outline}
            benchVx={scale.benchVx}
            benchVy={scale.benchVy}
            solid={solid}
          />
        )}
        {sectionColor && !solid ? (
          <rect x="38" y="2" width="24" height="4" rx="1.5" fill={sectionColor} />
        ) : null}
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

export function FloorBoothIcon({ kind, className }: { kind: BoothKind; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn("h-4 w-4 shrink-0", className)} aria-hidden>
      {kind === "booth_4" ? (
        <Booth4Paths tableFill="#efe6d8" benchFill={BENCH} outline="#8a7368" benchVy={20} />
      ) : kind === "booth_u" ? (
        <BoothUPaths
          tableFill="#efe6d8"
          benchFill={BENCH}
          outline="#8a7368"
          benchVx={22}
          benchVy={22}
        />
      ) : (
        <BoothLPaths
          tableFill="#efe6d8"
          benchFill={BENCH}
          outline="#8a7368"
          benchVx={22}
          benchVy={22}
        />
      )}
    </svg>
  );
}

function Booth4Paths({
  tableFill,
  benchFill,
  outline,
  benchVy,
  solid = false,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
  benchVy: number;
  solid?: boolean;
}) {
  const by = Math.min(28, Math.max(14, benchVy));
  const tableTop = by + 6;
  const tableH = Math.max(20, 100 - tableTop * 2);
  return (
    <>
      {solid ? null : (
        <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      )}
      <rect x="8" y="5" width="84" height={by} rx="7" fill={benchFill} />
      {solid ? null : (
        <rect x="12" y="9" width="76" height="2" rx="1" fill={BENCH_STITCH} opacity="0.45" />
      )}
      <rect x="20" y={tableTop} width="60" height={tableH} rx="5" fill={tableFill} />
      <rect x="8" y={100 - 5 - by} width="84" height={by} rx="7" fill={benchFill} />
      {solid ? null : (
        <rect
          x="12"
          y={100 - 9}
          width="76"
          height="2"
          rx="1"
          fill={BENCH_STITCH}
          opacity="0.45"
        />
      )}
    </>
  );
}

function BoothUPaths({
  tableFill,
  benchFill,
  outline,
  benchVx,
  benchVy,
  solid = false,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
  benchVx: number;
  benchVy: number;
  solid?: boolean;
}) {
  const bx = Math.min(30, Math.max(16, benchVx));
  const by = Math.min(30, Math.max(16, benchVy));
  const innerL = bx;
  const innerR = 100 - bx;
  const innerB = 100 - by;
  const tableX = innerL + 6;
  const tableW = Math.max(18, innerR - innerL - 12);
  const tableH = Math.max(22, innerB - 18);
  return (
    <>
      {solid ? null : (
        <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      )}
      <path
        d={`M${bx * 0.45} 6 V${innerB} Q${bx * 0.45} ${innerB + by * 0.35} ${bx} ${innerB + by * 0.35} H${100 - bx} Q${100 - bx * 0.45} ${innerB + by * 0.35} ${100 - bx * 0.45} ${innerB} V6 H${innerR} V${innerB - 4} H${innerL} V6 Z`}
        fill={benchFill}
      />
      <rect x={tableX} y="12" width={tableW} height={tableH} rx="5" fill={tableFill} />
    </>
  );
}

function BoothLPaths({
  tableFill,
  benchFill,
  outline,
  benchVx,
  benchVy,
  solid = false,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
  benchVx: number;
  benchVy: number;
  solid?: boolean;
}) {
  const bx = Math.min(30, Math.max(16, benchVx));
  const by = Math.min(30, Math.max(16, benchVy));
  const tableX = bx + 6;
  const tableY = 12;
  const tableW = Math.max(20, 100 - tableX - 8);
  const tableH = Math.max(22, 100 - by - tableY - 8);
  return (
    <>
      {solid ? null : (
        <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      )}
      <path
        d={`M${bx * 0.45} 6 V${100 - by * 0.4} Q${bx * 0.45} ${100 - 4} ${bx} ${100 - 4} H${100 - 6} V${100 - by} H${bx} V6 Z`}
        fill={benchFill}
      />
      <rect x={tableX} y={tableY} width={tableW} height={tableH} rx="5" fill={tableFill} />
    </>
  );
}
