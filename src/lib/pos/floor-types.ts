import type {
  Course,
  OrderStatus,
  OrderType,
  PaymentMethod,
  SelectedModifier,
  TableStatus,
  TicketStation,
  TicketStatus,
} from "./types";

/** Line lifecycle on the shared floor. Draft = not yet sent to a station. */
export type FloorLineStatus = "draft" | "sent" | "started" | "ready" | "delivered";

export type FloorActor = {
  employeeId: string;
  employeeName: string;
};

export type FloorLine = {
  id: string;
  menuItemId: string;
  name: string;
  operatorId: string | null;
  vendorName: string | null;
  quantity: number;
  unitPriceCents: number;
  modifiers: SelectedModifier[];
  note: string | null;
  seat: number | null;
  course: Course;
  station: TicketStation;
  itemStatus: FloorLineStatus;
  sent: boolean;
  held: boolean;
  voided: boolean;
  comped: boolean;
  discountCents: number;
  taxExempt: boolean;
  ticketId: string | null;
  createdAt: number;
  firedAt: number | null;
};

export type FloorPayment = {
  id: string;
  method: PaymentMethod;
  amountCents: number;
  tipCents: number;
  tenderedCents?: number;
  changeCents?: number;
  last4?: string;
  giftCardCode?: string;
  houseAccountId?: string;
  at: number;
  employeeId: string;
  processor?: "quantum_payments" | "zest_payments";
  chargeBrand?: string;
  sandbox?: boolean;
};

export type FloorCheck = {
  id: string;
  locationId: string;
  tableId: string | null;
  tabName: string | null;
  number: number;
  type: OrderType;
  status: OrderStatus;
  serverId: string;
  serverName: string;
  guestCount: number;
  discountPercent: number;
  discountCents: number;
  autoGratApplied: boolean;
  serviceChargeCents: number;
  note: string | null;
  checkPrintedAt: number | null;
  mergedTableIds: string[];
  lines: FloorLine[];
  payments: FloorPayment[];
  createdAt: number;
  updatedAt: number;
  closedAt: number | null;
};

export type FloorTicketItem = {
  lineId: string;
  name: string;
  quantity: number;
  modifiers: string[];
  note?: string;
  course: Course;
  seat?: number;
};

export type FloorTicket = {
  id: string;
  locationId: string;
  orderId: string;
  orderNumber: number;
  tableLabel: string;
  serverName: string;
  serverId?: string;
  station: TicketStation;
  operatorId: string | null;
  vendorName: string | null;
  status: TicketStatus;
  course: Course;
  createdAt: number;
  elapsedSec: number;
  bumpedAt?: number;
  startedAt?: number;
  items: FloorTicketItem[];
};

export type FloorTableStatus = {
  tableId: string;
  status: TableStatus;
  checkId: string | null;
  serverId: string | null;
  guestCount: number | null;
  seatedAt: number | null;
  statusSince: number;
};

export type FloorTicketEvent = {
  id: string;
  ticketId: string;
  checkId: string;
  kind: string;
  actorId: string | null;
  actorName: string | null;
  at: number;
};

export type OpenFloor = {
  locationId: string;
  checks: FloorCheck[];
  tickets: FloorTicket[];
  tables: FloorTableStatus[];
  events: FloorTicketEvent[];
  serverTime: number;
  operatorScoped: boolean;
};

export type UpsertCheckInput = {
  locationId: string;
  check: Omit<FloorCheck, "locationId" | "updatedAt"> & { updatedAt?: number };
  clientMutationId?: string;
};

export type AddLinesInput = {
  locationId: string;
  checkId: string;
  lines: FloorLine[];
  clientMutationId?: string;
};

export type SendToStationsInput = {
  locationId: string;
  checkId: string;
  tickets: FloorTicket[];
  table?: FloorTableStatus;
  clientMutationId?: string;
  actor?: FloorActor;
};

export type OdsActionInput = {
  locationId: string;
  ticketId: string;
  clientMutationId?: string;
  actor?: FloorActor;
};

export type RecordPaymentInput = {
  locationId: string;
  checkId: string;
  payment: FloorPayment;
  checkStatus?: OrderStatus;
  closedAt?: number | null;
  table?: FloorTableStatus;
  clientMutationId?: string;
};

export type UpsertTableStatusInput = {
  locationId: string;
  table: FloorTableStatus;
  clientMutationId?: string;
};
