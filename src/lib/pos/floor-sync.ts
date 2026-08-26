import { useEffect } from "react";
import { uid } from "@/lib/utils";
import { enqueueMutation, useNetworkStore } from "@/lib/pos/network-store";
import { usePosStore } from "@/lib/pos/store";
import type { KitchenTicket, Order, OrderLine, Payment, Table, TicketStation } from "@/lib/pos/types";
import type {
  FloorActor,
  FloorCheck,
  FloorLine,
  FloorLineStatus,
  FloorPayment,
  FloorTableStatus,
  FloorTicket,
  OpenFloor,
} from "./floor-types";
import {
  addCheckLinesFn,
  listOpenFloorFn,
  listStationTicketsFn,
  odsBumpFn,
  odsReadyFn,
  odsRecallFn,
  odsStartFn,
  recordCheckPaymentFn,
  sendToStationsFn,
  upsertCheckFn,
  upsertTableStatusFn,
} from "./floor-api";

const POLL_MS = 3000;
const LOCAL_GRACE_MS = 20_000;

const lineDebounce = new Map<string, ReturnType<typeof setTimeout>>();

function actor(): FloorActor | undefined {
  try {
    const emp = usePosStore.getState().getCurrentEmployee?.();
    if (!emp) return undefined;
    return { employeeId: emp.id, employeeName: emp.name };
  } catch {
    return undefined;
  }
}

function lineStatus(line: OrderLine, tickets: KitchenTicket[]): FloorLineStatus {
  if (!line.sent) return "draft";
  const t = tickets.find((tk) => tk.items.some((i) => i.lineId === line.id));
  if (!t) return "sent";
  if (t.status === "bumped") return "delivered";
  if (t.status === "ready") return "ready";
  if (t.status === "in_progress") return "started";
  return "sent";
}

export function orderLineToFloor(line: OrderLine, tickets: KitchenTicket[]): FloorLine {
  return {
    id: line.id,
    menuItemId: line.menuItemId,
    name: line.name,
    operatorId: line.vendorId ?? null,
    vendorName: line.vendorName ?? null,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    modifiers: line.modifiers ?? [],
    note: line.note ?? null,
    seat: line.seat ?? null,
    course: line.course,
    station: line.station,
    itemStatus: lineStatus(line, tickets),
    sent: Boolean(line.sent),
    held: Boolean(line.held),
    voided: Boolean(line.voided),
    comped: Boolean(line.comped),
    discountCents: line.discountCents ?? 0,
    taxExempt: Boolean(line.taxExempt),
    ticketId: tickets.find((t) => t.items.some((i) => i.lineId === line.id))?.id ?? null,
    createdAt: line.createdAt,
    firedAt: line.firedAt ?? null,
  };
}

export function orderToFloorCheck(order: Order, locationId: string, tickets: KitchenTicket[]): FloorCheck {
  return {
    id: order.id,
    locationId,
    tableId: order.tableId ?? null,
    tabName: order.tabName ?? null,
    number: order.number,
    type: order.type,
    status: order.status,
    serverId: order.serverId ?? "",
    serverName: order.serverName ?? "",
    guestCount: order.guestCount,
    discountPercent: order.discountPercent ?? 0,
    discountCents: order.discountCents ?? 0,
    autoGratApplied: Boolean(order.autoGratApplied),
    serviceChargeCents: order.serviceChargeCents ?? 0,
    note: order.note ?? null,
    checkPrintedAt: order.checkPrintedAt ?? null,
    mergedTableIds: order.mergedTableIds ?? [],
    lines: order.lines.map((l) => orderLineToFloor(l, tickets)),
    payments: order.payments.map(paymentToFloor),
    createdAt: order.createdAt,
    updatedAt: Date.now(),
    closedAt: order.closedAt ?? null,
  };
}

function paymentToFloor(p: Payment): FloorPayment {
  return {
    id: p.id,
    method: p.method,
    amountCents: p.amountCents,
    tipCents: p.tipCents ?? 0,
    tenderedCents: p.tenderedCents,
    changeCents: p.changeCents,
    last4: p.last4,
    giftCardCode: p.giftCardCode,
    houseAccountId: p.houseAccountId,
    at: p.at,
    employeeId: p.employeeId,
    processor: p.processor,
    chargeBrand: p.chargeBrand,
    sandbox: p.sandbox,
  };
}

