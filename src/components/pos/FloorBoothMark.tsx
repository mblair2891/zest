import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { boothTableBox, type BoothKind } from "@/lib/pos/floor-booth";
import { seatingScale } from "@/lib/pos/floor-seating";

const BENCH = "#4a3a34";
const BENCH_STITCH = "#5c4a43";

/**
 * Booth number. Same type size as a table number, in the open center.
 * Editor uses the table's 11px. Live uses 50cqmin of this opening, not of the whole booth.
 */
export function BoothNumber({
  kind,
  w = 18,
  h = 18,
  rotation = 0,
  label,
  joined,
  ink,
  surface = "editor",
}: {
  kind: BoothKind;
  w?: number;
  h?: number;
  rotation?: number;
  label: string;
  joined?: string[];
  ink?: string;
  surface?: "editor" | "live";
}) {
  const box = boothTableBox(kind, seatingScale({ w, h, seats: 4 }));
  const live = surface === "live";
  return (
    <span
      data-floor-booth-label=""
      data-floor-label-place="open"
      className="pointer-events-none absolute flex flex-col items-center justify-center overflow-hidden text-center leading-none"
      style={{
        left: `${box.x}%`,
        top: `${box.y}%`,
        width: `${box.w}%`,
        height: `${box.h}%`,
        transform: `rotate(${-rotation}deg)`,
        containerType: live ? "size" : undefined,
        color: ink,
      }}
    >
      <span
        data-floor-primary
        data-floor-weight={live ? "medium" : undefined}
        className={live ? "font-medium tabular leading-none" : "text-[11px] font-semibold tabular leading-none"}
        style={
          live
            ? { fontSize: joined?.length ? "42cqmin" : "50cqmin", fontWeight: 500, whiteSpace: "nowrap" }
            : { whiteSpace: "nowrap" }
        }
      >
        {label}
      </span>
      {live && joined && joined.length > 0 ? (
        <span data-floor-joined className="font-medium leading-tight" style={{ fontSize: "18cqmin", fontWeight: 500 }}>
          {joined.join(" · ")}
        </span>
      ) : null}
    </span>
  );
}

