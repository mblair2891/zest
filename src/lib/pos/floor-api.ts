import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import { floorSessionMiddleware } from "./floor-session";
import { assertPinAction, parsePinRole, type PinAction } from "@/lib/access/pin-role";
import { parseStationQuery } from "@/lib/pos/device-roles";
import type { TicketStation } from "./types";
import type {
  AddLinesInput,
  FloorActor,
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

function assertFloorActor(actor: FloorActor | undefined, action: PinAction): void {
  if (!actor?.role) return;
  const role = parsePinRole(actor.role);
  assertPinAction(role, action, { deviceRole: parseStationQuery(actor.deviceRole) });
}

function stationInput(d: { stationDeviceId?: string; stationPin?: string }): {
  stationDeviceId: string;
  stationPin: string;
} {
  return {
    stationDeviceId: clip(d.stationDeviceId, 80),
    stationPin: String(d.stationPin ?? "").replace(/\D/g, "").slice(0, 8),
  };
}

async function stationOrUser(
  userId: string | null,
  data: { locationId: string; stationDeviceId?: string; stationPin?: string },
) {
  if (userId) return { userId, grant: null as null };
  const { authorizeStationFloor } = await import("./station-pin-auth.server");
  const { UnauthorizedError } = await import("@/lib/auth/verify.server");
  const result = await authorizeStationFloor({
    pin: data.stationPin || "",
    deviceId: data.stationDeviceId || "",
    locationId: data.locationId,
  });
  if (!result.ok) {
    const err = new UnauthorizedError();
    if (result.error) err.message = result.error;
    throw err;
  }
  return { userId: "", grant: result.grant };
}

export const listOpenFloorFn = createServerFn({ method: "POST" })
  .middleware([floorSessionMiddleware])
  .validator((d: { locationId: string; stationDeviceId?: string; stationPin?: string }) => ({
    locationId: loc(d.locationId),
    ...stationInput(d),
  }))
  .handler(async ({ context, data }): Promise<OpenFloor> => {
    const { listOpenFloor } = await import("./floor.server");
    const caller = await stationOrUser(context.userId, data);
    return listOpenFloor(caller.userId, data.locationId, caller.grant);
  });

export const listStationTicketsFn = createServerFn({ method: "POST" })
  .middleware([floorSessionMiddleware])
  .validator((d: {
    locationId: string;
    station: TicketStation;
    operatorId?: string | null;
    stationDeviceId?: string;
    stationPin?: string;
  }) => ({
    locationId: loc(d.locationId),
    station: clip(d.station, 24) as TicketStation,
    operatorId: d.operatorId ? clip(d.operatorId, 80) : null,
    ...stationInput(d),
  }))
  .handler(async ({ context, data }) => {
    const { listStationTickets } = await import("./floor.server");
    const caller = await stationOrUser(context.userId, data);
    return listStationTickets(
      caller.userId,
      data.locationId,
      data.station,
      data.operatorId,
      caller.grant,
    );
  });

export const upsertCheckFn = createServerFn({ method: "POST" })
  .middleware([floorSessionMiddleware])
  .validator((d: UpsertCheckInput & { stationDeviceId?: string; stationPin?: string }) => ({
    locationId: loc(d.locationId),
    check: d.check as FloorCheck,
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
    ...stationInput(d),
  }))
  .handler(async ({ context, data }) => {
    assertFloorActor(data.actor, "orders.create");
    const { upsertCheck } = await import("./floor.server");
    const caller = await stationOrUser(context.userId, data);
    return upsertCheck(caller.userId, data, caller.grant);
  });

export const addCheckLinesFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: AddLinesInput) => ({
    locationId: loc(d.locationId),
    checkId: clip(d.checkId, 80),
    lines: Array.isArray(d.lines) ? (d.lines as FloorLine[]) : [],
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    assertFloorActor(data.actor, "orders.create");
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
    assertFloorActor(data.actor, "orders.send");
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
    assertFloorActor(data.actor, "ods.start");
    const { odsStart } = await import("./floor.server");
    return odsStart(context.userId, data);
  });

export const odsBumpFn = createServerFn({ method: "POST" })
  .middleware([floorSessionMiddleware])
  .validator((d: OdsActionInput & { stationDeviceId?: string; stationPin?: string }) => ({
    locationId: loc(d.locationId),
    ticketId: clip(d.ticketId, 80),
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
    ...stationInput(d),
  }))
  .handler(async ({ context, data }) => {
    assertFloorActor(data.actor, "ods.bump");
    const { odsBump } = await import("./floor.server");
    const caller = await stationOrUser(context.userId, data);
    return odsBump(caller.userId, data, caller.grant);
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
    assertFloorActor(data.actor, "ods.bump");
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
    assertFloorActor(data.actor, "ods.bump");
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
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    assertFloorActor(data.actor, "payments.take");
    const { recordPayment } = await import("./floor.server");
    return recordPayment(context.userId, data);
  });

export const upsertTableStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: UpsertTableStatusInput) => ({
    locationId: loc(d.locationId),
    table: d.table as FloorTableStatus,
    clientMutationId: d.clientMutationId ? clip(d.clientMutationId, 80) : undefined,
    actor: d.actor,
  }))
  .handler(async ({ context, data }) => {
    const status = String(data.table?.status ?? "");
    const action =
      status === "dirty" || status === "available"
        ? "table.bus"
        : status === "seated" || status === "reserved"
          ? "table.seat"
          : "table.transfer";
    assertFloorActor(data.actor, action);
    const { upsertTableStatus } = await import("./floor.server");
    return upsertTableStatus(context.userId, data);
  });

export const setItem86Fn = createServerFn({ method: "POST" })
  .middleware([floorSessionMiddleware])
  .validator((d: {
    locationId: string;
    itemId: string;
    available: boolean;
    vendorId?: string | null;
    actor?: FloorActor;
    stationDeviceId?: string;
    stationPin?: string;
  }) => ({
    locationId: loc(d.locationId),
    itemId: clip(d.itemId, 80),
    available: d.available !== false,
    vendorId: d.vendorId ? clip(d.vendorId, 80) : null,
    actor: d.actor,
    ...stationInput(d),
  }))
  .handler(async ({ context, data }) => {
    assertFloorActor(data.actor, "item.86");
    const { setItem86 } = await import("./floor.server");
    const caller = await stationOrUser(context.userId, data);
    return setItem86(caller.userId, data, caller.grant);
  });
