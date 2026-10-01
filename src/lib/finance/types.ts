/**
 * Operations finance for one selling entity.
 * Summex is the POS of record. This is not a payroll processor.
 * There is no third-party POS connect.
 */

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type Account = {
  code: string;
  name: string;
  type: AccountType;
  group: string;
};

export type JournalSource =
  | "pos_day"
  | "cogs"
  | "ap"
  | "ap_pay"
  | "credit_memo"
  | "labor_accrual"
  | "inventory"
  | "deposit"
  | "occupancy";

export type JournalLine = {
  account: string;
  debitCents: number;
  creditCents: number;
  memo: string;
};

export type Journal = {
  id: string;
  entityId: string;
  locationId: string;
  source: JournalSource;
  businessDate: string;
  at: number;
  /** Training journals stay sandbox until the location is live. */
  sandbox: boolean;
  idempotencyKey: string;
  memo: string;
  lines: JournalLine[];
};

export type FinCategory = "food" | "bev" | "supplies" | "other";

export type FinSku = {
  id: string;
  entityId: string;
  name: string;
  unit: string;
  onHand: number;
  costCents: number;
  lastPayCents?: number;
  contractCents?: number;
  category: FinCategory;
};

export type FinRecipeLine = { skuId: string; qty: number; unit: string };

export type FinRecipe = {
  id: string;
  entityId: string;
  menuItemId: string;
  name: string;
  kind: "food" | "bev";
  yieldQty: number;
  wasteFactor: number;
  lines: FinRecipeLine[];
};

export type FinVendor = {
  id: string;
  entityId: string;
  name: string;
  terms?: string;
};

export type ApStatus = "draft" | "coded" | "pending" | "approved" | "posted" | "paid" | "void";

export type ApLine = {
  id: string;
  skuId: string;
  qty: number;
  unitCostCents: number;
  category: FinCategory;
  glAccount?: string;
};

export type ApInvoice = {
  id: string;
  entityId: string;
  vendorId: string;
  number: string;
  businessDate: string;
  status: ApStatus;
  creditMemo: boolean;
  poId?: string;
  /** Cost-module post already changed on-hand. The journal still books AP. */
  stockAlreadyApplied?: boolean;
  /** csv_email today. A live EDI connector is later. */
  connector: "manual" | "csv_email";
  lines: ApLine[];
  priceAlerts: string[];
};

export type PurchaseOrder = {
  id: string;
  entityId: string;
  vendorId: string;
  businessDate: string;
  status: "draft" | "sent" | "partial" | "received";
  lines: Array<{ skuId: string; qty: number; unitCostCents: number }>;
};

export type Receipt = {
  id: string;
  entityId: string;
  poId: string;
  businessDate: string;
  lines: Array<{ skuId: string; qty: number }>;
};

export type SaleRow = {
  id: string;
  menuItemId: string;
  qty: number;
  businessDate: string;
  kind: "food" | "bev";
  cashPriceCents: number;
  cardPriceCents: number;
  recipeCostCents: number;
};

export type TheoryRow = {
  skuId: string;
  businessDate: string;
  ounces: number;
};

export type CountRow = { skuId: string; businessDate: string; qty: number };
export type WasteRow = { skuId: string; businessDate: string; qty: number; reason: string };
export type TransferRow = {
  skuId: string;
  businessDate: string;
  qty: number;
  direction: "out" | "in";
  counterpartyId: string;
};

export type AvtAlert = {
  id: string;
  skuId: string;
  skuName: string;
  businessDate: string;
  theoretical: number;
  actual: number;
  /** Manager still picks the response. The flag is not an accusation. */
  summary: string;
};

export type BankLine = {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  matchedId?: string;
};

export type BankMatch = { bankId: string; targetId: string; kind: "payout" | "cash_drop" };

export type Deposit = {
  id: string;
  kind: "safe_drop" | "bank_deposit";
  cents: number;
  businessDate: string;
  at: number;
};

export type LaborBand = {
  id: string;
  minCents: number;
  maxCents: number | null;
  heads: Record<string, number>;
};

export type DraftShift = {
  role: string;
  heads: number;
  businessDate: string;
  start: string;
  end: string;
  status: "draft";
};

export type LogEntry = { id: string; at: number; businessDate: string; text: string };
export type StoreTask = { id: string; phase: "open" | "close"; label: string; done: boolean };

export type HistorySale = { businessDate: string; salesCents: number };

export type EntityBook = {
  entityId: string;
  locationId: string;
  seq: number;
  accounts: Account[];
  journals: Journal[];
  vendors: FinVendor[];
  skus: FinSku[];
  recipes: FinRecipe[];
  invoices: ApInvoice[];
  purchaseOrders: PurchaseOrder[];
  receipts: Receipt[];
  sales: SaleRow[];
  theory: TheoryRow[];
  counts: CountRow[];
  waste: WasteRow[];
  transfers: TransferRow[];
  alerts: AvtAlert[];
  bankLines: BankLine[];
  matches: BankMatch[];
  deposits: Deposit[];
  matrix: LaborBand[];
  drafts: DraftShift[];
  history: HistorySale[];
  logbook: LogEntry[];
  tasks: StoreTask[];
  /** Manager-entered accrual rate. Not a paycheck. */
  accrualWageCents: number;
};

export type PosTenders = {
  cashCents: number;
  cardCents: number;
  giftRedeemCents: number;
  otherCents: number;
};

export type RevenueShareLeg = {
  direction: "pay" | "receive";
  cents: number;
  counterpartyId: string;
};

export type PosDayInput = {
  entityId: string;
  locationId: string;
  businessDate: string;
  at: number;
  live: boolean;
  foodSalesCents: number;
  bevSalesCents: number;
  discountCents: number;
  compCents: number;
  taxCents: number;
  tipsCents: number;
  giftSoldCents: number;
  tenders: PosTenders;
  /** Signed. Positive means the drawer is over. */
  cashOverShortCents: number;
  revenueShare: RevenueShareLeg[];
};

export type Pnl = {
  entityId: string;
  businessDate: string;
  foodSalesCents: number;
  bevSalesCents: number;
  discountCents: number;
  compCents: number;
  netSalesCents: number;
  foodCogsCents: number;
  bevCogsCents: number;
  laborCents: number;
  primeCents: number;
  primePct: number | null;
  controllableExpenseCents: number;
  controllableProfitCents: number;
  occupancyCents: number;
  breakEvenSalesCents: number | null;
  sandboxExcluded: boolean;
};

export type MenuEngineRow = {
  menuItemId: string;
  name: string;
  qty: number;
  popularity: number;
  cashMarginCents: number;
  cardMarginCents: number;
  recipeCostCents: number;
  class: "star" | "plowhorse" | "puzzle" | "dog";
};

export type LaborPunch = {
  approved: boolean;
  minutes: number;
  wageCentsPerHour: number;
  businessDate: string;
  entityId: string;
};

export type IntradayLabor = {
  laborPct: number | null;
  rec: "recommend_cut" | "recommend_hold" | "recommend_add" | "none";
};
