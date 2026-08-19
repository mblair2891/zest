/** Full-package domains beyond core POS + platform */

export type PackagePhase =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

export interface PermissionDef {
  id: string;
  label: string;
  category: string;
}

export interface RolePermissions {
  role: string;
  allow: string[];
}

export interface HardwareDevice {
  id: string;
  name: string;
  type:
    | "terminal"
    | "printer"
    | "kds"
    | "drawer"
    | "reader"
    | "scale"
    | "scanner"
    | "cfd";
  locationId: string;
  status: "online" | "offline" | "degraded";
  ip?: string;
  lastSeenAt: number;
}

export interface WebhookEvent {
  id: string;
  at: number;
  topic: string;
  payload: string;
  status: "delivered" | "failed" | "queued";
}

export interface OfflineOp {
  id: string;
  at: number;
  type: string;
  detail: string;
  synced: boolean;
}

export interface WasteEntry {
  id: string;
  at: number;
  inventoryId: string;
  name: string;
  qty: number;
  unit: string;
  reason: "spoilage" | "prep_error" | "comp" | "theft" | "other";
  costCents: number;
  employeeId: string;
}

export interface TipPoolRule {
  id: string;
  name: string;
  percentOfTips: number;
  roles: string[];
  active: boolean;
}

export interface AlcoholServiceLog {
  id: string;
  at: number;
  guestDescription: string;
  idChecked: boolean;
  birthYear?: number;
  employeeId: string;
  orderId?: string;
  cutOff: boolean;
}

export interface AgeCheckResult {
  ok: boolean;
  age?: number;
  message: string;
}

export interface TempLog {
  id: string;
  at: number;
  station: string;
  tempF: number;
  ok: boolean;
  employeeId: string;
}

export interface IncidentReport {
  id: string;
  at: number;
  severity: "low" | "medium" | "high";
  title: string;
  detail: string;
  employeeId: string;
  resolved: boolean;
}

export interface ShiftSwap {
  id: string;
  fromEmployeeId: string;
  toEmployeeId?: string;
  shiftId: string;
  status: "open" | "approved" | "denied";
  createdAt: number;
}

export interface BreakEvent {
  id: string;
  employeeId: string;
  type: "meal" | "rest";
  start: number;
  end?: number;
  compliant: boolean;
}

export interface TrainingModule {
  id: string;
  title: string;
  minutes: number;
  requiredFor: string[];
  completedBy: string[];
}

export interface CompBudget {
  role: string;
  dailyLimitCents: number;
  usedCents: number;
}

export interface TaxJurisdiction {
  id: string;
  name: string;
  rate: number;
  inclusive: boolean;
}

export interface DaypartMenu {
  id: string;
  name: string;
  startHour: number;
  endHour: number;
  categoryIds: string[];
  active: boolean;
}

export interface ChannelPrice {
  menuItemId: string;
  channel: "dine_in" | "online" | "delivery" | "kiosk";
  priceCents: number;
}

export interface Bundle {
  id: string;
  name: string;
  priceCents: number;
  itemIds: string[];
  active: boolean;
}

export interface PrixFixe {
  id: string;
  name: string;
  courses: { course: string; choices: string[] }[];
  priceCents: number;
}

export interface WineCellarItem {
  id: string;
  name: string;
  bin: string;
  vintage: number;
  onHand: number;
  priceCents: number;
  glassPriceCents?: number;
}

export interface BottleService {
  id: string;
  name: string;
  priceCents: number;
  mixersIncluded: string[];
  minSpendCents: number;
}

export interface SectionAssignment {
  section: string;
  serverId: string | null;
  tableIds: string[];
}

export interface ForecastPoint {
  hour: number;
  covers: number;
  salesCents: number;
}

export interface AnomalyAlert {
  id: string;
  at: number;
  kind: string;
  detail: string;
  severity: "info" | "warn" | "critical";
  acknowledged: boolean;
}

export interface SafeDrop {
  id: string;
  at: number;
  amountCents: number;
  envelope: string;
  employeeId: string;
}

export interface PettyCashTxn {
  id: string;
  at: number;
  amountCents: number;
  memo: string;
  employeeId: string;
}

export interface PrepListItem {
  id: string;
  name: string;
  qty: number;
  unit: string;
  done: boolean;
  station: string;
}

export interface CycleCount {
  id: string;
  inventoryId: string;
  expected: number;
  counted: number | null;
  variance: number | null;
}

export interface GuestFeedback {
  id: string;
  at: number;
  score: number;
  comment: string;
  orderNumber?: number;
  channel: "table" | "online" | "sms";
}

export interface ReviewRequest {
  id: string;
  guestName: string;
  channel: "google" | "yelp" | "email";
  status: "queued" | "sent" | "responded";
  at: number;
}

export interface ReservationDeposit {
  reservationId: string;
  amountCents: number;
  status: "held" | "captured" | "released" | "forfeited";
  cardLast4: string;
}

export interface KioskSession {
  id: string;
  at: number;
  items: number;
  totalCents: number;
  completed: boolean;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  createdAt: number;
  lastUsedAt?: number;
  scopes: string[];
}

export interface ConfigVersion {
  id: string;
  label: string;
  at: number;
  author: string;
  notes: string;
}

export interface FranchiseRoyalty {
  locationId: string;
  period: string;
  salesCents: number;
  rate: number;
  amountCents: number;
  paid: boolean;
}

export interface BrandAudit {
  id: string;
  locationId: string;
  score: number;
  at: number;
  notes: string;
}

export interface PciChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface YouthLaborFlag {
  employeeId: string;
  maxHoursWeek: number;
  schoolNightCurfew: string;
}

export interface MysteryScore {
  id: string;
  at: number;
  score: number;
  category: string;
  notes: string;
}

export interface PerformanceScore {
  employeeId: string;
  salesIndex: number;
  tipIndex: number;
  voidRate: number;
  guestScore: number;
}

export interface FlashPL {
  salesCents: number;
  cogsCents: number;
  laborCents: number;
  primeCostPct: number;
  netEstimateCents: number;
}

export interface CourseSla {
  course: string;
  targetMinutes: number;
}

export interface PrivateRoom {
  id: string;
  name: string;
  capacity: number;
  minSpendCents: number;
  booked: boolean;
  eventName?: string;
}

export interface AllergenIncident {
  id: string;
  at: number;
  guestName: string;
  allergen: string;
  status: "open" | "escalated" | "closed";
}

export interface CorkageFee {
  enabled: boolean;
  feeCents: number;
  limitBottles: number;
}

export interface OverbookingRule {
  maxCovers: number;
  bufferPercent: number;
  currentBooked: number;
}

export interface PacingSlot {
  time: string;
  maxParties: number;
  booked: number;
}

export interface Localization {
  language: "en" | "es" | "zh" | "fr";
  currency: string;
  taxInclusive: boolean;
}

export interface FullPackageStateMeta {
  phasesCompleted: PackagePhase[];
  trainingMode: boolean;
  lastPhaseAt: number;
}
