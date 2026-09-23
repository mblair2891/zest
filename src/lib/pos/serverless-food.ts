/** Guests order food. A server or bartender adds drinks. */

export const SERVERLESS_FOOD_STYLE = "serverless_food" as const;

export function isServerlessFood(style: unknown): boolean {
  const s = String(style ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return (
    s === "serverless_food" ||
    s === "serverless" ||
    s === "serverless_food_served_drinks"
  );
}

export type GuestItemShape = {
  station?: string | null;
  taxCategory?: string | null;
  vendorStation?: string | null;
};

/** Bar station, beverage tax, or a bar-only entity. */
export function isDrinkItem(item: GuestItemShape): boolean {
  if (item.vendorStation === "bar") return true;
  if (item.station === "bar") return true;
  if (item.taxCategory === "bev") return true;
  return false;
}

export function guestDrinksAllowed(settings: {
  serviceStyle?: string | null;
  guestMayOrderDrinks?: boolean | null;
}): boolean {
  if (!isServerlessFood(settings.serviceStyle)) return true;
  return settings.guestMayOrderDrinks === true;
}

export function guestMayAddItem(
  item: GuestItemShape,
  settings: { serviceStyle?: string | null; guestMayOrderDrinks?: boolean | null },
): boolean {
  if (!isDrinkItem(item)) return true;
  return guestDrinksAllowed(settings);
}

export function guestContactOk(name: unknown, phone: unknown): boolean {
  if (String(name ?? "").trim().length < 1) return false;
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length >= 7;
}

export function pickupPlaceLabel(label: unknown): string {
  const s = String(label ?? "").trim();
  return s || "counter";
}

export function pickupReadyText(name: unknown, orderId: unknown, pickupLabel: unknown): string {
  const who = String(name ?? "").trim() || "Guest";
  return `${who}, order ${String(orderId ?? "").trim()} is ready. Pick up at ${pickupPlaceLabel(pickupLabel)}.`;
}

export function pickupReminderText(name: unknown, orderId: unknown, pickupLabel: unknown): string {
  const who = String(name ?? "").trim() || "Guest";
  return `${who}, order ${String(orderId ?? "").trim()} is still ready. Pick up at ${pickupPlaceLabel(pickupLabel)}.`;
}

export type PickupLine = {
  id: string;
  station?: string | null;
  taxCategory?: string | null;
  vendorStation?: string | null;
  sent?: boolean;
  voided?: boolean;
};

export type PickupTicket = {
  id: string;
  orderId: string;
  station?: string | null;
  status?: string | null;
  items?: { lineId?: string }[];
};

export type PickupOrder = {
  id: string;
  number?: string | number;
  guestName?: string | null;
  guestPhone?: string | null;
  guestChannel?: string | null;
  pickupSmsAt?: number | null;
  pickupReminderSmsAt?: number | null;
  pickedUpAt?: number | null;
  lines?: PickupLine[];
};

const FOOD_DONE = new Set(["ready", "bumped"]);

export function foodLineDone(line: PickupLine, tickets: readonly PickupTicket[], orderId: string): boolean {
  if (line.voided || isDrinkItem(line)) return true;
  if (!line.sent) return false;
  const covering = tickets.filter(
    (t) =>
      t.orderId === orderId &&
      t.station !== "bar" &&
      (t.items ?? []).some((i) => i.lineId === line.id),
  );
  if (!covering.length) return false;
  return covering.every((t) => FOOD_DONE.has(String(t.status ?? "")));
}

/** True when every sent food line is bumped or ready. Drinks do not count. */
export function allFoodBumped(order: PickupOrder, tickets: readonly PickupTicket[]): boolean {
  const food = (order.lines ?? []).filter((l) => !l.voided && !isDrinkItem(l) && l.sent);
  if (!food.length) return false;
  return food.every((l) => foodLineDone(l, tickets, order.id));
}

export type PickupNotice = {
  kind: "ready" | "reminder";
  to: string;
  body: string;
};

export function nextPickupSms(
  order: PickupOrder,
  tickets: readonly PickupTicket[],
  settings: {
    serviceStyle?: string | null;
    pickupLabel?: string | null;
    pickupReminderMinutes?: number | null;
  },
  now: number,
): PickupNotice | null {
  const phone = String(order.guestPhone ?? "").trim();
  if (!phone) return null;
  if (order.pickedUpAt) return null;
  if (!allFoodBumped(order, tickets)) return null;
  const id = order.number ?? order.id;
  const place = settings.pickupLabel;
  if (!order.pickupSmsAt) {
    return { kind: "ready", to: phone, body: pickupReadyText(order.guestName, id, place) };
  }
  const minutes = Number(settings.pickupReminderMinutes);
  if (!(minutes > 0) || order.pickupReminderSmsAt) return null;
  if (now - order.pickupSmsAt < minutes * 60_000) return null;
  return { kind: "reminder", to: phone, body: pickupReminderText(order.guestName, id, place) };
}
