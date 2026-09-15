import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { BoothKind } from "@/lib/pos/floor-booth";

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
}) {
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg viewBox="0 0 100 100" className="pointer-events-none h-full w-full" aria-hidden>
        {kind === "booth_4" ? (
          <Booth4Paths tableFill={tableFill} benchFill={benchFill} outline={outline} />
        ) : kind === "booth_u" ? (
          <BoothUPaths tableFill={tableFill} benchFill={benchFill} outline={outline} />
        ) : (
          <BoothLPaths tableFill={tableFill} benchFill={benchFill} outline={outline} />
        )}
        {sectionColor ? (
          <rect x="38" y="2" width="24" height="4" rx="1.5" fill={sectionColor} />
        ) : null}
      </svg>
      {label ? (
        <span
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular leading-none"
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
        <Booth4Paths tableFill="#efe6d8" benchFill={BENCH} outline="#8a7368" />
      ) : kind === "booth_u" ? (
        <BoothUPaths tableFill="#efe6d8" benchFill={BENCH} outline="#8a7368" />
      ) : (
        <BoothLPaths tableFill="#efe6d8" benchFill={BENCH} outline="#8a7368" />
      )}
    </svg>
  );
}

function Booth4Paths({
  tableFill,
  benchFill,
  outline,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
}) {
  return (
    <>
      <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      <rect x="8" y="6" width="84" height="20" rx="7" fill={benchFill} />
      <rect x="12" y="10" width="76" height="2" rx="1" fill={BENCH_STITCH} opacity="0.45" />
      <rect x="20" y="32" width="60" height="36" rx="5" fill={tableFill} />
      <rect x="8" y="74" width="84" height="20" rx="7" fill={benchFill} />
      <rect x="12" y="88" width="76" height="2" rx="1" fill={BENCH_STITCH} opacity="0.45" />
    </>
  );
}

function BoothUPaths({
  tableFill,
  benchFill,
  outline,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
}) {
  return (
    <>
      <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      <path
        d="M10 8 V88 Q10 94 16 94 H84 Q90 94 90 88 V8 H70 V70 H30 V8 Z"
        fill={benchFill}
      />
      <rect x="34" y="14" width="32" height="50" rx="5" fill={tableFill} />
    </>
  );
}

function BoothLPaths({
  tableFill,
  benchFill,
  outline,
}: {
  tableFill: string;
  benchFill: string;
  outline: string;
}) {
  return (
    <>
      <rect x="2" y="2" width="96" height="96" rx="10" fill="none" stroke={outline} strokeWidth="3" />
      <path
        d="M10 8 V88 Q10 94 16 94 H90 V72 H32 V8 Z"
        fill={benchFill}
      />
      <rect x="38" y="16" width="40" height="50" rx="5" fill={tableFill} />
    </>
  );
}
