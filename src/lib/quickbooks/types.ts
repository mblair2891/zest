/** Shared QuickBooks shapes. Safe to import from the browser and from tests. */

export type QboEnvironment = "sandbox" | "production" | "test";

export type PartyCents = {
  entityId: string;
  entityName: string;
  cents: number;
};

/** One selling entity’s books for one venue business date. */
export type QboEntityDay = {
  entityId: string;
  entityName: string;
  businessDate: string;
  foodCents: number;
  beverageCents: number;
  otherCents: number;
  discountCents: number;
  compCents: number;
  taxCents: number;
  tipsCents: number;
  cashCents: number;
  cardCents: number;
  otherTenderCents: number;
  /** Liability increase. Cash for a same-entity sale is already in the tenders. */
  giftIssuedCents: number;
  /** Another entity collected this issuance. */
  giftIssueFromPeer: PartyCents[];
  /** This entity collected a card issued by someone else. */
  giftSoldForPeer: PartyCents[];
  /** Redeemed here, and this entity issued the card. */
  giftRedeemedOwnCents: number;
  /** Another entity redeemed this entity’s card. */
  giftRedeemedByPeer: PartyCents[];
  /** This entity sold the merchandise against another entity’s card. */
  giftFulfilledForPeer: PartyCents[];
  /** Expired residual. Liability down, other sales up. */
  giftResidualCents: number;
};

export type QboCheckLine = {
  entityId: string;
  name: string;
  station: string;
  course: string;
  quantity: number;
  unitPriceCents: number;
  modifierCents: number;
  discountCents: number;
  voided: boolean;
  comped: boolean;
  sent: boolean;
};

export type QboCheckIn = {
  id: string;
  closedAtMs: number;
  discountCents: number;
  serviceChargeCents: number;
  lines: QboCheckLine[];
  payments: Array<{ method: string; amountCents: number; tipCents: number }>;
};

export type QboGiftIn = {
  kind: string;
  amountCents: number;
  issuerId: string;
  counterpartyId: string | null;
  tender: string | null;
  checkId: string | null;
  atMs: number;
};

export type QboJournalLine = {
  accountCode: string;
  entityId: string;
  entityName: string;
  debitCents: number;
  creditCents: number;
  description: string;
};

export type QboJournalDraft = {
  scope: "entity" | "location";
  entityId: string;
  businessDate: string;
  docNumber: string;
  privateNote: string;
  lines: QboJournalLine[];
};

export type AccountMap = Record<string, { qboId: string; qboName: string }>;

export type QboClassRef = { id: string; name: string };

export type QboConnectionView = {
  id: string;
  entityId: string;
  companyName: string;
  realmId: string;
  environment: QboEnvironment;
  autoSync: boolean;
  status: string;
  lastError: string | null;
  connectedAt: number;
};

export type QboLogView = {
  id: string;
  at: number;
  connectionId: string | null;
  entityId: string;
  businessDate: string;
  trigger: string;
  status: string;
  attempt: number;
  docNumber: string | null;
  qboId: string | null;
  error: string | null;
  summary: string | null;
};

export type QboPostedView = {
  id: string;
  connectionId: string;
  businessDate: string;
  docNumber: string;
  qboId: string | null;
  lines: QboJournalLine[];
};

export type QboOverview = {
  intuitConfigured: boolean;
  intuitEnvironment: "sandbox" | "production";
  /** Null when this login can see every company. Otherwise only that entity. */
  scopeEntityId: string | null;
  entities: Array<{ id: string; name: string }>;
  connections: QboConnectionView[];
  accounts: Array<{ connectionId: string; id: string; name: string; accountType: string }>;
  maps: Array<{ connectionId: string; code: string; qboAccountId: string; qboAccountName: string }>;
  classes: Array<{ connectionId: string; id: string; name: string }>;
  classMaps: Array<{ connectionId: string; entityId: string; classId: string; className: string }>;
  logs: QboLogView[];
  posted: QboPostedView[];
  requiredAccounts: Array<{ code: string; name: string }>;
};

export type QboSyncResult = {
  ok: boolean;
  status: "posted" | "skipped" | "error";
  message: string;
  docNumber: string | null;
  lines: QboJournalLine[];
};
