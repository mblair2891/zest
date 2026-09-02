import { createServerFn } from "@tanstack/react-start";
import { tenantMiddleware } from "@/lib/saas/tenant-middleware";
import {
  DEFAULT_FRONT_SETTINGS,
  WAITLIST_REASONS,
  type FrontSettings,
  type KioskMode,
  type ReservationStatus,
  type WaitlistReason,
  type WaitlistStatus,
} from "./types";

function loc(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 80) throw new Error("Location is required");
  return s;
}

export const getKioskSnapshotFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; openKitchenTickets?: number; openTables?: number; occupiedTables?: number }) => ({
    locationId: loc(d.locationId),
    openKitchenTickets: Number(d.openKitchenTickets) || 0,
    openTables: Number(d.openTables) || 0,
    occupiedTables: Number(d.occupiedTables) || 0,
  }))
  .handler(async ({ data }) => {
    const { getFrontSettings, listWaitlist, ensureDemoReservation } = await import(
      "./store.server"
    );
    const { estimateWaitMinutes } = await import("./wait-estimate.server");
    const settings = await getFrontSettings(data.locationId);
    await ensureDemoReservation(data.locationId).catch(() => undefined);
    const waiting = (await listWaitlist(data.locationId)).filter(
      (w) => w.status === "waiting" || w.status === "notified",
    );
    const estimate = await estimateWaitMinutes({
      locationId: data.locationId,
      settings,
      openKitchenTickets: data.openKitchenTickets,
      openTables: data.openTables,
      occupiedTables: data.occupiedTables,
    });
    return {
      settings,
      waitingCount: waiting.length,
      estimate,
    };
  });

export const estimateWaitFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; openKitchenTickets?: number; openTables?: number; occupiedTables?: number }) => ({
    locationId: loc(d.locationId),
    openKitchenTickets: Number(d.openKitchenTickets) || 0,
    openTables: Number(d.openTables) || 0,
    occupiedTables: Number(d.occupiedTables) || 0,
  }))
  .handler(async ({ data }) => {
    const { getFrontSettings } = await import("./store.server");
    const { estimateWaitMinutes } = await import("./wait-estimate.server");
    const settings = await getFrontSettings(data.locationId);
    return estimateWaitMinutes({ ...data, settings });
  });

