import { pickupReadyText } from "../pos/serverless-food.ts";

/** Marketplace and courier channels. A marketplace check is not a card charge. */

export type ChannelVendor = "doordash" | "ubereats" | "grubhub" | "webhook";
export type ChannelKind = "marketplace" | "courier_dispatch";
export type DeliveryStatus = "received" | "accepted" | "prep" | "ready" | "picked_up" | "cancelled";

export type DeliveryChannel = {
  id: string;
  vendor: ChannelVendor;
  kind: ChannelKind;
  label: string;
  commissionPct: number;
  sandboxKey: string;
  liveKey: string;
  autoAccept: boolean;
  paused: boolean;
  down: boolean;
  smsOnReady: boolean;
  priceMode: "percent" | "flat";
  priceOverride: number;
  hours: { open: string; close: string } | null;
};

export type HouseItem = {
  id: string;
  name: string;
  priceCents: number;
  available: boolean;
  alcohol: boolean;
  entityId: string;
  station: "kitchen" | "bar";
  course: string;
};

export type ItemMap = { channelItemId: string; menuItemId: string };

export type DeliveryLine = {
  menuItemId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  note: string;
  station: "kitchen" | "bar";
  course: string;
  entityId: string;
};

export type DeliveryCheck = {
  channelId: string;
  vendor: ChannelVendor;
  kind: ChannelKind;
  diningOption: string;
  guestName: string;
  guestPhone: string;
  channelOrderId: string;
  dueAt: string;
  specialInstructions: string;
  status: DeliveryStatus;
  tender: { method: "marketplace"; label: "Marketplace payable"; amountCents: number };
  expectedPayoutCents: number;
  guestTotalCents: number;
  commissionPct: number;
  lines: DeliveryLine[];
  dropped: Array<{ name: string; reason: string }>;
  kitchenTicket: string;
  slips: Array<{
    destinationName: string;
    station: "kitchen" | "bar";
    orderType: "takeout";
    items: Array<{ name: string; quantity: number; note?: string }>;
  }>;
  smsOnReady: boolean;
  pickupSms: string | null;
  finixCalled: false;
  quantumRan: false;
  secondCard: false;
};

export type WebhookResult = {
  ok: boolean;
  accepted: boolean;
  check: DeliveryCheck | null;
  queued: boolean;
  banner: string | null;
  log: string[];
  finixCalled: false;
  error?: string;
};

export type IngestContext = {
  channels: DeliveryChannel[];
  menu: HouseItem[];
  maps: ItemMap[];
  foodEntityId: string;
  allowDeliveryAlcohol: boolean;
  pickupLabel?: string;
  /** Venue local HH:MM. When set, a closed window rejects the order. */
  nowHhmm?: string;
  chargeCard?: () => void;
};

const TENDER_LABEL = "Marketplace payable";

export function defaultDeliveryChannels(): DeliveryChannel[] {
  const base = {
    commissionPct: 15,
    sandboxKey: "",
    liveKey: "",
    autoAccept: true,
    paused: false,
    down: false,
    smsOnReady: true,
    priceMode: "percent" as const,
    priceOverride: 0,
    hours: { open: "11:00", close: "22:00" },
  };
  return [
    { ...base, id: "doordash", vendor: "doordash", kind: "marketplace", label: "DoorDash" },
    { ...base, id: "ubereats", vendor: "ubereats", kind: "marketplace", label: "Uber Eats" },
    { ...base, id: "grubhub", vendor: "grubhub", kind: "marketplace", label: "Grubhub" },
    {
      ...base,
      id: "webhook",
      vendor: "webhook",
      kind: "marketplace",
      label: "Tablet webhook",
      commissionPct: 0,
    },
  ];
}

export function channelHasKeys(channel: DeliveryChannel): boolean {
  return Boolean(channel.sandboxKey.trim() || channel.liveKey.trim());
}

export function nativeChannelsLive(channels: DeliveryChannel[]): boolean {
  return channels.some((channel) => channel.vendor !== "webhook" && channelHasKeys(channel));
}

export function expectedPayoutCents(guestTotalCents: number, commissionPct: number): number {
  const commission = Math.round(Math.max(0, guestTotalCents) * (Math.max(0, commissionPct) / 100));
  return Math.max(0, guestTotalCents - commission);
}

export function channelPriceCents(priceCents: number, channel: DeliveryChannel): number {
  if (channel.priceMode === "flat") return Math.max(0, Math.round(priceCents + channel.priceOverride));
  return Math.max(0, Math.round(priceCents * (1 + channel.priceOverride / 100)));
}

export function publishDeliveryMenu(items: HouseItem[], channel: DeliveryChannel) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    entityId: item.entityId,
    priceCents: channelPriceCents(item.priceCents, channel),
    available: item.available,
    alcohol: item.alcohol,
  }));
}

