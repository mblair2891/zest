import type {
  Course,
  Customer,
  Employee,
  EmployeeRole,
  ExtraTableGrant,
  ExtraTableGrantScope,
  FloorSection,
  GiftCard,
  GiftCardStatus,
  GiftTransfer,
  InventoryItem,
  KitchenTicket,
  MenuCategory,
  MenuItem,
  ModifierGroup,
  Order,
  PaymentMethod,
  PosView,
  Reservation,
  RestaurantSettings,
  SectionAccess,
  SectionPolicy,
  Chargeback,
  ChargebackStatus,
  SettlementConfig,
  SettlementPeriod,
  Table,
  TableStatus,
  TicketStation,
  Vendor,
  VenueEntityId,
  WaitlistEntry,
} from "./types";
import type { GiftImportPreview } from "./gift-import";
import type {
  ApprovalGateKind,
  ApprovalPath,
  PendingApproval,
} from "./loss-prevention";

export interface AuditEntry {
  id: string;
  at: number;
  employeeId: string;
  employeeName: string;
  action: string;
  detail: string;
  overrideEmployeeId?: string;
  overrideEmployeeName?: string;
  deviceId?: string;
  deviceRole?: string;
  entityId?: string;
  ticketId?: string;
  orderId?: string;
  orderNumber?: number;
  amountCents?: number;
  reason?: string;
  before?: string;
  after?: string;
  requesterId?: string;
  requesterName?: string;
  approvalStatus?: "pending" | "approved" | "denied" | "break_glass";
}

export type AuditMeta = {
  overrideEmployeeId?: string;
  overrideEmployeeName?: string;
  deviceId?: string;
  deviceRole?: string;
  entityId?: string;
  ticketId?: string;
  orderId?: string;
  orderNumber?: number;
  amountCents?: number;
  reason?: string;
  before?: string;
  after?: string;
  requesterId?: string;
  requesterName?: string;
  approvalStatus?: "pending" | "approved" | "denied" | "break_glass";
};

export interface ShiftState {
  id: string;
  openedAt: number;
  openingFloatCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  giftSalesCents: number;
  compsCents: number;
  voidsCents: number;
  tipsCashCents: number;
  tipsCardCents: number;
  orderCount: number;
  guestCount: number;
  closedAt?: number;
  closingCashCents?: number;
}

export type ActionResult<T = object> = {
  ok: boolean;
  error?: string;
  access?: SectionAccess;
} & T;

export interface PosStore {
  settings: RestaurantSettings;
  employees: Employee[];
  currentEmployeeId: string | null;
  categories: MenuCategory[];
  menuItems: MenuItem[];
  modifierGroups: ModifierGroup[];
  tables: Table[];
  orders: Order[];
  tickets: KitchenTicket[];
  waitlist: WaitlistEntry[];
  reservations: Reservation[];
  customers: Customer[];
  giftCards: GiftCard[];
  giftTransfers: GiftTransfer[];
  inventory: InventoryItem[];
  vendors: Vendor[];
  settlementConfig: SettlementConfig;
  settlementPeriods: SettlementPeriod[];
  chargebacks: Chargeback[];
  ledgerEntries: import("./ledger").LedgerEntry[];
  auditLog: AuditEntry[];
  shift: ShiftState;
  view: PosView;
  activeOrderId: string | null;
  activeTableId: string | null;
  selectedCategoryId: string | null;
  selectedLineId: string | null;
  activeSeat: number | null;
  clock: number;
  floorSections: FloorSection[];
  extraTableGrants: ExtraTableGrant[];
  sectionOverrides: Record<string, string[]>;
  activeEntityId: VenueEntityId;

