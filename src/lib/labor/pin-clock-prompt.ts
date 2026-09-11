/**
 * After station PIN: optional clock-in offer when off the clock and inside
 * that entity’s allowed early/late window for today’s published shift.
 * Leaf module (no store) so node:test can load it.
 */
import { sameDay } from "./week";
import {
  DEFAULT_LABOR_RULES,
  isInsideClockInWindow,
  parseLaborRules,
  type EntityLaborRules,
} from "./rules";

export type PromptShift = {
  id: string;
  employeeId: string;
  operatorId: string;
  start: number;
  end: number;
  published: boolean;
};

export type PinClockPromptInput = {
  stationPinSession: boolean;
  clockedIn: boolean;
  employeeId: string;
  homeOperatorId?: string | null;
  shifts: PromptShift[];
  laborByEntity?: Record<string, unknown>;
  defaultLabor?: unknown;
  now?: number;
};

export type PinClockPromptResult = {
  prompt: boolean;
  shift: PromptShift | null;
  entityId: string;
};

const HOST = "host";

function rulesFor(
  entityId: string,
  laborByEntity: Record<string, unknown> | undefined,
  defaultLabor: unknown,
): EntityLaborRules {
  const raw = laborByEntity?.[entityId] ?? defaultLabor;
  return parseLaborRules(raw ?? DEFAULT_LABOR_RULES);
}

/** Today’s published shift whose clock-in window contains now, else none. */
export function todaysShiftInClockInWindow(
  opts: {
    employeeId: string;
    homeOperatorId?: string | null;
    shifts: PromptShift[];
    laborByEntity?: Record<string, unknown>;
    defaultLabor?: unknown;
    now?: number;
  },
): { shift: PromptShift; entityId: string } | null {
  const now = opts.now ?? Date.now();
  const today = opts.shifts.filter(
    (s) => s.employeeId === opts.employeeId && s.published && sameDay(s.start, now),
  );
  if (!today.length) return null;
  for (const shift of today) {
    const entityId = shift.operatorId || opts.homeOperatorId || HOST;
    const rules = rulesFor(entityId, opts.laborByEntity, opts.defaultLabor);
    if (isInsideClockInWindow(now, shift.start, rules)) {
      return { shift, entityId };
    }
  }
  return null;
}

export function shouldPromptClockInAfterPin(opts: PinClockPromptInput): PinClockPromptResult {
  const home = opts.homeOperatorId || HOST;
  if (!opts.stationPinSession || opts.clockedIn || !opts.employeeId) {
    return { prompt: false, shift: null, entityId: home };
  }
  const hit = todaysShiftInClockInWindow({
    employeeId: opts.employeeId,
    homeOperatorId: opts.homeOperatorId,
    shifts: opts.shifts,
    laborByEntity: opts.laborByEntity,
    defaultLabor: opts.defaultLabor,
    now: opts.now,
  });
  if (!hit) return { prompt: false, shift: null, entityId: home };
  return { prompt: true, shift: hit.shift, entityId: hit.entityId };
}