function floorLineToOrder(line: FloorLine): OrderLine {
  return {
    id: line.id,
    menuItemId: line.menuItemId,
    name: line.name,
    vendorId: line.operatorId ?? undefined,
    vendorName: line.vendorName ?? undefined,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    modifiers: line.modifiers ?? [],
    note: line.note ?? undefined,
    seat: line.seat ?? undefined,
    course: line.course,
    station: line.station,
    sent: line.sent || line.itemStatus !== "draft",
    held: line.held,
    voided: line.voided,
    comped: line.comped,
    discountCents: line.discountCents,
    taxExempt: line.taxExempt,
    createdAt: line.createdAt,
    firedAt: line.firedAt ?? undefined,
  };
}

function floorCheckToOrder(check: FloorCheck): Order {
  return {
    id: check.id,
    number: check.number,
    type: check.type,
    tableId: check.tableId ?? undefined,
    tabName: check.tabName ?? undefined,
    guestCount: check.guestCount,
    serverId: check.serverId,
    serverName: check.serverName,
    lines: check.lines.map(floorLineToOrder),
    payments: check.payments.map((p) => ({
      id: p.id,
      method: p.method,
      amountCents: p.amountCents,
      tipCents: p.tipCents,
      tenderedCents: p.tenderedCents,
      changeCents: p.changeCents,
      last4: p.last4,
      giftCardCode: p.giftCardCode,
      houseAccountId: p.houseAccountId,
      at: p.at,
      employeeId: p.employeeId,
      processor: p.processor,
      chargeBrand: p.chargeBrand,
      sandbox: p.sandbox,
    })),
    status: check.status,
    discountPercent: check.discountPercent,
    discountCents: check.discountCents,
    autoGratApplied: check.autoGratApplied,
    serviceChargeCents: check.serviceChargeCents,
    createdAt: check.createdAt,
    closedAt: check.closedAt ?? undefined,
    note: check.note ?? undefined,
    checkPrintedAt: check.checkPrintedAt ?? undefined,
    mergedTableIds: check.mergedTableIds,
  };
}

function floorTicketToKitchen(t: FloorTicket): KitchenTicket {
  return {
    id: t.id,
    orderId: t.orderId,
    orderNumber: t.orderNumber,
    tableLabel: t.tableLabel,
    serverName: t.serverName,
    serverId: t.serverId,
    station: t.station,
    vendorId: t.operatorId ?? undefined,
    vendorName: t.vendorName ?? undefined,
    status: t.status,
    course: t.course,
    createdAt: t.createdAt,
    elapsedSec: t.elapsedSec,
    bumpedAt: t.bumpedAt,
    startedAt: t.startedAt,
    items: t.items,
  };
}

function tablePayload(table: Table | undefined): FloorTableStatus | undefined {
  if (!table) return undefined;
  return {
    tableId: table.id,
    status: table.status,
    checkId: table.orderId ?? null,
    serverId: table.serverId ?? null,
    guestCount: table.guestCount ?? null,
    seatedAt: table.seatedAt ?? null,
    statusSince: table.statusSince ?? Date.now(),
  };
}

export function applyOpenFloor(floor: OpenFloor): void {
  const s = usePosStore.getState();
  if (!s.tenantLocationId || s.tenantLocationId !== floor.locationId) return;
  const now = Date.now();

  const serverOrders = floor.checks.map(floorCheckToOrder);
  const serverIds = new Set(serverOrders.map((o) => o.id));
  const localOnly = s.orders.filter((o) => {
    if (serverIds.has(o.id)) return false;
    return now - (o.createdAt || 0) < LOCAL_GRACE_MS;
  });

  const mergedOrders = serverOrders.map((server) => {
    const local = s.orders.find((o) => o.id === server.id);
    if (!local) return server;
    const serverLineIds = new Set(server.lines.map((l) => l.id));
    const extra = local.lines.filter(
      (l) => !serverLineIds.has(l.id) && !l.sent && now - (l.createdAt || 0) < LOCAL_GRACE_MS,
    );
    if (!extra.length) return server;
    return { ...server, lines: [...server.lines, ...extra] };
  });

  const serverTickets = floor.tickets.map(floorTicketToKitchen);
  const ticketIds = new Set(serverTickets.map((t) => t.id));
  const localTickets = s.tickets.filter((t) => {
    if (ticketIds.has(t.id)) return false;
    return now - (t.createdAt || 0) < LOCAL_GRACE_MS;
  });

  const tables = s.tables.map((tb) => {
    const st = floor.tables.find((x) => x.tableId === tb.id);
    if (!st) return tb;
    return {
      ...tb,
      status: st.status,
      orderId: st.checkId ?? undefined,
      serverId: st.serverId ?? undefined,
      guestCount: st.guestCount ?? undefined,
      seatedAt: st.seatedAt ?? undefined,
      statusSince: st.statusSince,
    };
  });

  const nextOrders = [...mergedOrders, ...localOnly];
  const activeStill = nextOrders.some((o) => o.id === s.activeOrderId);
  usePosStore.setState({
    orders: nextOrders,
    tickets: [...serverTickets, ...localTickets],
    tables,
    activeOrderId: activeStill ? s.activeOrderId : s.activeOrderId,
  });
}