export const joinWaitlistFn = createServerFn({ method: "POST" })
  .validator((d: {
    locationId: string;
    name: string;
    phone: string;
    partySize: number;
    openKitchenTickets?: number;
    openTables?: number;
    occupiedTables?: number;
  }) => ({
    locationId: loc(d.locationId),
    name: String(d.name ?? "").trim(),
    phone: String(d.phone ?? "").trim(),
    partySize: Number(d.partySize) || 2,
    openKitchenTickets: Number(d.openKitchenTickets) || 0,
    openTables: Number(d.openTables) || 0,
    occupiedTables: Number(d.occupiedTables) || 0,
  }))
  .handler(async ({ data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    if (rateLimit(`wl:${data.locationId}:${data.phone}`, 8, 60_000)) {
      throw new Error("Too many waitlist tries — wait a minute");
    }
    const { joinWaitlist } = await import("./store.server");
    return joinWaitlist(data);
  });

export const checkInReservationFn = createServerFn({ method: "POST" })
  .validator((d: { locationId: string; lastName: string; code: string }) => ({
    locationId: loc(d.locationId),
    lastName: String(d.lastName ?? "").trim(),
    code: String(d.code ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    if (rateLimit(`ci:${data.locationId}`, 30, 60_000)) {
      throw new Error("Too many check-in tries");
    }
    const { checkInReservation } = await import("./store.server");
    return checkInReservation(data);
  });

export const bookReservationFn = createServerFn({ method: "POST" })
  .validator((d: {
    locationId: string;
    name: string;
    partySize: number;
    at: string;
    phone?: string;
    email?: string;
    tableSuggestion?: string;
  }) => ({
    locationId: loc(d.locationId),
    name: String(d.name ?? "").trim(),
    partySize: Number(d.partySize) || 2,
    at: String(d.at ?? ""),
    phone: d.phone ? String(d.phone) : undefined,
    email: d.email ? String(d.email) : undefined,
    tableSuggestion: d.tableSuggestion ? String(d.tableSuggestion) : undefined,
  }))
  .handler(async ({ data }) => {
    const { rateLimit } = await import("@/lib/saas/rate-limit.server");
    if (rateLimit(`book:${data.locationId}`, 20, 60_000)) {
      throw new Error("Too many bookings — try again shortly");
    }
    const { bookReservation } = await import("./store.server");
    return bookReservation(data);
  });

export const optOutWaitlistFn = createServerFn({ method: "POST" })
  .validator((d: { token: string }) => ({
    token: String(d.token ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    if (!data.token) throw new Error("Missing link");
    const { optOutWaitlist } = await import("./store.server");
    return optOutWaitlist(data.token);
  });

export const listFrontBoardFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { locationId: string }) => ({ locationId: loc(d.locationId) }))
  .handler(async ({ data }) => {
    const { listWaitlist, listReservations, getFrontSettings } = await import(
      "./store.server"
    );
    const { listRecentMessages } = await import("./messaging.server");
    const [settings, waitlist, reservations, messages] = await Promise.all([
      getFrontSettings(data.locationId),
      listWaitlist(data.locationId),
      listReservations(data.locationId),
      listRecentMessages(data.locationId, 12),
    ]);
    return { settings, waitlist, reservations, messages };
  });

export const saveFrontSettingsFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: {
    locationId: string;
    kioskMode?: KioskMode;
    waitlistEnabled?: boolean;
    waitlistReason?: WaitlistReason | null;
    smsFrom?: string | null;
    smsEnabled?: boolean;
    smsMonthlyCap?: number | null;
  }) => ({
    locationId: loc(d.locationId),
    kioskMode: d.kioskMode,
    waitlistEnabled: d.waitlistEnabled,
    waitlistReason: d.waitlistReason,
    smsFrom: d.smsFrom,
    smsEnabled: d.smsEnabled,
    smsMonthlyCap: d.smsMonthlyCap,
  }))
  .handler(async ({ context, data }) => {
    if (context.userId) {
      const { assertHostLocationWrite } = await import("@/lib/access/assert-host.server");
      try {
        await assertHostLocationWrite(context.userId, data.locationId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg === "Location not found") {
          /* prospect demo / local kiosk row */
        } else {
          throw e;
        }
      }
    }
    const { saveFrontSettings } = await import("./store.server");
    const patch: Partial<FrontSettings> = {};
    if (data.kioskMode) patch.kioskMode = data.kioskMode;
    if (typeof data.waitlistEnabled === "boolean") patch.waitlistEnabled = data.waitlistEnabled;
    if (data.waitlistReason !== undefined) patch.waitlistReason = data.waitlistReason;
    if (data.smsFrom !== undefined) patch.smsFrom = data.smsFrom;
    if (typeof data.smsEnabled === "boolean") patch.smsEnabled = data.smsEnabled;
    if (data.smsMonthlyCap !== undefined) {
      patch.smsMonthlyCap =
        data.smsMonthlyCap == null || !Number.isFinite(Number(data.smsMonthlyCap))
          ? null
          : Math.max(0, Math.floor(Number(data.smsMonthlyCap)));
    }
    return saveFrontSettings(data.locationId, patch);
  });

export const setWaitlistStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { id: string; status: WaitlistStatus }) => ({
    id: String(d.id ?? ""),
    status: d.status,
  }))
  .handler(async ({ context, data }) => {
    if (!data.id) throw new Error("Missing guest");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ location_id: string }>`
      select location_id from waitlist_entries where id = ${data.id} limit 1
    `;
    if (!rows[0]) throw new Error("Missing guest");
    const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
    await bindTenant(context.userId, { locationId: rows[0].location_id });
    const { setWaitlistStatus } = await import("./store.server");
    return setWaitlistStatus(data.id, data.status);
  });

export const setReservationStatusFn = createServerFn({ method: "POST" })
  .middleware([tenantMiddleware])
  .validator((d: { id: string; status: ReservationStatus }) => ({
    id: String(d.id ?? ""),
    status: d.status,
  }))
  .handler(async ({ context, data }) => {
    if (!data.id) throw new Error("Missing reservation");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ location_id: string }>`
      select location_id from reservations where id = ${data.id} limit 1
    `;
    if (!rows[0]) throw new Error("Missing reservation");
    const { bindTenant } = await import("@/lib/saas/assert-tenant.server");
    await bindTenant(context.userId, { locationId: rows[0].location_id });
    const { updateReservationStatus } = await import("./store.server");
    await updateReservationStatus(data.id, data.status);
    return { ok: true as const };
  });

export { DEFAULT_FRONT_SETTINGS, WAITLIST_REASONS };
