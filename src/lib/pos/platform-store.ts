import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uid } from "@/lib/utils";
import {
  BUILDINGS,
  CAMPAIGNS,
  CATERING,
  CHECKLISTS,
  DRIVERS,
  HOUSE_ACCOUNTS,
  INTEGRATIONS,
  LOCATIONS,
  ONLINE_ORDERS,
  PAYOUTS,
  PROMOTIONS,
  PURCHASE_ORDERS,
  RECIPES,
  SCHEDULE,
  TENANTS,
} from "./platform-seed";
import type {
  Campaign,
  CateringEvent,
  DeliveryDriver,
  HouseAccount,
  Integration,
  KitchenFireMode,
  Location,
  OnlineOrder,
  OnlineOrderType,
  OrderFulfillmentSettings,
  PlatformView,
  Promotion,
  PurchaseOrder,
  Recipe,
  ScheduleShift,
  ShiftChecklist,
  Tenant,
  TenantPayout,
  Building,
} from "./platform-types";
import { usePosStore } from "./store";
import type { KitchenTicket, OrderLine } from "./types";

export const DEFAULT_FULFILLMENT: OrderFulfillmentSettings = {
  defaultFireModeTakeout: "immediate",
  defaultFireModeOrderAhead: "on_arrival",
  defaultFireModeCurbside: "on_arrival",
  defaultFireModeQrTable: "immediate",
  defaultFireModeDelivery: "immediate",
  defaultDelayMinutes: 15,
  allowGuestChooseFireMode: true,
  requireTableOnArrival: true,
  autoAcceptOnline: false,
  defaultPromiseMinutes: 25,
};

function claimCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

function defaultFireModeForType(
  type: OnlineOrderType,
  s: OrderFulfillmentSettings,
): KitchenFireMode {
  switch (type) {
    case "order_ahead":
      return s.defaultFireModeOrderAhead;
    case "curbside":
      return s.defaultFireModeCurbside;
    case "dine_in_qr":
      return s.defaultFireModeQrTable;
    case "delivery":
      return s.defaultFireModeDelivery;
    default:
      return s.defaultFireModeTakeout;
  }
}

interface PlatformState {
  buildings: Building[];
  tenants: Tenant[];
  locations: Location[];
  activeLocationId: string;
  activeTenantId: string;
  recipes: Recipe[];
  purchaseOrders: PurchaseOrder[];
  schedule: ScheduleShift[];
  promotions: Promotion[];
  onlineOrders: OnlineOrder[];
  catering: CateringEvent[];
  payouts: TenantPayout[];
  campaigns: Campaign[];
  drivers: DeliveryDriver[];
  houseAccounts: HouseAccount[];
  integrations: Integration[];
  checklists: ShiftChecklist[];
  platformView: PlatformView | null;
  onlineCart: {
    menuItemId: string;
    name: string;
    qty: number;
    unitPriceCents: number;
  }[];
  onlineGuestName: string;
  onlinePromo: string;
  fulfillmentSettings: OrderFulfillmentSettings;
  hallCart: {
    tenantId: string;
    menuItemId: string;
    name: string;
    qty: number;
    unitPriceCents: number;
  }[];

  setActiveLocation: (id: string) => void;
  setActiveTenant: (id: string) => void;
  setPlatformView: (v: PlatformView | null) => void;
  toggleLocationOpen: (id: string) => void;

