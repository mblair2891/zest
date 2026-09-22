import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
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
  joined,
  rotation = 0,
  className,
  children,
  mode = "plan",
  onPointerDown,
  hollow = false,
  ink,
}: {
  table: Pick<Table, "kind" | "shape" | "w" | "h" | "seats" | "rotation">;
  tableFill: string;
  outline: string;
  sectionColor?: string;
  label?: string;
  /** Smaller numbers on the same fill when tables are joined. */
  joined?: string[];
  rotation?: number;
  className?: string;
  children?: ReactNode;
  /** plan = editor capacity marks. status = solid fill, number only, no seats. */
  mode?: "plan" | "status";
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Empty tables are a dark ring with a clear center. */
  hollow?: boolean;
  ink?: string;
}) {
  const booth = asBoothKind(table.kind, table.shape);
  const rot = ((Number(rotation ?? table.rotation) || 0) % 360 + 360) % 360;
  if (mode === "status") {
    return (
      <StatusFixture
        booth={booth}
        bar={table.kind === "barstool" || table.shape === "bar"}
        round={table.shape === "round"}
        tableFill={tableFill}
        rotation={rot}
        label={label}
        joined={joined}
        className={className}
        hollow={hollow}
        ink={ink}
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
        onPointerDown={onPointerDown}
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
        onPointerDown={onPointerDown}
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
        rotation={rot}
        className={className}
        onPointerDown={onPointerDown}
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
      onPointerDown={onPointerDown}
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
  joined,
  className,
  children,
  hollow = false,
  ink,
}: {
  booth: BoothKind | null;
  bar: boolean;
  round: boolean;
  tableFill: string;
  rotation: number;
  label?: string;
  joined?: string[];
  className?: string;
  children?: ReactNode;
  hollow?: boolean;
  ink?: string;
}) {
  const ring = "#1c1917";
  const number = hollow ? ring : ink || "#0a0a0a";
  const shape = booth ? "booth" : bar ? "stool" : round ? "round" : "rect";
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center", containerType: "size" }}
      data-floor-status-shape={shape}
      data-floor-fill={hollow ? "hollow" : "solid"}
      data-no-chairs=""
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
        {round ? (
          <ellipse
            cx="50"
            cy="50"
            rx="46"
            ry="46"
            fill={hollow ? "none" : tableFill}
            stroke={hollow ? ring : "none"}
            strokeWidth={hollow ? 7 : 0}
          />
        ) : (
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="16"
            fill={hollow ? "none" : tableFill}
            stroke={hollow ? ring : "none"}
            strokeWidth={hollow ? 7 : 0}
          />
        )}
      </svg>
      {label ? (
        <span
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[8%] text-center font-bold leading-none tabular"
          style={{ transform: `rotate(${-rotation}deg)`, color: number }}
          data-floor-cluster={joined?.length ? "1" : undefined}
        >
          <span data-floor-primary style={{ fontSize: joined?.length ? "42cqmin" : "50cqmin" }}>
            {label}
          </span>
          {joined && joined.length > 0 ? (
            <span
              data-floor-joined
              className="mt-[4%] font-semibold leading-tight"
              style={{ fontSize: "18cqmin" }}
            >
              {joined.join(" · ")}
            </span>
          ) : null}
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
  onPointerDown,
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
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
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
      data-floor-spin=""
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onPointerDown={onPointerDown}
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
  rotation = 0,
  className,
  children,
  onPointerDown,
}: {
  w: number;
  h: number;
  seats: number;
  fill: string;
  outline: string;
  label?: string;
  sectionColor?: string;
  rotation?: number;
  className?: string;
  children?: ReactNode;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
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
    <div
      data-floor-spin=""
      className={cn("relative h-full w-full", className)}
      data-floor-rotation={rotation}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onPointerDown={onPointerDown}
    >
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
