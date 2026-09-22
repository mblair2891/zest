import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Table } from "@/lib/pos/types";
import { asBoothKind } from "@/lib/pos/floor-booth";
import {
  railStoolCenters,
  seatAnchors,
  seatingScale,
} from "@/lib/pos/floor-seating";
import { FloorBoothMark } from "@/components/pos/FloorBoothMark";
import type { BoothKind } from "@/lib/pos/floor-booth";

const CHAIR = "#6b5a4e";
const STOOL = "#5c534c";

export function FloorFixtureArt({
  table,
  tableFill,
  outline,
  sectionColor,
  label,
  rotation = 0,
  className,
  children,
  mode = "plan",
}: {
  table: Pick<Table, "kind" | "shape" | "w" | "h" | "seats" | "rotation">;
  tableFill: string;
  outline: string;
  sectionColor?: string;
  label?: string;
  rotation?: number;
  className?: string;
  children?: ReactNode;
  /** plan = editor capacity marks. status = solid fill, number only, no seats. */
  mode?: "plan" | "status";
}) {
  const booth = asBoothKind(table.kind, table.shape);
  const rot = rotation || table.rotation || 0;
  if (mode === "status") {
    return (
      <StatusFixture
        booth={booth}
        bar={table.kind === "barstool" || table.shape === "bar"}
        round={table.shape === "round"}
        tableFill={tableFill}
        rotation={rot}
        label={label}
        w={table.w}
        h={table.h}
        className={className}
      >
        {children}
      </StatusFixture>
    );
  }
  if (booth) {
    return (
      <FloorBoothMark
        kind={booth}
        tableFill={tableFill}
        outline={outline}
        rotation={rot}
        label={label}
        sectionColor={sectionColor}
        w={table.w}
        h={table.h}
        seats={table.seats}
        className={className}
      >
        {children}
      </FloorBoothMark>
    );
  }
  const other = table.kind === "other" || table.shape === "other";
  if (other) {
    return (
      <FloorTableArt
        w={table.w}
        h={table.h}
        seats={0}
        round={false}
        tableFill={tableFill}
        outline={outline}
        label={label}
        sectionColor={sectionColor}
        rotation={rot}
        className={className}
      >
        {children}
      </FloorTableArt>
    );
  }
  const bar = table.kind === "barstool" || table.shape === "bar";
  if (bar) {
    return (
      <FloorStoolArt
        w={table.w}
        h={table.h}
        seats={table.seats}
        fill={tableFill}
        outline={outline}
        label={label}
        sectionColor={sectionColor}
        className={className}
      >
        {children}
      </FloorStoolArt>
    );
  }
  return (
    <FloorTableArt
      w={table.w}
      h={table.h}
      seats={table.seats}
      round={table.shape === "round"}
      tableFill={tableFill}
      outline={outline}
      label={label}
      sectionColor={sectionColor}
      rotation={rot}
      className={className}
    >
      {children}
    </FloorTableArt>
  );
}