  updateOnlineStatus: (id: string, status: OnlineOrder["status"]) => void;
  acceptOnlineOrder: (id: string) => void;
  placeOnlineOrder: (opts: {
    guestName: string;
    type: OnlineOrder["type"];
    channel: OnlineOrder["channel"];
    promoCode?: string;
    tableLabel?: string;
    tableId?: string;
    address?: string;
    guestPhone?: string;
    kitchenFireMode?: KitchenFireMode;
    delayMinutes?: number;
    vehicleDescription?: string;
    vehicleColor?: string;
    notes?: string;
  }) => { ok: boolean; error?: string; orderId?: string; claimCode?: string; number?: number };
  addToOnlineCart: (item: {
    menuItemId: string;
    name: string;
    unitPriceCents: number;
  }) => void;
  clearOnlineCart: () => void;
  setOnlineGuestName: (n: string) => void;
  setOnlinePromo: (c: string) => void;
  updateFulfillmentSettings: (patch: Partial<OrderFulfillmentSettings>) => void;
  markGuestArrived: (
    id: string,
    opts?: { tableLabel?: string; tableId?: string; vehicleDescription?: string },
  ) => { ok: boolean; error?: string };
  linkOrderToTable: (
    id: string,
    tableLabel: string,
    tableId?: string,
  ) => { ok: boolean; error?: string };
  fireOnlineOrderToKitchen: (id: string) => { ok: boolean; error?: string };
  processKitchenFireQueue: () => number;
  findOrderByClaim: (code: string) => OnlineOrder | undefined;

  addHallCartItem: (item: {
    tenantId: string;
    menuItemId: string;
    name: string;
    unitPriceCents: number;
  }) => void;
  checkoutHallCart: (guestName: string) => {
    ok: boolean;
    splits: { tenantId: string; totalCents: number }[];
  };

  togglePromo: (id: string) => void;
  addPromo: (p: Omit<Promotion, "id">) => void;

  addShift: (s: Omit<ScheduleShift, "id">) => void;
  publishSchedule: (locationId: string) => void;
  removeShift: (id: string) => void;

  updateCateringStatus: (
    id: string,
    status: CateringEvent["status"],
  ) => void;
  addCatering: (c: Omit<CateringEvent, "id">) => void;

  receivePO: (id: string) => void;
  sendPO: (id: string) => void;

  markPayoutPaid: (id: string) => void;
  recalculatePayouts: () => void;

  assignDriver: (orderId: string, driverId: string) => void;
  toggleIntegration: (id: string) => void;
  toggleChecklistItem: (listId: string, itemId: string) => void;

  chargeHouseAccount: (
    id: string,
    amountCents: number,
  ) => { ok: boolean; error?: string };

  sendCampaign: (id: string) => void;

  getActiveLocation: () => Location | null;
  getActiveTenant: () => Tenant | null;
  hallSettlementPreview: () => {
    tenantId: string;
    name: string;
    gross: number;
    fees: number;
    commons: number;
    net: number;
  }[];
}

function initial() {
  return {
    buildings: BUILDINGS.map((b) => ({ ...b })),
    tenants: TENANTS.map((t) => ({
      ...t,
      bankAccount: { ...t.bankAccount },
      locationIds: [...t.locationIds],
    })),
    locations: LOCATIONS.map((l) => ({ ...l })),
    activeLocationId: "loc_hh",
    activeTenantId: "ten_hh",
    recipes: RECIPES.map((r) => ({
      ...r,
      lines: r.lines.map((l) => ({ ...l })),
    })),
    purchaseOrders: PURCHASE_ORDERS.map((p) => ({
      ...p,
      lines: p.lines.map((l) => ({ ...l })),
    })),
    schedule: SCHEDULE.map((s) => ({ ...s })),
    promotions: PROMOTIONS.map((p) => ({
      ...p,
      channels: [...p.channels],
      locationIds:
        p.locationIds === "all" ? ("all" as const) : [...p.locationIds],
    })),
    onlineOrders: ONLINE_ORDERS.map((o) => ({
      ...o,
      items: o.items.map((i) => ({ ...i })),
    })),
    catering: CATERING.map((c) => ({ ...c })),
    payouts: PAYOUTS.map((p) => ({ ...p })),
    campaigns: CAMPAIGNS.map((c) => ({ ...c })),
    drivers: DRIVERS.map((d) => ({ ...d })),
    houseAccounts: HOUSE_ACCOUNTS.map((h) => ({ ...h })),
    integrations: INTEGRATIONS.map((i) => ({ ...i })),
    checklists: CHECKLISTS.map((c) => ({
      ...c,
      items: c.items.map((i) => ({ ...i })),
    })),
    platformView: null as PlatformView | null,
    onlineCart: [] as PlatformState["onlineCart"],
    onlineGuestName: "",
    onlinePromo: "",
    fulfillmentSettings: { ...DEFAULT_FULFILLMENT },
    hallCart: [] as PlatformState["hallCart"],
  };
}

