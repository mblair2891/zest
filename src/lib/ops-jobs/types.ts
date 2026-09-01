/** Scheduled AI operations jobs — efficiency + exception monitoring. Never theft verdicts. */

export const JOB_CADENCES = [
  "service_hourly",
  "nightly",
  "weekly",
  "pay_period",
  "monthly",
] as const;

export type JobCadence = (typeof JOB_CADENCES)[number];

export const JOB_CADENCE_LABEL: Record<JobCadence, string> = {
  service_hourly: "Service / hourly",
  nightly: "Nightly",
  weekly: "Weekly",
  pay_period: "Pay period",
  monthly: "Monthly",
};

export type OpsJobSeverity = "info" | "watch" | "urgent";

export type OpsJobRowType =
  | "floor_integrity"
  | "labor_pulse"
  | "gate_feed"
  | "gift_burst"
  | "printer"
  | "exception_pack"
  | "blind_count"
  | "tips"
  | "tender_mix"
  | "void_comp"
  | "capture_split"
  | "cost_flash"
  | "staffing_postmortem"
  | "house_close"
  | "peer_compare"
  | "schedule_vs_sales"
  | "drawer_trend"
  | "menu_recipe"
  | "gift_liability"
  | "training_leftover"
  | "pay_period"
  | "risk_digest"
  | "baseline"
  | "vendor_cost"
  | "processor_fees"
  | "menu_engineering"
  | "hr_packet"
  | "device_unseen";

export type OpsEntityKind = "host" | "bar" | "food" | "other";

export type OpsJobStatus = "ok" | "skipped" | "error";

export type OpsJobRow = {
  type: OpsJobRowType;
  severity: OpsJobSeverity;
  subject: string;
  amountCents?: number | null;
  pct?: number | null;
  suggestedAction: string;
  entityId?: string | null;
  entityName?: string | null;
};

export type OpsJobReport = {
  id: string;
  cadence: JobCadence;
  at: number;
  locationId: string;
  locationName: string;
  fireKey: string;
  status: OpsJobStatus;
  skipReason?: string;
  narrative: string;
  rows: OpsJobRow[];
  dataGaps: string[];
  delivered: "inbox" | "email" | "outbox";
  entityId?: string | null;
};

export type DaypartBaseline = {
  daypart: string;
  sales30mCents: number;
  laborPct: number | null;
  updatedAt: number;
};

export type OpsNotifyRole = "owner" | "manager" | "host" | "accountant";

export type CadenceSchedule = {
  enabled: boolean;
  /** Local hour 0–23 for nightly / weekly / monthly. */
  hour: number;
  /** 0–6 Sunday–Saturday for weekly. */
  weekday: number;
  /** 1–28 for monthly. */
  dayOfMonth: number;
};

export type OpsJobsConfig = {
  enabled: boolean;
  cadences: Record<JobCadence, CadenceSchedule>;
  notifyRoles: OpsNotifyRole[];
  notifyEmail: string;
  /** HH:MM local — hourly jobs only while open. */
  openTime: string;
  closeTime: string;
  laborPctTarget: number;
  foodCostTargetPct: number;
  liquorCostTargetPct: number;
  exceptionDollarCents: number;
  exceptionPct: number;
  exceptionIdleMinutes: number;
  /** Mirrors loss-prevention night close; Settings writes both. */
  houseCloseMode: "ack" | "hard_block";
  minStaff: number;
  rushLockDayparts: string[];
  theoreticalIncludeVoids: boolean;
  theoreticalIncludeComps: boolean;
};

export type OpsJobFacts = {
  cadence: JobCadence;
  generatedAt: number;
  location: {
    id: string;
    name: string;
    timezone: string;
    open: boolean;
    lifecycle: string;
  };
  config: {
    laborPctTarget: number;
    foodCostTargetPct: number;
    liquorCostTargetPct: number;
    exceptionDollarCents: number;
    exceptionPct: number;
    exceptionIdleMinutes: number;
    houseCloseMode: "ack" | "hard_block";
    minStaff: number;
    rushLockDayparts: string[];
    theoreticalIncludeVoids: boolean;
    theoreticalIncludeComps: boolean;
  };
  house: Record<string, unknown>;
  entities: Array<{
    id: string;
    name: string;
    kind: OpsEntityKind;
    facts: Record<string, unknown>;
  }>;
  seedRows: OpsJobRow[];
  daypartBaselines?: DaypartBaseline[];
  dataGaps: string[];
};