  login: (pin: string) => ActionResult;
  loginAs: (employeeId: string, opts?: { kind?: "pin" | "backoffice" }) => ActionResult;
  logout: () => void;
  sessionKind: "pin" | "backoffice";
  backOfficeUnlocked: boolean;
  stationPinFailures: number;
  stationPinLocked: boolean;
  managerAuthUntil: number | null;
  managerAuthEmployeeId: string | null;
  managerAuthEmployeeName: string | null;
  managerAuthKind: "manager" | "shift_lead" | null;
  managerAuthRole: string | null;
  acknowledgedExceptionIds: string[];
  pendingApprovals: PendingApproval[];
  setStaffPin: (employeeId: string, pin: string) => ActionResult;
  unlockBackOffice: (secret: string) => ActionResult;
  lockBackOffice: () => void;
  verifyManagerPin: (pin: string) => boolean;
  hasManagerAuth: () => boolean;
  authorizeManager: (pin: string) => ActionResult<{ employeeId?: string; employeeName?: string }>;
  authorizeForGate: (
    pin: string,
    kind: ApprovalGateKind,
    amountCents: number,
  ) => ActionResult<{ employeeId?: string; employeeName?: string; path?: ApprovalPath }>;
  canAuthorizeGate: (kind: ApprovalGateKind, amountCents: number) => boolean;
  beginManagerSession: (emp: { id: string; name: string; kind?: "manager" | "shift_lead"; role?: string }) => void;
  requestApproval: (input: {
    kind: ApprovalGateKind;
    reason: string;
    amountCents: number;
    orderId?: string;
    orderNumber?: number;
    lineId?: string;
    ticketId?: string;
    lineWasSent?: boolean;
    ticketFired?: boolean;
    payload?: PendingApproval["payload"];
  }) => ActionResult<{ pendingId?: string }>;
  resolveApproval: (
    id: string,
    decision: "approved" | "denied",
    opts?: { remote?: boolean },
  ) => ActionResult;
  breakGlass: (pin: string, reason: string) => ActionResult<{ employeeId?: string; employeeName?: string }>;
  notePinFailure: () => ActionResult;
  unlockStationPin: () => void;
  resetStaffPinLock: (employeeId: string) => ActionResult;
  acknowledgeException: (id: string) => void;
  clockToggle: (employeeId: string) => void;
  tick: () => void;
  setView: (v: PosView) => void;
  setCategory: (id: string | null) => void;
  setSelectedLine: (id: string | null) => void;
  setActiveSeat: (n: number | null) => void;
  setActiveOrder: (id: string | null) => ActionResult;
  getCurrentEmployee: () => Employee | null;
  getActiveOrder: () => Order | undefined;
  audit: (action: string, detail: string, meta?: AuditMeta) => void;
  updateSettings: (patch: Partial<RestaurantSettings>) => void;
  tableAccess: (
    tableId: string,
    action?: "view" | "order" | "seat",
  ) => SectionAccess;
  selectTable: (tableId: string) => ActionResult<{ access?: SectionAccess }>;
  seatTable: (
    tableId: string,
    guestCount: number,
    opts?: { serverId?: string },
  ) => ActionResult;
  releaseTable: (
    tableId: string,
    opts:
      | { toEmployeeId: string }
      | { hold: import("./check-integrity").CheckHoldKind; reason: string; house?: boolean },
  ) => ActionResult;
  acceptTable: (tableId: string) => ActionResult;
  reassignTable: (tableId: string, serverId: string) => ActionResult;
  holdCheck: (
    orderId: string,
    hold: import("./check-integrity").CheckHoldKind,
    reason: string,
    opts?: { house?: boolean; clearTable?: boolean },
  ) => ActionResult;
  markClean: (tableId: string) => ActionResult;
  setTableStatus: (tableId: string, status: TableStatus) => ActionResult;
  guestOpenTable: (tableId: string) => ActionResult;
  guestAddToTable: (tableId: string, menuItemId: string) => ActionResult;
  guestSendOrder: (tableId: string) => ActionResult;
  guestPayOrder: (orderId: string) => ActionResult;
  rotateTableQr: (tableId: string) => ActionResult<{ token?: string }>;
  clearTable: (tableId: string) => void;
  transferTable: (fromId: string, toId: string) => ActionResult;
  mergeTables: (primaryId: string, childId: string) => ActionResult;
  combineTables: (tableIds: string[]) => ActionResult;
  unmergeTable: (tableId: string) => ActionResult;
  splitCheck: (
    orderId: string,
    spec: import("./check-ops").SplitSpec,
  ) => ActionResult<{ newOrderIds?: string[] }>;
  combineChecks: (sourceId: string, targetId: string) => ActionResult;
  moveLines: (
    sourceId: string,
    targetId: string,
    lineIds: string[],
    destTableId?: string | null,
  ) => ActionResult;
  moveCheck: (orderId: string, destTableId: string) => ActionResult;
  openBarTab: (name: string, guestCount?: number) => string;
  openTakeout: (name: string) => string;
  addItem: (
    menuItemId: string,
    opts?: {
      quantity?: number;
      modifiers?: Order["lines"][number]["modifiers"];
      note?: string;
      seat?: number;
    },
  ) => ActionResult;
  updateLineQty: (lineId: string, delta: number) => void;
  setLineNote: (lineId: string, note: string) => void;
  setLineSeat: (lineId: string, seat: number) => void;
  voidLine: (
    lineId: string,
    reason: string,
    opts?: { skipGate?: boolean; path?: ApprovalPath; approval?: PendingApproval; orderId?: string },
  ) => ActionResult;
  compLine: (
    lineId: string,
    reason: string,
    opts?: { skipGate?: boolean; path?: ApprovalPath; approval?: PendingApproval; orderId?: string },
  ) => ActionResult;
  holdLine: (lineId: string, held: boolean) => void;
  sendOrder: (opts?: object) => ActionResult;
  fireCourse: (course: string) => void;
  applyDiscount: (opts: {
    percent?: number;
    cents?: number;
    reason?: string;
    promoCode?: string;
    skipGate?: boolean;
    path?: ApprovalPath;
    approval?: PendingApproval;
  }) => ActionResult;
  reopenCheck: (
    orderId: string,
    reason: string,
    opts?: { skipGate?: boolean; path?: ApprovalPath; approval?: PendingApproval },
  ) => ActionResult;
  swapTender: (opts: {
    orderId: string;
    paymentId: string;
    method: PaymentMethod;
    reason: string;
    last4?: string;
    giftCardCode?: string;
    skipGate?: boolean;
    path?: ApprovalPath;
    approval?: PendingApproval;
  }) => ActionResult;
  adjustGiftBalance: (opts: {
    code: string;
    deltaCents: number;
    reason: string;
    skipGate?: boolean;
    path?: ApprovalPath;
    approval?: PendingApproval;
  }) => ActionResult;
  setOrderNote: (note: string) => void;
  printCheck: () => void;
  takePayment: (opts: {
    method: PaymentMethod;
    amountCents: number;
    tipCents?: number;
    tenderedCents?: number;
    last4?: string;
    giftCardCode?: string;
    houseAccountId?: string;
    serverGift?: boolean;
  }) => ActionResult<{ changeCents?: number }>;
  closeOrderIfPaid: () => void;
  bumpTicket: (ticketId: string) => void;
  recallTicket: (ticketId: string) => void;
  startTicket: (ticketId: string) => void;
  readyTicket: (ticketId: string) => void;
  deliverReadyTicketsForTable: (tableId: string) => void;
  addWaitlist: (entry: Partial<WaitlistEntry>) => void;
  updateWaitlistStatus: (
    id: string,
    status: WaitlistEntry["status"],
  ) => void;
  seatFromWaitlist: (waitId: string, tableId: string) => ActionResult;
  addReservation: (entry: Partial<Reservation>) => void;
  updateReservationStatus: (
    id: string,
    status: Reservation["status"],
  ) => void;
  addCustomer: (c: Partial<Customer>) => void;
  issueGiftCard: (opts: {
    amountCents: number;
    code?: string;
    issuedToName?: string;
    issuerId?: string;
    tender?: "cash" | "card";
  }) => ActionResult<{ card?: GiftCard; code?: string }>;
  processGiftBreakage: () => ActionResult<{ processed?: number }>;
  reloadGiftCard: (code: string, amountCents: number) => ActionResult;
  setGiftCardStatus: (
    code: string,
    status: GiftCardStatus,
    opts?: { skipGate?: boolean; path?: ApprovalPath; approval?: PendingApproval },
  ) => ActionResult;
  importGiftCards: (
    preview: GiftImportPreview,
    opts: { overwrite?: boolean },
  ) => ActionResult<{ imported?: number; skipped?: number }>;
  adjustLoyalty: (customerId: string, deltaPoints: number) => void;
  setCustomerTier: (customerId: string, tier: string) => void;
  setCustomerMarketingOptIn: (customerId: string, optIn: boolean) => void;
  toggleItemAvailable: (id: string) => void;
  createCategory: (input: {
    name: string;
    station?: TicketStation;
  }) => { id: string };
  createMenuItem: (input: {
    name: string;
    description?: string;
    priceCents: number;
    categoryId: string;
    station?: TicketStation;
    vendorId?: string;
    course?: Course;
    modifierGroupIds?: string[];
  }) => { id: string };
  createModifierGroup: (input: {
    name: string;
    required?: boolean;
    min?: number;
    max?: number;
    options: { name: string; priceCents: number }[];
  }) => { id: string };
  createVendor: (input: {
    name: string;
    shortName?: string;
    stationType?: "bar" | "kitchen" | "both";
    cuisine?: string;
    bankLast4?: string;
    bankLabel?: string;
  }) => { id: string };
  updateVendor: (
    id: string,
    patch: Partial<Pick<Vendor, "name" | "shortName" | "stationType" | "stationLabel" | "cuisine" | "bankLast4" | "bankLabel" | "active">>,
  ) => void;
  createEmployee: (input: {
    name: string;
    role: EmployeeRole;
    pin?: string;
    operatorId?: string;
    title?: string;
  }) => { id: string; pin: string };
  receiveInventory: (id: string, qty: number) => void;
  updateInventory: (id: string, patch: Partial<InventoryItem>) => void;
  updateTableLayout: (id: string, patch: Partial<Table>) => void;
  addFloorTable: (partial?: Partial<Table>) => string;
  removeFloorTable: (id: string) => ActionResult;
  openShift: (floatCents: number) => void;
  closeShift: (
    closingCashCents: number,
    opts?: { ackReason?: string },
  ) => ActionResult<{ issues?: number }>;
  updateSettlementConfig: (patch: Partial<SettlementConfig>) => void;
  getOpenPeriodPreview: () => SettlementPeriod | null;
  closeSettlementPeriod: () => ActionResult<{ period?: SettlementPeriod }>;
  markSettlementPaid: (periodId: string) => void;
  fileChargeback: (orderId: string) => ActionResult<{ chargeback?: Chargeback }>;
  postLedger: (entries: import("./ledger").LedgerEntry[]) => void;
  resolveChargeback: (
    id: string,
    outcome: ChargebackStatus,
  ) => ActionResult;
  reassignServer: (tableId: string, serverId: string) => void;
  assignEmployeeSections: (employeeId: string, sectionIds: string[]) => void;
  upsertFloorSection: (section: Partial<FloorSection> & { id?: string }) => void;
  removeFloorSection: (id: string) => ActionResult;
  updateSectionPolicy: (patch: Partial<SectionPolicy>) => void;
  grantExtraTable: (opts: {
    employeeId: string;
    tableId: string;
    scope: ExtraTableGrantScope;
    reason?: string;
  }) => ActionResult<{ grant?: ExtraTableGrant }>;
  revokeExtraTable: (id: string) => void;
  overrideSectionTable: (employeeId: string, tableId: string) => ActionResult;
  entityPermissions: import("@/lib/access/entity-grants").EntityGrantRow[];
  locationDevices: import("./location-devices").LocationDevice[];
  activeDeviceId: string | null;
  setEntityGrant: (
    subjectOperatorId: string,
    targetOperatorId: string,
    patch: Partial<import("@/lib/access/entity-grants").EntityGrantFlags>,
  ) => void;
  setLocationDeviceAssignment: (
    id: string,
    assignment: import("./location-devices").DeviceAssignment,
  ) => void;
  enrollLocationDevice: (input: {
    label: string;
    type: import("./location-devices").LocationDeviceType;
    assignment: import("./location-devices").DeviceAssignment;
    serial?: string;
  }) => { id: string; claimCode: string };
  setActiveDeviceId: (id: string | null) => void;
  updateMenuItem: (
    id: string,
    patch: Partial<Pick<MenuItem, "name" | "priceCents" | "description" | "available" | "vendorId" | "categoryId" | "station" | "course" | "modifierGroupIds">>,
  ) => void;
  deleteMenuItem: (id: string) => void;
  applyEntity: (entityId: VenueEntityId) => ActionResult;
  /** DEV_DEMO only. Reloads The Laundry host + Steam Distillery + Diamond House BBQ. */
  loadLaundryTestVenue: () => ActionResult;
  /** Isolated prospect demo (separate persist keys). Never writes tenant POS. */
  loadProspectDemo: (entityId: VenueEntityId) => ActionResult;
  openTenantLocation: (opts: {
    entityId: VenueEntityId;
    venueName: string;
    ownerName: string;
    locationId: string;
    menuMode?: import("./starter-seed").TenantMenuMode;
    vendors?: import("./types").Vendor[];
    tables?: import("./types").Table[];
    floorSections?: import("./types").FloorSection[];
    settlement?: Partial<import("./types").SettlementConfig>;
    address?: string;
    hallMode?: boolean;
    staff?: { role: EmployeeRole; operatorId?: string | null; name: string };
    entityPermissions?: import("@/lib/access/entity-grants").EntityGrantRow[];
    locationDevices?: import("./location-devices").LocationDevice[];
    floorStaff?: import("./types").Employee[];
    pinGate?: boolean;
  }) => ActionResult;
  tenantLocationId?: string | null;
  loginAsOwner: (name: string) => ActionResult;
  resetDemo: () => void;
}

export type PosStorePersist = {
  persist: {
    rehydrate: () => void | Promise<void>;
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};
