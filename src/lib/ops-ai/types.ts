export type OpsRecSeverity = "info" | "watch" | "urgent";
export type OpsRecType =
  | "labor_high"
  | "labor_low"
  | "kitchen_slow"
  | "waitlist_idle"
  | "voids_high"
  | "mix_86"
  | "cost_variance"
  | "price_rec"
  | "recommend_cut"
  | "recommend_hold"
  | "recommend_add";
export type OpsDecisionAction = "accept" | "dismiss" | "snooze";

export type OpsFeatureSnapshot = {
  daypart: string;
  laborHeadcount: number;
  serverCount: number;
  kitchenCount: number;
  salesCents: number;
  kitchenAvgSec: number;
  waitlistWaiting: number;
  idleTables: number;
  openChecks: number;
  laborPct: number | null;
  salesLast30mCents?: number;
  baseline30mCents?: number;
  idleMinutes?: number;
  odsOpen?: number;
  waitlistQuotedAvg?: number;
  reservationsSoon?: number;
  splhCents?: number | null;
};

export type OpsRecommendation = {
  id: string;
  type: OpsRecType;
  area: string;
  severity: OpsRecSeverity;
  message: string;
  suggestedAction: string;
  confidence: number;
  applyView?: string;
  operatorId?: string | null;
  basedOnPastDecisions?: boolean;
  dismissedBefore?: boolean;
  staffingKind?: "recommend_cut" | "recommend_hold" | "recommend_add";
  targetRole?: string;
  reasons?: string[];
  candidateEmployeeIds?: string[];
};

export type OpsDecisionEvent = {
  id: string;
  locationId: string;
  operatorId: string | null;
  recId: string;
  recType: OpsRecType;
  action: OpsDecisionAction;
  features: OpsFeatureSnapshot;
  at: number;
  userId: string;
};