export function channelOpen(channel: DeliveryChannel, hhmm: string): boolean {
  if (channel.paused) return false;
  if (!channel.hours) return true;
  return hhmm >= channel.hours.open && hhmm < channel.hours.close;
}

export function applyHouse86(menu: HouseItem[], itemId: string, channels: DeliveryChannel[]) {
  const next = menu.map((item) => (item.id === itemId ? { ...item, available: !item.available } : item));
  const item = next.find((row) => row.id === itemId);
  const payloads: Array<{
    vendor: ChannelVendor;
    itemId: string;
    available: false;
    status: "unavailable";
    houseDeleted: false;
  }> = [];
  const logs: string[] = [];
  if (item && !item.available) {
    for (const channel of channels) {
      if (channel.vendor === "webhook") {
        logs.push(`${channel.label}: 86 logged`);
        continue;
      }
      if (channelHasKeys(channel)) {
        payloads.push({
          vendor: channel.vendor,
          itemId: item.id,
          available: false,
          status: "unavailable",
          houseDeleted: false,
        });
      } else {
        logs.push(`${channel.label}: 86 logged, no keys`);
      }
    }
  }
  return { menu: next, payloads, logs, houseDeleted: false as const };
}

export function planStatusPush(
  channel: DeliveryChannel,
  status: DeliveryStatus,
  reason: string,
): { mode: "native" | "log" | "queue"; payload: Record<string, unknown> | null; banner: string | null; log: string } {
  if (status === "cancelled" && !reason.trim()) {
    return { mode: "log", payload: null, banner: null, log: "Cancel needs a reason" };
  }
  const payload = {
    vendor: channel.vendor,
    status,
    reason: reason.trim(),
    unavailable: status === "cancelled",
  };
  if (channel.down) {
    return {
      mode: "queue",
      payload,
      banner: `${channel.label} is down. Status is queued.`,
      log: `${channel.label}: queued ${status}`,
    };
  }
  if (channel.vendor !== "webhook" && channelHasKeys(channel)) {
    return { mode: "native", payload, banner: null, log: `${channel.label}: push ${status}` };
  }
  return { mode: "log", payload: null, banner: null, log: `${channel.label}: log ${status}` };
}

type RawLine = {
  externalId: string;
  name: string;
  quantity: number;
  priceCents: number;
  note: string;
  alcohol: boolean;
};

type RawOrder = {
  vendor: ChannelVendor;
  channelId: string;
  orderId: string;
  guestName: string;
  phone: string;
  dueAt: string;
  instructions: string;
  lines: RawLine[];
};

