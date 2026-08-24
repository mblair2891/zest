import { enqueueMutation } from "@/lib/pos/network-store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { tenantOrgId } from "./scope";

export function noteCashPayment(opts: {
  orderId: string;
  orderNumber: number | string;
  amountCents: number;
  paymentId: string;
}): void {
  enqueueMutation(
    "cash_ledger",
    `Cash · check #${opts.orderNumber}`,
    "Ledger queued — will post once without double-capture",
    {
      orderId: opts.orderId,
      paymentId: opts.paymentId,
      amountCents: opts.amountCents,
      orgId: tenantOrgId(),
      locationId: undefined,
    },
    { amountCents: opts.amountCents },
  );
}

export function noteOrderSent(opts: { orderId: string; orderNumber: number | string; ticketIds: string[] }): void {
  enqueueMutation("ticket_upsert", `Tickets · #${opts.orderNumber}`, "Kitchen/bar queue is local; cloud copy on reconnect", {
    orderId: opts.orderId,
    ticketIds: opts.ticketIds,
  });
}

export function noteTicketBump(opts: { ticketId: string; orderNumber?: number | string }): void {
  enqueueMutation("ticket_bump", `Bump · ${opts.ticketId.slice(-6)}`, "Station bump stored locally", {
    ticketId: opts.ticketId,
    orderNumber: opts.orderNumber,
  });
}

export function noteTableSeat(opts: { tableId: string; guestCount: number }): void {
  enqueueMutation("table_seat", `Seat ${opts.tableId}`, "Floor assignment cached on this device", {
    tableId: opts.tableId,
    guestCount: opts.guestCount,
  });
}

export function noteWaitlistAdd(opts: {
  id: string;
  name: string;
  phone?: string;
  partySize: number;
  smsPending: boolean;
}): void {
  enqueueMutation("waitlist_add", `Waitlist · ${opts.name}`, opts.smsPending ? "SMS pending send" : "Local queue", {
    id: opts.id,
    name: opts.name,
    phone: opts.phone,
    partySize: opts.partySize,
  });
  if (opts.smsPending && opts.phone) {
    enqueueMutation("waitlist_sms", `SMS · ${opts.name}`, "Pending send until internet returns", {
      phone: opts.phone,
      body: `${opts.name}, you're on the waitlist (${opts.partySize}). We'll text when a table is ready.`,
    });
  }
}

export function cardRequiresConnection(): boolean {
  return !useNetworkStore.getState().wanOnline();
}