export function FloorBoothGlyph({
  kind,
  tableFill,
  benchFill = BENCH,
  outline,
  w = 18,
  h = 18,
  solid = false,
  hollow = false,
}: {
  kind: BoothKind;
  tableFill: string;
  benchFill?: string;
  outline: string;
  w?: number;
  h?: number;
  /** Status block: booth silhouette in the status fill. No bench stitches or seat marks. */
  solid?: boolean;
  /** Empty live table: the booth shape as a hairline, with no fill. */
  hollow?: boolean;
}) {
  const scale = seatingScale({ w, h, seats: 4 });
  return (
    <>
      {kind === "booth_4" ? (
        <Booth4Paths
          tableFill={tableFill}
          benchFill={solid ? tableFill : benchFill}
          outline={outline}
          benchVy={scale.benchVy}
          solid={solid}
          hollow={hollow}
        />
      ) : kind === "booth_u" ? (
        <BoothUPaths
          tableFill={tableFill}
          benchFill={solid ? tableFill : benchFill}
          outline={outline}
          benchVx={scale.benchVx}
          benchVy={scale.benchVy}
          solid={solid}
          hollow={hollow}
        />
      ) : (
        <BoothLPaths
          tableFill={tableFill}
          benchFill={solid ? tableFill : benchFill}
          outline={outline}
          benchVx={scale.benchVx}
          benchVy={scale.benchVy}
          solid={solid}
          hollow={hollow}
        />
      )}
    </>
  );
}

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
  seats: _seats = 4,
  solid = false,
  onPointerDown,
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
  /** Seat count stays on the table. The booth drawing does not use it. */
  seats?: number;
  /** Status block: booth silhouette in the status fill. No bench stitches or seat marks. */
  solid?: boolean;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      data-floor-spin=""
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onPointerDown={onPointerDown}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
        <FloorBoothGlyph
          kind={kind}
          tableFill={tableFill}
          benchFill={benchFill}
          outline={outline}
          w={w}
          h={h}
          solid={solid}
        />
        {sectionColor && !solid ? (
          <rect x="38" y="2" width="24" height="4" rx="1.5" fill={sectionColor} />
        ) : null}
      </svg>
      {label ? (
        <BoothNumber kind={kind} w={w} h={h} rotation={rotation} label={label} surface="editor" />
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
  hollow = false,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
  benchVy: number;
  solid?: boolean;
  hollow?: boolean;
}) {
  const by = Math.min(28, Math.max(14, benchVy));
  const table = boothTableBox("booth_4", { benchVx: 0, benchVy });
  const hair = hollow
    ? { fill: "none" as const, stroke: outline, strokeWidth: 1.25, vectorEffect: "non-scaling-stroke" as const }
    : null;
  if (hair) {
    return (
      <>
        <rect x="8" y="5" width="84" height={by} rx="7" {...hair} />
        <rect x={table.x} y={table.y} width={table.w} height={table.h} rx="5" {...hair} />
        <rect x="8" y={100 - 5 - by} width="84" height={by} rx="7" {...hair} />
      </>
    );
  }
  return (
    <>
      {solid ? null : (
        <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      )}
      <rect x="8" y="5" width="84" height={by} rx="7" fill={benchFill} />
      {solid ? null : (
        <rect x="12" y="9" width="76" height="2" rx="1" fill={BENCH_STITCH} opacity="0.45" />
      )}
      <rect x={table.x} y={table.y} width={table.w} height={table.h} rx="5" fill={tableFill} />
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
  hollow = false,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
  benchVx: number;
  benchVy: number;
  solid?: boolean;
  hollow?: boolean;
}) {
  const bx = Math.min(30, Math.max(16, benchVx));
  const by = Math.min(30, Math.max(16, benchVy));
  const innerL = bx;
  const innerR = 100 - bx;
  const innerB = 100 - by;
  const table = boothTableBox("booth_u", { benchVx, benchVy });
  const hair = hollow
    ? { fill: "none" as const, stroke: outline, strokeWidth: 1.25, vectorEffect: "non-scaling-stroke" as const }
    : null;
  if (hair) {
    return (
      <>
        <path
          d={`M${bx * 0.45} 6 V${innerB} Q${bx * 0.45} ${innerB + by * 0.35} ${bx} ${innerB + by * 0.35} H${100 - bx} Q${100 - bx * 0.45} ${innerB + by * 0.35} ${100 - bx * 0.45} ${innerB} V6 H${innerR} V${innerB - 4} H${innerL} V6 Z`}
          {...hair}
        />
        <rect x={table.x} y={table.y} width={table.w} height={table.h} rx="5" {...hair} />
      </>
    );
  }
  return (
    <>
      {solid ? null : (
        <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      )}
      <path
        d={`M${bx * 0.45} 6 V${innerB} Q${bx * 0.45} ${innerB + by * 0.35} ${bx} ${innerB + by * 0.35} H${100 - bx} Q${100 - bx * 0.45} ${innerB + by * 0.35} ${100 - bx * 0.45} ${innerB} V6 H${innerR} V${innerB - 4} H${innerL} V6 Z`}
        fill={benchFill}
      />
      <rect x={table.x} y={table.y} width={table.w} height={table.h} rx="5" fill={tableFill} />
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
  hollow = false,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
  benchVx: number;
  benchVy: number;
  solid?: boolean;
  hollow?: boolean;
}) {
  const bx = Math.min(30, Math.max(16, benchVx));
  const by = Math.min(30, Math.max(16, benchVy));
  const table = boothTableBox("booth_l", { benchVx, benchVy });
  const hair = hollow
    ? { fill: "none" as const, stroke: outline, strokeWidth: 1.25, vectorEffect: "non-scaling-stroke" as const }
    : null;
  if (hair) {
    return (
      <>
        <path
          d={`M${bx * 0.45} 6 V${100 - by * 0.4} Q${bx * 0.45} ${100 - 4} ${bx} ${100 - 4} H${100 - 6} V${100 - by} H${bx} V6 Z`}
          {...hair}
        />
        <rect x={table.x} y={table.y} width={table.w} height={table.h} rx="5" {...hair} />
      </>
    );
  }
  return (
    <>
      {solid ? null : (
        <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      )}
      <path
        d={`M${bx * 0.45} 6 V${100 - by * 0.4} Q${bx * 0.45} ${100 - 4} ${bx} ${100 - 4} H${100 - 6} V${100 - by} H${bx} V6 Z`}
        fill={benchFill}
      />
      <rect x={table.x} y={table.y} width={table.w} height={table.h} rx="5" fill={tableFill} />
    </>
  );
}
