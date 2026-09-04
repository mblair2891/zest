export type PaymentsMode = "sandbox" | "live";
export type LocationPaymentsMode = "inherit" | "sandbox" | "live";

export type CardPresentStatus =
  | "captured"
  | "declined"
  | "requires_terminal"
  | "requires_connection"
  | "unavailable"
  | "timeout";

export type EntityMerchantStatus =
  | "not_started"
  | "sandbox"
  | "submitted"
  | "approved"
  | "live";

export type EntityMerchantView = {
  entityId: string;
  displayName: string;
  kind: "host" | "operator";
  status: EntityMerchantStatus;
  canCapture: boolean;
};

export type PaymentsStatus = {
  locationId: string;
  mode: PaymentsMode;
  locationOverride: LocationPaymentsMode;
  platformDefault: PaymentsMode;
  lifecycleForcesSandbox: boolean;
  liveConfigured: boolean;
  liveReady: boolean;
  hostPaymentsApproved?: boolean;
  /** Peer venue: every selling operator is ready. Host+tenants: host merchant ready. */
  sellingMerchantsReady?: boolean;
  operatingModel?: "single" | "host_operators" | "peer_venue";
  entityMerchants?: EntityMerchantView[];
  readers: { id: string; label: string; serial: string; status: string }[];
  hostBrand: string;
  message: string;
};

export type CardPresentSplit = {
  entityId: string;
  kind: "host" | "operator";
  displayName: string;
  merchandiseCents: number;
  taxCents: number;
  serviceCents: number;
  tipCents: number;
  amountCents: number;
};

export type CardPresentResult = {
  ok: boolean;
  status: CardPresentStatus;
  sandbox: boolean;
  paymentId?: string;
  last4?: string | null;
  error?: string;
  hostBrand?: string;
  splits?: CardPresentSplit[];
};

export type CardPresentInput = {
  orgId: string;
  locationId: string;
  amountCents: number;
  checkId?: string | null;
  hostBrand?: string | null;
  readerId?: string | null;
  clientMutationId?: string | null;
  /** Training/sandbox receipt only — never a PAN. Live ignores client last4. */
  sandboxLast4?: string | null;
  /** Per-entity shares of this tender. Guest still pays one check. */
  entities?: CardPresentSplit[] | null;
};