async function runOrQueue(
  kind: "order_upsert" | "ticket_upsert" | "ticket_bump" | "table_seat",
  label: string,
  detail: string,
  payload: Record<string, unknown>,
  online: () => Promise<void>,
): Promise<void> {
  const clientMutationId = uid("mut");
  const body = { ...payload, clientMutationId };
  const wan = useNetworkStore.getState().wanOnline();
  if (wan) {
    try {
      await online();
      return;
    } catch {
      /* queue — do not pretend other devices saw this yet */
    }
  }
  enqueueMutation(kind, label, detail, body);
}

export async function hydrateFloor(locationId: string): Promise<void> {
  if (!locationId) return;
  if (!useNetworkStore.getState().wanOnline()) return;
  try {
    const floor = await listOpenFloorFn({ data: { locationId } });
    applyOpenFloor(floor);
  } catch {
    /* stay on cache */
  }
}

export async function persistAfterLocalMutation(kind: string, id?: string): Promise<void> {
  const s = usePosStore.getState();
  const locationId = s.tenantLocationId;
  if (!locationId) return;
  const who = actor();

  if (kind === "lines" && id) {
    const prev = lineDebounce.get(id);
    if (prev) clearTimeout(prev);
    lineDebounce.set(
      id,
      setTimeout(() => {
        lineDebounce.delete(id);
        void persistAfterLocalMutation("lines-flush", id);
      }, 400),
    );
    return;
  }

  if (kind === "check" || kind === "lines-flush" || kind === "lines") {
    const order = s.orders.find((o) => o.id === id) ?? s.getActiveOrder?.();
    if (!order) return;
    const check = orderToFloorCheck(order, locationId, s.tickets);
    const table = order.tableId ? tablePayload(s.tables.find((t) => t.id === order.tableId)) : undefined;
    await runOrQueue(
      "order_upsert",
      `Check · #${order.number}`,
      "Open check saved for every device at this location",
      { locationId, check, table, actor: who },
      async () => {
        await upsertCheckFn({
          data: { locationId, check, clientMutationId: uid("mut") },
        });
        if (kind === "lines-flush" || kind === "lines") {
          await addCheckLinesFn({
            data: { locationId, checkId: order.id, lines: check.lines },
          });
        }
        if (table) {
          await upsertTableStatusFn({ data: { locationId, table } });
        }
      },
    );
    return;
  }

  if (kind === "send") {
    const order = s.orders.find((o) => o.id === id) ?? s.getActiveOrder?.();
    if (!order) return;
    const tickets = s.tickets.filter(
      (t) => t.orderId === order.id && (t.status === "new" || !t.startedAt),
    );
    const check = orderToFloorCheck(order, locationId, tickets);
    const table = order.tableId ? tablePayload(s.tables.find((t) => t.id === order.tableId)) : undefined;
    const floorTickets: FloorTicket[] = tickets.map((t) => ({
      ...t,
      locationId,
      operatorId: t.vendorId ?? null,
      vendorName: t.vendorName ?? null,
    }));
    await runOrQueue(
      "order_upsert",
      `Send · #${order.number}`,
      "Tickets are live on ODS when this device is online",
      { locationId, check, tickets: floorTickets, table, actor: who },
      async () => {
        await upsertCheckFn({ data: { locationId, check } });
        await sendToStationsFn({
          data: {
            locationId,
            checkId: order.id,
            tickets: floorTickets,
            table,
            actor: who,
          },
        });
      },
    );
    return;
  }

  if (kind === "payment") {
    const order = s.orders.find((o) => o.id === id);
    if (!order) return;
    const payment = order.payments[order.payments.length - 1];
    if (!payment) return;
    const table = order.tableId ? tablePayload(s.tables.find((t) => t.id === order.tableId)) : undefined;
    const check = orderToFloorCheck(order, locationId, s.tickets);
    await runOrQueue(
      "order_upsert",
      `Pay · #${order.number}`,
      "Payment posted on the shared check",
      { locationId, check, table, actor: who },
      async () => {
        await upsertCheckFn({ data: { locationId, check } });
        await recordCheckPaymentFn({
          data: {
            locationId,
            checkId: order.id,
            payment: paymentToFloor(payment),
            checkStatus: order.status,
            closedAt: order.closedAt ?? null,
            table,
          },
        });
      },
    );
    return;
  }

  if (kind === "start" || kind === "ready" || kind === "bump" || kind === "recall") {
    const ticketId = id;
    if (!ticketId) return;
    const ticket = s.tickets.find((t) => t.id === ticketId);
    const status =
      kind === "start" ? "in_progress" : kind === "ready" ? "ready" : kind === "recall" ? "new" : "bumped";
    const outKind = kind === "bump" ? "ticket_bump" : "ticket_upsert";
    await runOrQueue(
      outKind,
      `${kind} · ${ticketId.slice(-6)}`,
      "Ticket status is live across devices when online",
      { locationId, ticketId, status, orderNumber: ticket?.orderNumber, actor: who },
      async () => {
        const data = { locationId, ticketId, actor: who };
        if (kind === "start") await odsStartFn({ data });
        else if (kind === "ready") await odsReadyFn({ data });
        else if (kind === "recall") await odsRecallFn({ data });
        else await odsBumpFn({ data });
      },
    );
    return;
  }

  if (kind === "deliver") {
    const ready = s.tickets.filter((t) => t.orderId && t.status === "bumped" && id && (
      s.orders.find((o) => o.id === t.orderId)?.tableId === id
    ));
    const justBumped = s.tickets.filter((t) => {
      if (!id) return false;
      const order = s.orders.find((o) => o.id === t.orderId);
      return order?.tableId === id && t.status === "bumped";
    });
    for (const t of justBumped.length ? justBumped : ready) {
      await persistAfterLocalMutation("bump", t.id);
    }
    return;
  }

  if (kind === "table") {
    const table = s.tables.find((t) => t.id === id);
    const payload = tablePayload(table);
    if (!payload) return;
    await runOrQueue(
      "table_seat",
      `Table ${table?.label ?? id}`,
      "Table status is live across devices when online",
      { locationId, table: payload, tableId: payload.tableId, guestCount: payload.guestCount, actor: who },
      async () => {
        await upsertTableStatusFn({ data: { locationId, table: payload } });
        const order = table?.orderId ? s.orders.find((o) => o.id === table.orderId) : undefined;
        if (order) {
          await upsertCheckFn({
            data: { locationId, check: orderToFloorCheck(order, locationId, s.tickets) },
          });
        }
      },
    );
  }
}