export const usePlatformStore = create<PlatformState>()(
  persist(
    (set, get) => ({
      ...initial(),

      setActiveLocation: (id) => {
        const loc = get().locations.find((l) => l.id === id);
        set({
          activeLocationId: id,
          activeTenantId: loc?.tenantId ?? get().activeTenantId,
        });
      },
      setActiveTenant: (id) => set({ activeTenantId: id }),
      setPlatformView: (v) => set({ platformView: v }),
      toggleLocationOpen: (id) =>
        set({
          locations: get().locations.map((l) =>
            l.id === id ? { ...l, open: !l.open } : l,
          ),
        }),

      updateOnlineStatus: (id, status) =>
        set({
          onlineOrders: get().onlineOrders.map((o) =>
            o.id === id ? { ...o, status } : o,
          ),
        }),

      acceptOnlineOrder: (id) => {
        const o = get().onlineOrders.find((x) => x.id === id);
        if (!o) return;
        const mode = o.kitchenFireMode ?? "immediate";
        const delay = o.delayMinutes ?? get().fulfillmentSettings.defaultDelayMinutes;
        let fireAt = o.fireAt;
        let kitchenStatus = o.kitchenStatus ?? "pending_fire";
        if (mode === "immediate") {
          kitchenStatus = "pending_fire";
          fireAt = Date.now();
        } else if (mode === "delay_after_order") {
          fireAt = Date.now() + delay * 60_000;
          kitchenStatus = "pending_fire";
        } else {
          // on_arrival / delay_after_arrival — wait
          kitchenStatus = "pending_fire";
          fireAt = undefined;
        }
        set({
          onlineOrders: get().onlineOrders.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: "accepted",
                  fireAt,
                  kitchenStatus,
                }
              : x,
          ),
        });
        if (mode === "immediate") {
          get().fireOnlineOrderToKitchen(id);
        } else if (mode === "delay_after_order") {
          // queue will pick up via processKitchenFireQueue
        }
      },

      addToOnlineCart: (item) => {
        const cart = [...get().onlineCart];
        const existing = cart.find((c) => c.menuItemId === item.menuItemId);
        if (existing) {
          existing.qty += 1;
        } else {
          cart.push({ ...item, qty: 1 });
        }
        set({ onlineCart: cart });
      },

      clearOnlineCart: () => set({ onlineCart: [] }),
      setOnlineGuestName: (n) => set({ onlineGuestName: n }),
      setOnlinePromo: (c) => set({ onlinePromo: c }),

      placeOnlineOrder: ({
        guestName,
        type,
        channel,
        promoCode,
        tableLabel,
        tableId,
        address,
        guestPhone,
        kitchenFireMode,
        delayMinutes,
        vehicleDescription,
        vehicleColor,
        notes,
      }) => {
        const cart = get().onlineCart;
        if (cart.length === 0) return { ok: false, error: "Cart empty" };
        if (!guestName.trim()) return { ok: false, error: "Name required" };
        const loc = get().getActiveLocation();
        if (!loc) return { ok: false, error: "No location" };
        const settings = get().fulfillmentSettings;

        let subtotal = cart.reduce(
          (s, i) => s + i.unitPriceCents * i.qty,
          0,
        );
        let discount = 0;
        const code = (promoCode || get().onlinePromo || "").toUpperCase();
        if (code) {
          const promo = get().promotions.find(
            (p) =>
              p.active &&
              p.code?.toUpperCase() === code &&
              p.channels.some((c) =>
                ["online", "takeout", "delivery"].includes(c),
              ),
          );
          if (promo?.type === "percent") {
            discount = Math.round(subtotal * (promo.value / 100));
          } else if (promo?.type === "fixed") {
            discount = promo.value;
          }
        }
        subtotal = Math.max(0, subtotal - discount);
        const tax = Math.round(subtotal * 0.0875);
        const deliveryFee = type === "delivery" ? 399 : 0;
        const tip = Math.round(subtotal * 0.15);
        const total = subtotal + tax + deliveryFee + tip;
        const maxNum = get().onlineOrders.reduce(
          (m, o) => Math.max(m, o.number),
          5000,
        );
        const mode =
          kitchenFireMode ?? defaultFireModeForType(type, settings);
        const delay = delayMinutes ?? settings.defaultDelayMinutes;
        const claim = claimCode();
        const now = Date.now();
        let fireAt: number | undefined;
        if (mode === "immediate") fireAt = now;
        else if (mode === "delay_after_order")
          fireAt = now + delay * 60_000;

        const order: OnlineOrder = {
          id: uid("oo"),
          number: maxNum + 1,
          channel,
          type,
          status: "placed",
          guestName: guestName.trim(),
          guestPhone,
          locationId: loc.id,
          tenantId: loc.tenantId,
          tableLabel,
          tableId,
          address,
          items: cart.map((c) => ({ ...c })),
          subtotalCents: subtotal + discount,
          taxCents: tax,
          tipCents: tip,
          deliveryFeeCents: deliveryFee,
          totalCents: total,
          promoCode: code || undefined,
          discountCents: discount,
          paymentStatus: "paid",
          createdAt: now,
          promisedAt: now + 1000 * 60 * settings.defaultPromiseMinutes,
          claimCode: claim,
          kitchenFireMode: mode,
          delayMinutes: delay,
          fireAt,
          kitchenStatus: "pending_fire",
          arrivalStatus:
            type === "dine_in_qr" && tableLabel
              ? "seated"
              : type === "order_ahead" || type === "curbside"
                ? "awaiting"
                : "awaiting",
          vehicleDescription,
          vehicleColor,
          notes,
        };
        set({
          onlineOrders: [order, ...get().onlineOrders],
          onlineCart: [],
          onlinePromo: "",
        });

        if (settings.autoAcceptOnline) {
          get().acceptOnlineOrder(order.id);
        } else if (mode === "immediate" && type === "dine_in_qr") {
          // QR at table often auto-fires after place when accepted; leave to staff
        }

        return {
          ok: true,
          orderId: order.id,
          claimCode: claim,
          number: order.number,
        };
      },

      updateFulfillmentSettings: (patch) =>
        set({
          fulfillmentSettings: { ...get().fulfillmentSettings, ...patch },
        }),

      findOrderByClaim: (code) => {
        const c = code.trim().toUpperCase();
        return get().onlineOrders.find(
          (o) => o.claimCode?.toUpperCase() === c || String(o.number) === c,
        );
      },

      markGuestArrived: (id, opts) => {
        const o = get().onlineOrders.find((x) => x.id === id);
        if (!o) return { ok: false, error: "Order not found" };
        if (["completed", "cancelled"].includes(o.status))
          return { ok: false, error: "Order closed" };
        const settings = get().fulfillmentSettings;
        const mode = o.kitchenFireMode ?? "on_arrival";
        const delay =
          o.delayMinutes ?? settings.defaultDelayMinutes;
        if (
          settings.requireTableOnArrival &&
          (o.type === "order_ahead" || o.type === "dine_in_qr") &&
          !opts?.tableLabel &&
          !o.tableLabel
        ) {
          return { ok: false, error: "Table number required" };
        }
        const now = Date.now();
        let fireAt = o.fireAt;
        if (mode === "on_arrival") fireAt = now;
        else if (mode === "delay_after_arrival")
          fireAt = now + delay * 60_000;

        set({
          onlineOrders: get().onlineOrders.map((x) =>
            x.id === id
              ? {
                  ...x,
                  arrivalStatus: opts?.tableLabel || x.tableLabel ? "seated" : "arrived",
                  arrivedAt: now,
                  tableLabel: opts?.tableLabel ?? x.tableLabel,
                  tableId: opts?.tableId ?? x.tableId,
                  vehicleDescription:
                    opts?.vehicleDescription ?? x.vehicleDescription,
                  fireAt,
                  status:
                    x.status === "placed" ? "accepted" : x.status,
                }
              : x,
          ),
        });

        if (mode === "on_arrival") {
          get().fireOnlineOrderToKitchen(id);
        }
        return { ok: true };
      },

      linkOrderToTable: (id, tableLabel, tableId) => {
        const o = get().onlineOrders.find((x) => x.id === id);
        if (!o) return { ok: false, error: "Order not found" };
        set({
          onlineOrders: get().onlineOrders.map((x) =>
            x.id === id
              ? {
                  ...x,
                  tableLabel,
                  tableId,
                  arrivalStatus: "seated",
                  arrivedAt: x.arrivedAt ?? Date.now(),
                }
              : x,
          ),
        });
        // If waiting on arrival to fire, fire now
        const updated = get().onlineOrders.find((x) => x.id === id)!;
        if (
          updated.kitchenStatus !== "fired" &&
          (updated.kitchenFireMode === "on_arrival" ||
            !updated.kitchenFireMode)
        ) {
          get().fireOnlineOrderToKitchen(id);
        }
        return { ok: true };
      },

      fireOnlineOrderToKitchen: (id) => {
        const o = get().onlineOrders.find((x) => x.id === id);
        if (!o) return { ok: false, error: "Order not found" };
        if (o.kitchenStatus === "fired" && o.firedToKitchenAt)
          return { ok: true };

        const pos = usePosStore.getState();
        const menuById = new Map(pos.menuItems.map((m) => [m.id, m]));
        const now = Date.now();
        const tableLabel =
          o.tableLabel
            ? `T${o.tableLabel}`
            : o.type === "curbside"
              ? `Curbside ${o.vehicleColor ?? ""} ${o.vehicleDescription ?? ""}`.trim()
              : o.type === "order_ahead"
                ? `Ahead #${o.number}`
                : o.type === "takeout"
                  ? `Togo #${o.number}`
                  : o.type === "delivery"
                    ? `Delivery #${o.number}`
                    : `#${o.number}`;

        // Group by station from menu item
        const byStation = new Map<string, typeof o.items>();
        for (const line of o.items) {
          const mi = menuById.get(line.menuItemId);
          const station = mi?.station ?? "kitchen";
          const arr = byStation.get(station) ?? [];
          arr.push(line);
          byStation.set(station, arr);
        }

        const newTickets: KitchenTicket[] = [];
        for (const [station, lines] of byStation) {
          const first = lines[0]!;
          const mi = menuById.get(first.menuItemId);
          newTickets.push({
            id: uid("kt"),
            orderId: o.id,
            orderNumber: o.number,
            tableLabel,
            serverName: "Online",
            station: station as KitchenTicket["station"],
            vendorId: mi?.vendorId,
            vendorName: mi?.vendorId
              ? pos.vendors.find((v) => v.id === mi.vendorId)?.shortName
              : undefined,
            status: "new",
            course: "entree",
            createdAt: now,
            elapsedSec: 0,
            items: lines.map((l) => ({
              lineId: uid("ol"),
              name: l.name,
              quantity: l.qty,
              modifiers: [],
              note: l.notes,
              course: "entree" as const,
            })),
          });
        }

        usePosStore.setState({
          tickets: [...newTickets, ...pos.tickets],
        });

        set({
          onlineOrders: get().onlineOrders.map((x) =>
            x.id === id
              ? {
                  ...x,
                  kitchenStatus: "fired",
                  firedToKitchenAt: now,
                  status:
                    x.status === "placed" || x.status === "accepted"
                      ? "preparing"
                      : x.status,
                }
              : x,
          ),
        });
        return { ok: true };
      },

      processKitchenFireQueue: () => {
        const now = Date.now();
        let n = 0;
        for (const o of get().onlineOrders) {
          if (o.kitchenStatus === "fired") continue;
          if (["completed", "cancelled"].includes(o.status)) continue;
          if (o.fireAt && o.fireAt <= now) {
            const r = get().fireOnlineOrderToKitchen(o.id);
            if (r.ok) n += 1;
          }
        }
        return n;
      },

      addHallCartItem: (item) => {
        const cart = [...get().hallCart];
        const existing = cart.find(
          (c) =>
            c.tenantId === item.tenantId && c.menuItemId === item.menuItemId,
        );
        if (existing) existing.qty += 1;
        else cart.push({ ...item, qty: 1 });
        set({ hallCart: cart });
      },

      checkoutHallCart: (guestName) => {
        const cart = get().hallCart;
        if (!cart.length) return { ok: false, splits: [] };
        const byTenant = new Map<string, typeof cart>();
        for (const line of cart) {
          const arr = byTenant.get(line.tenantId) ?? [];
          arr.push(line);
          byTenant.set(line.tenantId, arr);
        }
        const splits: { tenantId: string; totalCents: number }[] = [];
        const newOrders: OnlineOrder[] = [];
        let n =
          get().onlineOrders.reduce((m, o) => Math.max(m, o.number), 5000) + 1;
        for (const [tenantId, lines] of byTenant) {
          const sub = lines.reduce(
            (s, l) => s + l.unitPriceCents * l.qty,
            0,
          );
          const tax = Math.round(sub * 0.0875);
          const total = sub + tax;
          splits.push({ tenantId, totalCents: total });
          const loc =
            get().locations.find((l) => l.tenantId === tenantId) ??
            get().locations[0]!;
          newOrders.push({
            id: uid("oo"),
            number: n++,
            channel: "kiosk",
            type: "takeout",
            status: "placed",
            guestName: guestName || "Hall guest",
            locationId: loc.id,
            tenantId,
            items: lines.map((l) => ({
              menuItemId: l.menuItemId,
              name: l.name,
              qty: l.qty,
              unitPriceCents: l.unitPriceCents,
            })),
            subtotalCents: sub,
            taxCents: tax,
            tipCents: 0,
            deliveryFeeCents: 0,
            totalCents: total,
            discountCents: 0,
            paymentStatus: "paid",
            createdAt: Date.now(),
          });
        }
        set({
          onlineOrders: [...newOrders, ...get().onlineOrders],
          hallCart: [],
        });
        return { ok: true, splits };
      },

      togglePromo: (id) =>
        set({
          promotions: get().promotions.map((p) =>
            p.id === id ? { ...p, active: !p.active } : p,
          ),
        }),

      addPromo: (p) =>
        set({
          promotions: [...get().promotions, { ...p, id: uid("promo") }],
        }),

      addShift: (s) =>
        set({
          schedule: [...get().schedule, { ...s, id: uid("sh") }],
        }),

      publishSchedule: (locationId) =>
        set({
          schedule: get().schedule.map((s) =>
            s.locationId === locationId ? { ...s, published: true } : s,
          ),
        }),

      removeShift: (id) =>
        set({ schedule: get().schedule.filter((s) => s.id !== id) }),

      updateCateringStatus: (id, status) =>
        set({
          catering: get().catering.map((c) =>
            c.id === id ? { ...c, status } : c,
          ),
        }),

      addCatering: (c) =>
        set({
          catering: [...get().catering, { ...c, id: uid("cat") }],
        }),

      receivePO: (id) =>
        set({
          purchaseOrders: get().purchaseOrders.map((p) =>
            p.id === id ? { ...p, status: "received" } : p,
          ),
        }),

      sendPO: (id) =>
        set({
          purchaseOrders: get().purchaseOrders.map((p) =>
            p.id === id ? { ...p, status: "sent" } : p,
          ),
        }),

      markPayoutPaid: (id) =>
        set({
          payouts: get().payouts.map((p) =>
            p.id === id
              ? { ...p, status: "paid", paidAt: Date.now() }
              : p,
          ),
        }),

      recalculatePayouts: () => {
        // Demo: bump net slightly to show recalc
        set({
          payouts: get().payouts.map((p) =>
            p.status === "pending"
              ? {
                  ...p,
                  netPayoutCents: Math.max(
                    0,
                    p.grossSalesCents -
                      p.feesCents -
                      p.commonsCents -
                      p.refundsCents,
                  ),
                }
              : p,
          ),
        });
      },

      assignDriver: (orderId, driverId) => {
        set({
          drivers: get().drivers.map((d) =>
            d.id === driverId
              ? { ...d, status: "en_route", activeOrderId: orderId }
              : d.activeOrderId === orderId
                ? { ...d, status: "available", activeOrderId: undefined }
                : d,
          ),
          onlineOrders: get().onlineOrders.map((o) =>
            o.id === orderId ? { ...o, status: "out_for_delivery" } : o,
          ),
        });
      },

      toggleIntegration: (id) =>
        set({
          integrations: get().integrations.map((i) =>
            i.id === id
              ? {
                  ...i,
                  connected: !i.connected,
                  lastSyncAt: !i.connected ? Date.now() : i.lastSyncAt,
                }
              : i,
          ),
        }),

      toggleChecklistItem: (listId, itemId) =>
        set({
          checklists: get().checklists.map((list) =>
            list.id !== listId
              ? list
              : {
                  ...list,
                  items: list.items.map((it) =>
                    it.id === itemId ? { ...it, done: !it.done } : it,
                  ),
                },
          ),
        }),

      chargeHouseAccount: (id, amountCents) => {
        const ha = get().houseAccounts.find((h) => h.id === id);
        if (!ha || !ha.active) return { ok: false, error: "Inactive account" };
        if (ha.balanceCents + amountCents > ha.creditLimitCents)
          return { ok: false, error: "Over credit limit" };
        set({
          houseAccounts: get().houseAccounts.map((h) =>
            h.id === id
              ? { ...h, balanceCents: h.balanceCents + amountCents }
              : h,
          ),
        });
        return { ok: true };
      },

      sendCampaign: (id) =>
        set({
          campaigns: get().campaigns.map((c) =>
            c.id === id
              ? { ...c, status: "sent", sentAt: Date.now() }
              : c,
          ),
        }),

      getActiveLocation: () =>
        get().locations.find((l) => l.id === get().activeLocationId) ?? null,

      getActiveTenant: () =>
        get().tenants.find((t) => t.id === get().activeTenantId) ?? null,

      hallSettlementPreview: () => {
        const building = get().buildings[0];
        if (!building) return [];
        return get()
          .tenants.filter((t) =>
            t.locationIds.some((lid) => building.locationIds.includes(lid)),
          )
          .map((t) => {
            const payout = get().payouts.find((p) => p.tenantId === t.id);
            return {
              tenantId: t.id,
              name: t.name,
              gross: payout?.grossSalesCents ?? 0,
              fees: payout?.feesCents ?? 0,
              commons: payout?.commonsCents ?? 0,
              net: payout?.netPayoutCents ?? 0,
            };
          });
      },
    }),
    {
      name: "zest-platform-v3",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        buildings: s.buildings,
        tenants: s.tenants,
        locations: s.locations,
        activeLocationId: s.activeLocationId,
        activeTenantId: s.activeTenantId,
        recipes: s.recipes,
        purchaseOrders: s.purchaseOrders,
        schedule: s.schedule,
        promotions: s.promotions,
        onlineOrders: s.onlineOrders,
        catering: s.catering,
        payouts: s.payouts,
        campaigns: s.campaigns,
        drivers: s.drivers,
        houseAccounts: s.houseAccounts,
        integrations: s.integrations,
        checklists: s.checklists,
        fulfillmentSettings: s.fulfillmentSettings,
      }),
    },
  ),
);