function cents(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (!Number.isInteger(n)) return Math.round(n * 100);
  return Math.round(n);
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function linesFrom(items: unknown, idKey: string, nameKey: string): RawLine[] {
  if (!Array.isArray(items)) return [];
  return items.map((row) => {
    const item = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    const price = item.price && typeof item.price === "object" ? (item.price as { amount?: unknown }).amount : item.price;
    return {
      externalId: text(item[idKey] ?? item.merchant_supplied_id ?? item.id ?? item.menu_item_id),
      name: text(item[nameKey] ?? item.name ?? item.title) || "Item",
      quantity: Math.max(1, Math.round(Number(item.quantity ?? item.qty) || 1)),
      priceCents: cents(item.price_cents ?? price),
      note: text(item.special_instructions ?? item.note ?? item.instructions),
      alcohol: item.alcohol === true || item.is_alcohol === true,
    };
  });
}

function parseDoorDash(body: Record<string, unknown>): RawOrder | null {
  const order = body.order && typeof body.order === "object" ? (body.order as Record<string, unknown>) : null;
  if (!order) return null;
  const consumer = order.consumer && typeof order.consumer === "object" ? (order.consumer as Record<string, unknown>) : {};
  const categories = Array.isArray(order.categories) ? order.categories : [];
  const lines = categories.flatMap((category) => {
    const row = category && typeof category === "object" ? (category as Record<string, unknown>) : {};
    return linesFrom(row.items, "merchant_supplied_id", "name");
  });
  const first = text(consumer.first_name);
  const last = text(consumer.last_name);
  return {
    vendor: "doordash",
    channelId: "doordash",
    orderId: text(order.id),
    guestName: [first, last].filter(Boolean).join(" "),
    phone: text(consumer.phone),
    dueAt: text(order.estimated_pickup_time),
    instructions: text(order.order_special_instructions ?? order.special_instructions),
    lines,
  };
}

function parseUber(body: Record<string, unknown>): RawOrder | null {
  const order = body.order && typeof body.order === "object" ? (body.order as Record<string, unknown>) : null;
  if (!order) return null;
  const eater = order.eater && typeof order.eater === "object" ? (order.eater as Record<string, unknown>) : {};
  const cart = order.cart && typeof order.cart === "object" ? (order.cart as Record<string, unknown>) : {};
  return {
    vendor: "ubereats",
    channelId: "ubereats",
    orderId: text(order.id || order.display_id),
    guestName: text(eater.first_name || eater.name),
    phone: text(eater.phone),
    dueAt: text(order.estimated_ready_for_pickup_at),
    instructions: text(order.special_instructions),
    lines: linesFrom(cart.items, "id", "title"),
  };
}

function parseGrubhub(body: Record<string, unknown>): RawOrder | null {
  const order = body.order && typeof body.order === "object" ? (body.order as Record<string, unknown>) : null;
  if (!order) return null;
  const diner = order.diner && typeof order.diner === "object" ? (order.diner as Record<string, unknown>) : {};
  return {
    vendor: "grubhub",
    channelId: "grubhub",
    orderId: text(order.uuid || order.id),
    guestName: text(diner.name),
    phone: text(diner.phone),
    dueAt: text(order.when_for),
    instructions: text(order.special_instructions),
    lines: linesFrom(order.lines, "menu_item_id", "name"),
  };
}

function parseGeneric(body: Record<string, unknown>): RawOrder | null {
  const source = text(body.source).toLowerCase();
  if (source !== "otter" && source !== "deliverect" && source !== "webhook" && source !== "tablet") return null;
  const channelId = source === "tablet" ? "webhook" : source;
  return {
    vendor: "webhook",
    channelId,
    orderId: text(body.order_id || body.id),
    guestName: text(body.guest_name),
    phone: text(body.phone),
    dueAt: text(body.due_at),
    instructions: text(body.instructions),
    lines: linesFrom(body.items, "id", "name"),
  };
}

export function parseInbound(body: unknown): RawOrder | { error: string } {
  if (!body || typeof body !== "object") return { error: "invalid json" };
  const record = body as Record<string, unknown>;
  const event = text(record.event_type || record.type).toLowerCase();
  if (event.includes("ordercreate") || event === "orders.notification" || record.order) {
    const door = parseDoorDash(record);
    if (door && (event.includes("ordercreate") || door.lines.length || door.orderId)) {
      if (event.includes("uber") || event === "orders.notification") {
        const uber = parseUber(record);
        if (uber) return uber;
      }
      if (event.includes("grubhub") || event === "order.created") {
        const grub = parseGrubhub(record);
        if (grub) return grub;
      }
      if (event.includes("ordercreate") || (door.lines.length && !event.includes("uber") && !event.includes("grubhub"))) {
        return door;
      }
    }
  }
  const generic = parseGeneric(record);
  if (generic) return generic;
  const uber = parseUber(record);
  if (uber?.orderId) return uber;
  const grub = parseGrubhub(record);
  if (grub?.orderId) return grub;
  return { error: "Unrecognized delivery order" };
}

function findChannel(channels: DeliveryChannel[], raw: RawOrder): DeliveryChannel | undefined {
  return (
    channels.find((channel) => channel.id === raw.channelId) ||
    channels.find((channel) => channel.vendor === raw.vendor) ||
    channels.find((channel) => channel.vendor === "webhook")
  );
}

function mappedItem(line: RawLine, ctx: IngestContext): HouseItem | undefined {
  const explicit = ctx.maps.find((row) => row.channelItemId === line.externalId);
  if (explicit) return ctx.menu.find((item) => item.id === explicit.menuItemId);
  return ctx.menu.find((item) => item.id === line.externalId);
}

function foodByName(line: RawLine, ctx: IngestContext): HouseItem | undefined {
  const name = line.name.toLowerCase();
  const food = ctx.menu.filter((item) => !item.alcohol && (!ctx.foodEntityId || item.entityId === ctx.foodEntityId));
  return food.find((item) => item.name.toLowerCase() === name);
}

export function formatKitchenTicket(check: {
  diningOption: string;
  guestName: string;
  guestPhone: string;
  channelOrderId: string;
  dueAt: string;
  specialInstructions: string;
  lines: Array<{ quantity: number; name: string; note?: string }>;
}): string {
  const rows = [
    check.diningOption,
    check.guestName,
    check.guestPhone,
    check.channelOrderId,
    check.dueAt,
    check.specialInstructions,
    ...check.lines.map((line) => `${line.quantity} ${line.name}${line.note ? ` ${line.note}` : ""}`),
  ];
  return rows.filter((row) => row.trim()).join("\n");
}

export function handleDeliveryWebhook(body: unknown, ctx: IngestContext): WebhookResult {
  const log: string[] = [];
  const parsed = parseInbound(body);
  if ("error" in parsed) {
    return { ok: false, accepted: false, check: null, queued: false, banner: null, log, finixCalled: false, error: parsed.error };
  }
  const channel = findChannel(ctx.channels, parsed);
  if (!channel) {
    return { ok: false, accepted: false, check: null, queued: false, banner: null, log, finixCalled: false, error: "No delivery channel" };
  }
  if (channel.paused) {
    log.push(`${channel.label}: paused`);
    return { ok: true, accepted: false, check: null, queued: false, banner: null, log, finixCalled: false, error: "paused" };
  }
  if (ctx.nowHhmm && !channelOpen(channel, ctx.nowHhmm)) {
    log.push(`${channel.label}: closed`);
    return { ok: true, accepted: false, check: null, queued: false, banner: null, log, finixCalled: false, error: "closed" };
  }
  const lines: DeliveryLine[] = [];
  const dropped: Array<{ name: string; reason: string }> = [];
  for (const raw of parsed.lines) {
    const mapped = mappedItem(raw, ctx);
    const alcohol = raw.alcohol || mapped?.alcohol === true;
    if (alcohol) {
      if (!ctx.allowDeliveryAlcohol || !mapped) {
        dropped.push({ name: raw.name, reason: "alcohol" });
        continue;
      }
    }
    const item = mapped ?? (!alcohol ? foodByName(raw, ctx) : undefined);
    if (!item) {
      dropped.push({ name: raw.name, reason: "unmapped" });
      continue;
    }
    const entityId = item.entityId || ctx.foodEntityId;
    lines.push({
      menuItemId: item.id,
      name: item.name,
      quantity: raw.quantity,
      unitPriceCents: raw.priceCents || item.priceCents,
      note: raw.note,
      station: item.station,
      course: item.course || (item.station === "bar" ? "drink" : "entree"),
      entityId,
    });
  }
  const guestTotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const status: DeliveryStatus = channel.autoAccept ? "accepted" : "received";
  const diningOption = `Delivery-${parsed.channelId === "webhook" ? "webhook" : parsed.channelId}`;
  const draft = {
    diningOption,
    guestName: parsed.guestName,
    guestPhone: parsed.phone,
    channelOrderId: parsed.orderId,
    dueAt: parsed.dueAt,
    specialInstructions: parsed.instructions,
    lines,
  };
  const kitchen = lines.filter((line) => line.station !== "bar");
  const bar = lines.filter((line) => line.station === "bar");
  const slips = [
    kitchen.length
      ? {
          destinationName: "Kitchen",
          station: "kitchen" as const,
          orderType: "takeout" as const,
          items: kitchen.map((line) => ({ name: line.name, quantity: line.quantity, note: line.note })),
        }
      : null,
    bar.length
      ? {
          destinationName: "Bar",
          station: "bar" as const,
          orderType: "takeout" as const,
          items: bar.map((line) => ({ name: line.name, quantity: line.quantity, note: line.note })),
        }
      : null,
  ].filter((slip): slip is NonNullable<typeof slip> => Boolean(slip));
  const check: DeliveryCheck = {
    channelId: channel.id,
    vendor: channel.vendor,
    kind: channel.kind,
    diningOption,
    guestName: parsed.guestName,
    guestPhone: parsed.phone,
    channelOrderId: parsed.orderId,
    dueAt: parsed.dueAt,
    specialInstructions: parsed.instructions,
    status,
    tender: { method: "marketplace", label: TENDER_LABEL, amountCents: guestTotalCents },
    expectedPayoutCents: expectedPayoutCents(guestTotalCents, channel.commissionPct),
    guestTotalCents,
    commissionPct: channel.commissionPct,
    lines,
    dropped,
    kitchenTicket: formatKitchenTicket(draft),
    slips,
    smsOnReady: channel.smsOnReady,
    pickupSms: channel.smsOnReady
      ? pickupReadyText(parsed.guestName, parsed.orderId, ctx.pickupLabel || "counter")
      : null,
    finixCalled: false,
    quantumRan: false,
    secondCard: false,
  };
  let queued = false;
  let banner: string | null = null;
  if (channel.down) {
    queued = true;
    banner = `${channel.label} is down. Orders stay on the check. Outbound status is queued.`;
    log.push(banner);
  } else if (channel.vendor !== "webhook" && !channelHasKeys(channel)) {
    log.push(`${channel.label}: webhook only, no keys`);
  }
  const pushed = planStatusPush(channel.down ? channel : { ...channel, down: false }, status, "");
  log.push(pushed.log);
  if (pushed.banner) banner = pushed.banner;
  if (pushed.mode === "queue") queued = true;
  return { ok: true, accepted: true, check, queued, banner, log, finixCalled: false };
}
