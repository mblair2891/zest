import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import type { TicketStation } from "./types";
import type {
  AddLinesInput,
  FloorCheck,
  FloorLine,
  FloorPayment,
  FloorTableStatus,
  FloorTicket,
  OdsActionInput,
  OpenFloor,
  RecordPaymentInput,
  SendToStationsInput,
  UpsertCheckInput,
  UpsertTableStatusInput,
} from "./floor-types";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

function clip(raw: unknown, max: number): string {
  return String(raw ?? "").trim().slice(0, max);
}

export const listOpenFloorFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({
    locationId: loc(d.locationId),
  }))
  .handler(async ({ context, data }): Promise<OpenFloor> => {
    const { listOpenFloor } = await import("./floor.server");
    return listOpenFloor(context.userId, data.locationId);
  });

export const listStationTicketsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string; station: TicketStation; operatorId?: string | null }) => ({
    locationId: loc(d.locationId),
    station: clip(d.station, 24) as TicketStation,
    operatorId: d.operatorId ? clip(d.operatorId, 80) : null,
  }))
  .handler(async ({ context, data }) => {
    const { listStationTickets } = await import("./floor.server");
    return listStationTickets(
      context.userId,
      data.locationId,
      data.station,
      data.operatorId,
    );
  });

export const upsertCheckFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: UpsertCheckInput) => ({
    locationId: loc(d.locationId),
    check: d.check as FloorCheck,
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { upsertCheck } = await import("./floor.server");
    return upsertCheck(context.userId, data);
  });

export const addCheckLinesFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: AddLinesInput) => ({
    locationId: loc(d.locationId),
    checkId: clip(d.checkId, 80),
    lines: Array.isArray(d.lines) ? (d.lines as FloorLine[]) : [],
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { addCheckLines } = await import("./floor.server");
    return addCheckLines(context.userId, data);
  });

export const sendToStationsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: SendToStationsInput) => ({
    locationId: loc(d.locationId),
    checkId: clip(d.checkId, 80),
    tickets: Array.isArray(d.tickets) ? (d.tickets as FloorTicket[]) : [],
    table: d.table,
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    const { sendToStations } = await import("./floor.server");
    return sendToStations(context.userId, data);
  });

export const odsStartFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: OdsActionInput) => ({
    locationId: loc(d.locationId),
    ticketId: clip(d.ticketId, 80),
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    const { odsStart } = await import("./floor.server");
    return odsStart(context.userId, data);
  });

export const odsBumpFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: OdsActionInput) => ({
    locationId: loc(d.locationId),
    ticketId: clip(d.ticketId, 80),
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    const { odsBump } = await import("./floor.server");
    return odsBump(context.userId, data);
  });

export const odsReadyFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: OdsActionInput) => ({
    locationId: loc(d.locationId),
    ticketId: clip(d.ticketId, 80),
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    const { odsReady } = await import("./floor.server");
    return odsReady(context.userId, data);
  });

export const odsRecallFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: OdsActionInput) => ({
    locationId: loc(d.locationId),
    ticketId: clip(d.ticketId, 80),
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    const { odsRecall } = await import("./floor.server");
    return odsRecall(context.userId, data);
  });

export const recordCheckPaymentFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: RecordPaymentInput) => ({
    locationId: loc(d.locationId),
    checkId: clip(d.checkId, 80),
    payment: d.payment as FloorPayment,
    checkStatus: d.checkStatus,
    closedAt: d.closedAt,
    table: d.table,
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { recordPayment } = await import("./floor.server");
    return recordPayment(context.userId, data);
  });

export const upsertTableStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: UpsertTableStatusInput) => ({
    locationId: loc(d.locationId),
    table: d.table as FloorTableStatus,
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
  }))
  .handler(async ({ context, data }) => {
    const { upsertTableStatus } = await import("./floor.server");
    return upsertTableStatus(context.userId, data);
  });