export function applyStationTickets(station: TicketStation, incoming: FloorTicket[]): void {
  const s = usePosStore.getState();
  const now = Date.now();
  const mapped = incoming.map(floorTicketToKitchen);
  const mappedIds = new Set(mapped.map((t) => t.id));
  const others = s.tickets.filter((t) => t.station !== station);
  const localOnly = s.tickets.filter(
    (t) =>
      t.station === station &&
      !mappedIds.has(t.id) &&
      now - (t.createdAt || 0) < LOCAL_GRACE_MS,
  );
  usePosStore.setState({ tickets: [...others, ...mapped, ...localOnly] });
}

export function useStationTicketPolling(
  locationId: string | null | undefined,
  station: TicketStation,
  operatorId?: string | null,
): void {
  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const pull = () => {
      if (cancelled) return;
      if (!useNetworkStore.getState().wanOnline()) return;
      void listStationTicketsFn({
        data: { locationId, station, operatorId: operatorId ?? null },
      })
        .then((res) => {
          if (cancelled) return;
          applyStationTickets(station, res.tickets);
        })
        .catch(() => undefined);
    };
    pull();
    const t = window.setInterval(pull, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [locationId, station, operatorId]);
}

export function useFloorPolling(locationId: string | null | undefined): void {
  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const pull = () => {
      if (cancelled) return;
      void hydrateFloor(locationId);
    };
    pull();
    const t = window.setInterval(pull, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") pull();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [locationId]);
}
