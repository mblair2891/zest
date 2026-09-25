import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Table } from "@/lib/pos/types";
import { asBoothKind } from "@/lib/pos/floor-booth";
import { railStoolCenters, seatingScale } from "@/lib/pos/floor-seating";
import { FloorBoothMark } from "@/components/pos/FloorBoothMark";
import type { BoothKind } from "@/lib/pos/floor-booth";

const NUB = "#6b5a4e";

/** Four pips on a square, six on a round. Not chair drawings. */
function nubPoints(round: boolean): Array<{ x: number; y: number }> {
  if (round) {
    return Array.from({ length: 6 }, (_, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 6;
      return { x: 50 + Math.cos(a) * 46, y: 50 + Math.sin(a) * 46 };
    });
  }
  return [
    { x: 50, y: 5 },
    { x: 95, y: 50 },
    { x: 50, y: 95 },
    { x: 5, y: 50 },
  ];
}

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
  /** Empty tables are a hairline ring with a clear center. */
  hollow?: boolean;
  ink?: string;
  /** Live stool tiles: same 1.25px ring as empty tables. */
  hairline?: boolean;
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
        nubs={!booth && table.kind !== "square_plain" && table.kind !== "barstool" && table.shape !== "bar"}
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
  nubs = false,
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
  nubs?: boolean;
}) {
  const ring = "#1c1917";
  const number = hollow ? "#44403c" : ink || "#44403c";
  const shape = booth ? "booth" : bar ? "stool" : round ? "round" : "rect";
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)`, transformOrigin: "center center", containerType: "size" }}
      data-floor-status-shape={shape}
      data-floor-fill={hollow ? "hollow" : "solid"}
      data-floor-stroke={hollow ? "hairline" : "none"}
      data-floor-nubs={nubs ? "1" : "0"}
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
            strokeWidth={hollow ? 1.25 : 0}
            vectorEffect="non-scaling-stroke"
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
            strokeWidth={hollow ? 1.25 : 0}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {nubs
          ? nubPoints(round).map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="3.2" fill={NUB} data-floor-nub="1" />
            ))
          : null}
      </svg>
      {label ? (
        <span
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[8%] text-center font-medium leading-none tabular"
          style={{ transform: `rotate(${-rotation}deg)`, color: number }}
          data-floor-cluster={joined?.length ? "1" : undefined}
          data-floor-weight="medium"
        >
          <span data-floor-primary style={{ fontSize: joined?.length ? "42cqmin" : "50cqmin", fontWeight: 500 }}>
            {label}
          </span>
          {joined && joined.length > 0 ? (
            <span
              data-floor-joined
              className="mt-[4%] font-medium leading-tight"
              style={{ fontSize: "18cqmin", fontWeight: 500 }}
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
        {(seats > 0 ? nubPoints(round) : []).map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.2" fill={NUB} data-floor-nub="1" />
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
            "pointer-events-none absolute inset-0 flex items-center justify-center px-1 text-center tabular leading-none",
            hairline ? "font-medium text-[#44403c]" : "text-[10px] font-semibold",
          )}
          style={hairline ? { fontSize: "46cqmin", fontWeight: 500 } : undefined}
          data-floor-weight={hairline ? "medium" : undefined}
        >
          {label}
        </span>
      ) : null}
      {children}
    </div>
  );
}
