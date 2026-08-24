import type { EmployeeRole, VenueEntityId } from "@/lib/pos/types";

export type ReportId =
  | "sales-summary"
  | "sales-daypart"
  | "sales-items"
  | "sales-channel"
  | "payments-tenders"
  | "payments-cash-discount"
  | "payments-voids"
  | "payments-chargebacks"
  | "staff-servers"
  | "staff-payroll"
  | "staff-aging"
  | "kitchen-tickets"
  | "close-eod"
  | "guest-waitlist"
  | "guest-kiosk"
  | "multi-op-sales"
  | "multi-op-settlement";

export type ReportGroup =
  | "sales"
  | "payments"
  | "staff"
  | "kitchen"
  | "close"
  | "guest"
  | "multi";

export type ReportDef = {
  id: ReportId;
  group: ReportGroup;
  title: string;
  summary: string;
  venues?: VenueEntityId[];
  roles: EmployeeRole[] | "all";
};

export type RangeKey = "shift" | "today" | "7d" | "30d";

export type LocationMetrics = {
  locationId: string;
  locationName: string;
  venueType: VenueEntityId;
  range: RangeKey;
  from: number;
  to: number;
  isDemo: boolean;
  hostMulti: boolean;
  operatorId?: string | null;
  serverId?: string | null;
  sales: {
    netCents: number;
    closedChecks: number;
    openChecks: number;
    covers: number;
    avgCheckCents: number;
    byHour: { hour: number; cents: number }[];
    byDaypart: { part: string; cents: number; checks: number }[];
    byCategory: { name: string; cents: number; qty: number }[];
    byItem: { id: string; name: string; cents: number; qty: number; station: string; vendorId?: string }[];
    byChannel: { channel: string; cents: number; checks: number }[];
  };
  payments: {
    cardCents: number;
    cashCents: number;
    giftCents: number;
    otherCents: number;
    tipsCents: number;
    refundsCents: number;
    voidsCents: number;
    compsCents: number;
    cashDiscountCostCents: number;
    chargebacks: { count: number; feeCents: number };
  };
  staff: {
    clocked: { role: string; count: number }[];
    byServer: { id: string; name: string; salesCents: number; tipsCents: number; checks: number }[];
    agingOpen: { id: string; number: number; minutes: number; serverName: string }[];
  };
  tickets: {
    kitchenAvgSec: number;
    barAvgSec: number;
    kitchenOpen: number;
    barOpen: number;
    kitchenReady: number;
    eightySix: { name: string; station: string }[];
  };
  guest: {
    waitlistWaiting: number;
    waitlistQuotedAvg: number;
    waitlistSeated: number;
    noShows: number;
    reservations: number;
    checkedIn: number;
    kioskOrders: number;
  };
  multiOp: {
    byOperator: { id: string; name: string; cents: number; tickets: number }[];
    hostCutCents: number;
    periodCount: number;
  };
  cost: {
    items: {
      id: string;
      name: string;
      salesCents: number;
      qty: number;
      costCents: number | null;
      marginBps: number | null;
    }[];
    dataCoverage: number;
    note: string;
  };
};

export type InsightFinding = {
  area: string;
  severity: "info" | "watch" | "urgent";
  observation: string;
  evidence: string;
};

export type CostVsOrderingRow = {
  itemOrCategory: string;
  salesTrend: string;
  costSignal: string;
  issue: string;
  recommendation: string;
};

export type InsightRecommendation = {
  priority: "now" | "soon" | "later";
  action: string;
  expectedImpact: string;
  ownerRole: EmployeeRole | "owner" | "manager";
  applyView?: string;
  basedOnPastDecisions?: boolean;
  pastOutcome?: string;
};

export type LocationInsights = {
  summary: string;
  healthScore: number;
  findings: InsightFinding[];
  costVsOrdering: CostVsOrderingRow[];
  recommendations: InsightRecommendation[];
  risks: string[];
  source: "ai" | "guided";
  dataGaps: string[];
};
