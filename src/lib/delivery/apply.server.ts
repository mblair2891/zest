import { patchLocationSetup } from "@/lib/print/queue.server";
import {
  defaultDeliveryChannels,
  handleDeliveryWebhook,
  normalizeDeliveryChannels,
  type DeliveryChannel,
  type DeliveryCheck,
  type HouseItem,
  type ItemMap,
  type WebhookResult,
} from "./marketplace.ts";
import { verifyDeliverySignature } from "./sign.server.ts";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function houseItems(raw: unknown): HouseItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    const item = asRecord(row);
    if (!item || typeof item.id !== "string") return [];
    const station = item.station === "bar" || item.taxCategory === "bev" || item.course === "drink" ? "bar" : "kitchen";
    return [
      {
        id: item.id,
        name: String(item.name ?? "Item"),
        priceCents: Math.round(Number(item.priceCents) || 0),
        available: item.available !== false,
        alcohol: item.alcohol === true || station === "bar",
        entityId: String(item.entityId ?? item.vendorId ?? ""),
        station,
        course: String(item.course ?? (station === "bar" ? "drink" : "entree")),
      } satisfies HouseItem,
    ];
  });
}

async function loadCtx(locationId: string | undefined, body: unknown) {
  const record = asRecord(body);
  const order = asRecord(record?.order);
  const store = asRecord(order?.store);
  const hinted = String(store?.merchant_supplied_id ?? record?.location_id ?? locationId ?? "").trim();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = hinted
    ? await sql<{ id: string; setup: unknown }>`select id, setup from locations where id = ${hinted} limit 1`
    : await sql<{ id: string; setup: unknown }>`select id, setup from locations order by created_at asc limit 1`;
  const loc = rows[0];
  const setup = asRecord(loc?.setup) ?? {};
  const channels = normalizeDeliveryChannels(
    Array.isArray(setup.deliveryChannels) ? (setup.deliveryChannels as DeliveryChannel[]) : undefined,
  );
  const catalog = asRecord(setup.menuCatalog);
  const menu = houseItems(setup.deliveryPublished).length
    ? houseItems(setup.deliveryPublished)
    : houseItems(catalog?.items);
  const maps = Array.isArray(setup.deliveryItemMaps) ? (setup.deliveryItemMaps as ItemMap[]) : [];
  return {
    locationId: loc?.id ?? hinted,
    channels,
    menu,
    maps,
    foodEntityId: String(setup.hostEntityId ?? ""),
    allowDeliveryAlcohol: setup.allowDeliveryAlcohol === true,
    pickupLabel: String(setup.pickupLabel ?? ""),
  };
}

export async function applyDeliveryWebhook(
  body: unknown,
  locationId?: string,
  raw?: { body: string; signature: string | null },
): Promise<WebhookResult> {
  let ctx: Awaited<ReturnType<typeof loadCtx>> | null = null;
  try {
    ctx = await loadCtx(locationId, body);
  } catch {
    ctx = null;
  }
  const secret = ctx?.channels.find((channel) => channel.vendor === "webhook")?.signingSecret ?? "";
  if (raw && !verifyDeliverySignature(secret, raw.body, raw.signature)) {
    return {
      ok: false,
      accepted: false,
      check: null,
      queued: false,
      banner: null,
      log: ["invalid signature"],
      finixCalled: false,
      error: "invalid signature",
    };
  }
  let cardCalled = false;
  const result = handleDeliveryWebhook(body, {
    channels: ctx?.channels?.length ? ctx.channels : defaultDeliveryChannels(),
    menu: ctx?.menu ?? [],
    maps: ctx?.maps ?? [],
    foodEntityId: ctx?.foodEntityId ?? "",
    allowDeliveryAlcohol: ctx?.allowDeliveryAlcohol === true,
    pickupLabel: ctx?.pickupLabel,
    chargeCard: () => {
      cardCalled = true;
    },
  });
  if (cardCalled) result.log.push("card charge blocked");
  const loc = ctx?.locationId;
  if (loc && result.check) {
    try {
      await patchLocationSetup(loc, (setup) => {
        const inbox = Array.isArray(setup.deliveryInbox) ? [...setup.deliveryInbox] : [];
        const id = result.check?.channelOrderId;
        const exists = inbox.some((row) => asRecord(row)?.channelOrderId === id);
        if (!exists) inbox.unshift({ ...result.check, banner: result.banner, queued: result.queued });
        return {
          ...setup,
          deliveryInbox: inbox.slice(0, 40),
          deliveryBanner: result.banner,
        };
      });
    } catch {
      result.queued = true;
      result.banner = result.banner || "Delivery channel is down. The order is queued.";
      result.log.push("inbox queued");
    }
  }
  return result;
}

export async function claimDeliveryInbox(locationId: string): Promise<DeliveryCheck[]> {
  const taken: DeliveryCheck[] = [];
  try {
    await patchLocationSetup(locationId, (setup) => {
      const inbox = Array.isArray(setup.deliveryInbox) ? setup.deliveryInbox : [];
      for (const row of inbox) {
        const check = asRecord(row);
        if (check && typeof check.channelOrderId === "string") taken.push(check as unknown as DeliveryCheck);
      }
      return { ...setup, deliveryInbox: [] };
    });
  } catch {
    return [];
  }
  return taken;
}