/** Live floor: one status-colored shape. No chairs, stool rings, or seat hashes. */
function StatusFixture({
  booth,
  bar,
  round,
  tableFill,
  rotation,
  label,
  w,
  h,
  className,
  children,
}: {
  booth: BoothKind | null;
  bar: boolean;
  round: boolean;
  tableFill: string;
  rotation: number;
  label?: string;
  w: number;
  h: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, containerType: "size" }}
      data-floor-status-shape={booth ?? (bar ? "stool" : round ? "round" : "rect")}
      data-no-chairs=""
    >
      {booth ? (
        <FloorBoothMark
          kind={booth}
          tableFill={tableFill}
          outline={tableFill}
          rotation={0}
          solid
          w={w}
          h={h}
          seats={4}
        />
      ) : (
        <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
          {bar || round ? (
            <ellipse cx="50" cy="50" rx="48" ry="48" fill={tableFill} />
          ) : (
            <rect x="2" y="2" width="96" height="96" rx="12" fill={tableFill} />
          )}
        </svg>
      )}
      {label ? (
        <span
          className="pointer-events-none absolute inset-0 grid place-items-center px-[8%] text-center font-bold leading-none tabular"
          style={{ fontSize: "50cqmin", transform: `rotate(${-rotation}deg)` }}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function FloorTableArt({
  w,
  h,
  seats,
  round,
  tableFill,
  outline,
  label,
  sectionColor,
  rotation,
  className,
  children,
}: {
  w: number;
  h: number;
  seats: number;
  round: boolean;
  tableFill: string;
  outline: string;
  label?: string;
  sectionColor?: string;
  rotation: number;
  className?: string;
  children?: ReactNode;
}) {
  const s = seatingScale({ w, h, seats: Math.max(seats, 1) });
  const anchors =
    seats <= 0
      ? []
      : seatAnchors(seats, round, s.tableInsetVx * 0.55, s.tableInsetVy * 0.55);
  const tx = seats <= 0 ? 8 : s.tableInsetVx;
  const ty = seats <= 0 ? 8 : s.tableInsetVy;
  const tw = Math.max(28, 100 - tx * 2);
  const th = Math.max(28, 100 - ty * 2);
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
        {round ? (
          <ellipse
            cx="50"
            cy="50"
            rx={tw / 2}
            ry={th / 2}
            fill={tableFill}
            stroke={outline}
            strokeWidth="2.5"
          />
        ) : (
          <rect
            x={tx}
            y={ty}
            width={tw}
            height={th}
            rx="8"
            fill={tableFill}
            stroke={outline}
            strokeWidth="2.5"
          />
        )}
        {sectionColor ? (
          <rect x="38" y={ty - 1} width="24" height="4" rx="1.5" fill={sectionColor} />
        ) : null}
        {anchors.map((a, i) => (
          <g key={i} transform={`translate(${a.x} ${a.y}) rotate(${a.deg})`}>
            <rect
              x={-s.iconVx / 2}
              y={-s.iconVy * 0.35}
              width={s.iconVx}
              height={s.iconVy * 0.7}
              rx={Math.min(s.iconVx, s.iconVy) * 0.18}
              fill={CHAIR}
            />
            <rect
              x={-s.iconVx / 2}
              y={-s.iconVy / 2}
              width={s.iconVx}
              height={s.iconVy * 0.22}
              rx={Math.min(s.iconVx, s.iconVy) * 0.12}
              fill={CHAIR}
            />
          </g>
        ))}
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

function FloorStoolArt({
  w,
  h,
  seats,
  fill,
  outline,
  label,
  sectionColor,
  className,
  children,
}: {
  w: number;
  h: number;
  seats: number;
  fill: string;
  outline: string;
  label?: string;
  sectionColor?: string;
  className?: string;
  children?: ReactNode;
}) {
  const s = seatingScale({ w, h, seats });
  const horizontal = w >= h;
  let along = horizontal ? s.stoolVx : s.stoolVy;
  if (seats > 1) along = Math.min(along, 84 / seats);
  const scale = along / (horizontal ? s.stoolVx : s.stoolVy || 1);
  const rx = (s.stoolVx / 2) * (horizontal ? scale : 1);
  const ry = (s.stoolVy / 2) * (horizontal ? 1 : scale);
  const centers = railStoolCenters(seats, along, horizontal);
  return (
    <div className={cn("relative h-full w-full", className)}>
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
        {centers.map((c, i) => (
          <g key={i}>
            <ellipse
              cx={c.x}
              cy={c.y}
              rx={rx}
              ry={ry}
              fill={STOOL}
              stroke={outline}
              strokeWidth="2"
            />
            <ellipse cx={c.x} cy={c.y} rx={rx * 0.55} ry={ry * 0.55} fill={fill} />
          </g>
        ))}
        {sectionColor ? (
          <rect x="38" y="2" width="24" height="4" rx="1.5" fill={sectionColor} />
        ) : null}
      </svg>
      {label ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-center text-[10px] font-semibold tabular leading-none">
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}
