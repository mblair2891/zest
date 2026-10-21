import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Table } from "@/lib/pos/types";
import { asBoothKind } from "@/lib/pos/floor-booth";
import { uprightCounterDeg } from "@/lib/pos/floor-architecture";
import { joinedNumberLine } from "@/lib/pos/floor-fit";
import { diningTableOutline, railStoolCenters, seatingScale } from "@/lib/pos/floor-seating";
import { BoothNumber, FloorBoothGlyph, FloorBoothMark } from "@/components/pos/FloorBoothMark";
import { FloorCouchGlyph, FloorCouchMark } from "@/components/pos/FloorCouchMark";
import type { BoothKind } from "@/lib/pos/floor-booth";

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
  hairline = false,
  marked = false,
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
  /** plan = editor shape. status = the same shape, number only. Seat count is not drawn. */
  mode?: "plan" | "status";
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  /** Empty still passes through. The live shape is always a solid block. */
  hollow?: boolean;
  ink?: string;
  /** Editor stool tiles. The live floor paints stools as solid status blocks. */
  hairline?: boolean;
  /** Open check or combine target. A heavier edge on the shape, not a square ring. */
  marked?: boolean;
}) {
  const booth = asBoothKind(table.kind, table.shape);
  const couch = table.kind === "couch";
  const rot = ((Number(rotation ?? table.rotation) || 0) % 360 + 360) % 360;
  if (mode === "status") {
    return (
      <StatusFixture
        booth={booth}
        couch={couch}
        bar={table.kind === "barstool" || table.shape === "bar"}
        round={table.shape === "round"}
        tableFill={tableFill}
        rotation={rot}
        label={label}
        joined={joined}
        className={className}
        hollow={hollow}
        ink={ink}
        marked={marked}
        w={table.w}
        h={table.h}
      >
        {children}
      </StatusFixture>
    );
  }
  if (couch) {
    return (
      <FloorCouchMark
        tableFill={tableFill}
        outline={outline}
        rotation={rot}
        label={label}
        sectionColor={sectionColor}
        className={className}
        onPointerDown={onPointerDown}
      >
        {children}
      </FloorCouchMark>
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
        hairline={hairline}
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

/** Live floor: one status-colored shape. No chairs, stool rings, or seat dots. */
function StatusFixture({
  booth,
  couch,
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
  marked = false,
  w,
  h,
}: {
  booth: BoothKind | null;
  couch: boolean;
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
  marked?: boolean;
  w: number;
  h: number;
}) {
  const edge = "#1c1917";
  const paint = tableFill && tableFill !== "none" && tableFill !== "transparent" ? tableFill : "#f7f4ee";
  const number = ink || "#1c1917";
  const shape = couch ? "couch" : booth ? "booth" : bar ? "stool" : round ? "round" : "rect";
  const raw = diningTableOutline(round);
  const mark = raw.round
    ? { ...raw, rx: raw.rx * 0.9, ry: raw.ry * 0.9 }
    : {
        ...raw,
        x: raw.x + 4,
        y: raw.y + 4,
        width: raw.width - 8,
        height: raw.height - 8,
      };
  const tableRect = !couch && !booth && !bar && !round;
  const party = joinedNumberLine(joined);
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center", containerType: "size" }}
      data-floor-status-shape={shape}
      data-floor-fill="solid"
      data-floor-stroke="edge"
      data-floor-empty={hollow ? "1" : "0"}
      data-floor-nubs="0"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio={tableRect ? "none" : "xMidYMid meet"}
        data-floor-table-box={tableRect ? "rect" : round && !bar ? "round" : undefined}
        className="pointer-events-none h-full w-full"
        aria-hidden
      >
        {couch ? (
          <FloorCouchGlyph fill={paint} outline={edge} solid />
        ) : booth ? (
          <FloorBoothGlyph
            kind={booth}
            tableFill={paint}
            benchFill={paint}
            outline={edge}
            w={w}
            h={h}
            solid
          />
        ) : round && mark.round ? (
          <ellipse
            cx={mark.cx}
            cy={mark.cy}
            rx={mark.rx}
            ry={mark.ry}
            fill={paint}
            stroke={edge}
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : !mark.round ? (
          <rect
            x={mark.x}
            y={mark.y}
            width={mark.width}
            height={mark.height}
            rx={mark.rx}
            fill={paint}
            stroke={edge}
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {marked && round && mark.round ? (
          <ellipse
            cx={mark.cx}
            cy={mark.cy}
            rx={mark.rx}
            ry={mark.ry}
            fill="none"
            stroke={edge}
            strokeWidth={4}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        {marked && !mark.round && !booth && !couch && !bar ? (
          <rect
            x={mark.x}
            y={mark.y}
            width={mark.width}
            height={mark.height}
            rx={mark.rx}
            fill="none"
            stroke={edge}
            strokeWidth={4}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {label && booth ? (
        <BoothNumber
          kind={booth}
          w={w}
          h={h}
          rotation={rotation}
          label={label}
          joined={joined}
          ink={number}
          surface="live"
        />
      ) : label ? (
        <span
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[6%] text-center font-semibold leading-none tabular"
          style={{ transform: `rotate(${-rotation}deg)`, color: number }}
          data-floor-cluster={joined?.length ? "1" : undefined}
          data-floor-weight="bold"
        >
          <span data-floor-primary style={{ fontSize: joined?.length ? "46cqmin" : "56cqmin", fontWeight: 700 }}>
            {label}
          </span>
          {joined && joined.length > 0 ? (
            <span
              data-floor-joined
              className="mt-[3%] font-semibold leading-tight"
              style={{ fontSize: "22cqmin", fontWeight: 700 }}
            >
              {party}
            </span>
          ) : null}
        </span>
      ) : null}
      {children}
    </div>
  );
}

function FloorTableArt({
  w: _w,
  h: _h,
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
  const mark = diningTableOutline(round, seats);
  return (
    <div
      data-floor-spin=""
      data-floor-nubs="0"
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center" }}
      onPointerDown={onPointerDown}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio={mark.round ? "xMidYMid meet" : "none"}
        data-floor-table-box={mark.round ? "round" : "rect"}
        className="pointer-events-none h-full w-full"
        aria-hidden
      >
        {mark.round ? (
          <ellipse
            cx={mark.cx}
            cy={mark.cy}
            rx={mark.rx}
            ry={mark.ry}
            fill={tableFill}
            stroke={outline}
            strokeWidth="2.5"
          />
        ) : (
          <rect
            x={mark.x}
            y={mark.y}
            width={mark.width}
            height={mark.height}
            rx={mark.rx}
            fill={tableFill}
            stroke={outline}
            strokeWidth="2.5"
          />
        )}
        {sectionColor ? (
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

function FloorStoolArt({
  w,
  h,
  seats,
  fill: _fill,
  outline: _outline,
  label,
  sectionColor,
  rotation = 0,
  className,
  children,
  onPointerDown,
  hairline = false,
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
  /** Live map: 1.25px ring, same weight as an empty table. */
  hairline?: boolean;
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
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center", containerType: "size" }}
      onPointerDown={onPointerDown}
      data-floor-stroke={hairline ? "hairline" : undefined}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden data-floor-stool="tile">
        {centers.map((c, i) => (
          <rect
            key={i}
            x={c.x - rx}
            y={c.y - ry}
            width={rx * 2}
            height={ry * 2}
            rx={Math.min(rx, ry) * 0.35}
            fill="#f4efe6"
            stroke="#1c1917"
            strokeWidth={hairline ? 1.25 : 2.5}
            vectorEffect={hairline ? "non-scaling-stroke" : undefined}
            data-floor-stool-tile="1"
          />
        ))}
        {sectionColor ? (
          <rect x="38" y="2" width="24" height="4" rx="1.5" fill={sectionColor} />
        ) : null}
      </svg>
      {label ? (
        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-0.5 text-center tabular leading-none",
            hairline ? "font-medium text-[#44403c]" : "font-semibold",
          )}
          style={{
            transform: `rotate(${uprightCounterDeg(rotation)}deg)`,
            fontSize: hairline ? "40cqmin" : "38cqmin",
            fontWeight: hairline ? 500 : 600,
            whiteSpace: "nowrap",
          }}
          data-floor-stool-label=""
          data-floor-label-upright="1"
          data-floor-weight={hairline ? "medium" : undefined}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}
