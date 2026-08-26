export type PaymentsMode = "sandbox" | "live";
export type LocationPaymentsMode = "inherit" | "sandbox" | "live";

export type CardPresentStatus =
  | "captured"
  | "declined"
  | "requires_terminal"
  | "requires_connection"
  | "unavailable"
  | "timeout";

export type PaymentsStatus = {
  locationId: string;
  mode: PaymentsMode;
  locationOverride: LocationPaymentsMode;
  platformDefault: PaymentsMode;
  lifecycleForcesSandbox: boolean;
  liveConfigured: boolean;
  liveReady: boolean;
  readers: { id: string; label: string; serial: string; status: string }[];
  hostBrand: string;
  message: string;
};

export type CardPresentResult = {
  ok: boolean;
  status: CardPresentStatus;
  sandbox: boolean;
  paymentId?: string;
  last4?: string | null;
  error?: string;
  hostBrand?: string;
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
};
