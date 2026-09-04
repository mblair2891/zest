import type { PrintStation, PrinterConfig, PrinterConnection, PrinterFamily } from "@/lib/pos/location-devices";

export type PrintJobKind = "ticket" | "receipt" | "test" | "drawer_kick";

export type PrintLine = {
  qty: number;
  name: string;
  mods?: string[];
  note?: string;
  seat?: number;
  vendorId?: string | null;
  vendorName?: string | null;
  amountCents?: number;
};

export type PrintAllocation = {
  name: string;
  merchandiseCents: number;
  feesCents: number;
  totalCents: number;
};

export type PrintJob = {
  id: string;
  kind: PrintJobKind;
  station: PrintStation;
  locationId: string;
  locationName: string;
  checkId: string;
  checkNumber: number | string;
  tableLabel: string;
  serverName: string;
  operatorId?: string | null;
  operatorName?: string | null;
  copy?: "guest" | "merchant";
  items: PrintLine[];
  allocations?: PrintAllocation[];
  totals?: {
    subtotalCents: number;
    taxCents: number;
    tipCents?: number;
    giftCents?: number;
    totalCents: number;
    tender?: string;
  };
  at: number;
};

export type PrintTarget = {
  printerId: string;
  printerLabel: string;
  config: PrinterConfig;
};

export type AgentPrintRequest = {
  locationId: string;
  printerId: string;
  family: PrinterFamily;
  connection: PrinterConnection;
  target: string;
  job: PrintJob;
  escposBase64: string;
};

export const DEFAULT_PRINT_AGENT_URL = "http://127.0.0.1:9105";
