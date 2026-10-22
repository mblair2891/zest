import { useEffect, useMemo, useState } from "react";
import { lookupGiftCardFn } from "@/lib/gift/api";
import {
  applyEloMsrSwipe,
  giftLedgerIntent,
  preferredMsrGiftAction,
  pushWedgeKey,
  selectStationStripeReader,
  stationHasUsbGiftMsr,
  type MsrGiftAction,
  type MsrSwipeEvent,
  type WedgeBuffer,
} from "@/lib/pos/elo-msr";
import { recordEloMsrSwipeFn, takeEloMsrSwipeFn } from "@/lib/pos/elo-msr.api";
import { readPairedDeviceId } from "@/lib/pos/location-devices";
import { usePosStore } from "@/lib/pos/store";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import { formatCurrency } from "@/lib/utils";
import { isStationPinPath } from "@/lib/pos/device-roles";
import { readStationPair } from "@/lib/pos/station-pair";

function stationIdNow(): string {
  const pair = readStationPair();
  if (isStationPinPath() && pair?.deviceId) return pair.deviceId;
  const state = usePosStore.getState();
  if (state.activeDeviceId) return state.activeDeviceId;
  if (pair?.deviceId) return pair.deviceId;
  const loc = state.tenantLocationId || pair?.locationId || "";
  return loc ? readPairedDeviceId(loc) || "" : "";
}

async function describeSwipe(event: MsrSwipeEvent, locationId: string): Promise<string> {
  window.dispatchEvent(new CustomEvent("summex-msr-swipe", { detail: event }));
  const intent = giftLedgerIntent(event);
  if (intent.op === "lookup" || intent.op === "redeem") {
    try {
      const res = await lookupGiftCardFn({ data: { locationId, code: intent.code } });
      const balance = res.ok
        ? `Balance ${formatCurrency(res.card.balanceCents)}`
        : res.error || "Card not found";
      const action = intent.op === "redeem" ? "Redeem" : "Balance";
      return `${action} received on this station. ${event.summary}. ${balance}`;
    } catch (e) {
      return e instanceof Error ? e.message : "Gift lookup failed";
    }
  }
  if (intent.op === "issue") {
    return `Load received on this station. ${event.summary}. Enter the amount on Gift, then sell.`;
  }
  return `Swipe received on this station. ${event.summary}`;
}

/** Linked tablet: keyboard wedge plus swipes sent from Devices. */
export function EloMsrStation() {
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const tenantLocationId = usePosStore((s) => s.tenantLocationId);
  const [line, setLine] = useState<string | null>(null);
  const stationId = useMemo(() => {
    const pair = readStationPair();
    if (isStationPinPath() && pair?.deviceId) return pair.deviceId;
    if (activeDeviceId) return activeDeviceId;
    if (pair?.deviceId) return pair.deviceId;
    const loc = tenantLocationId || pair?.locationId || "";
    return loc ? readPairedDeviceId(loc) || "" : "";
  }, [activeDeviceId, tenantLocationId]);

  useEffect(() => {
    const locationId = tenantLocationId || readTenantPosContext()?.locationId || "";
    const orgId = readTenantPosContext()?.orgId || "";
    if (!stationId || !locationId) return;
    let cancel = false;
    const tick = async () => {
      try {
        const res = await takeEloMsrSwipeFn({
          data: { orgId, locationId, stationId },
        });
        if (cancel || !res.event) return;
        const text = await describeSwipe(res.event, locationId);
        if (!cancel) setLine(text);
      } catch {
        /* This station is not signed in to the location. A wedge still works. */
      }
    };
    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [stationId, tenantLocationId]);

  useEffect(() => {
    let buffer: WedgeBuffer = { buf: "", at: 0 };
    const onKey = (ev: KeyboardEvent) => {
      const key = ev.key;
      if (key !== "Enter" && key.length !== 1) return;
      const target = ev.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA");
      const armed = buffer.buf.startsWith(";") || buffer.buf.startsWith("%") || key === ";" || key === "%";
      if (typing && !armed) return;
      const next = pushWedgeKey(buffer, key, Date.now());
      buffer = next.state;
      if (!next.done) {
        if (armed) ev.preventDefault();
        return;
      }
      ev.preventDefault();
      const sid = stationIdNow();
      const rows = usePosStore.getState().locationDevices ?? [];
      const action = preferredMsrGiftAction();
      const reader = selectStationStripeReader(rows, sid, action);
      if (!reader) return;
      const giftReader =
        reader.type === "gift_msr" || stationHasUsbGiftMsr(reader) || reader.msr?.role === "gift";
      const applied = applyEloMsrSwipe(rows, reader.id, next.done, {
        handled: true,
        giftAction: giftReader ? action : undefined,
      });
      if (!applied.event) return;
      usePosStore.setState({ locationDevices: applied.devices });
      const locationId =
        usePosStore.getState().tenantLocationId || readTenantPosContext()?.locationId || "";
      if (locationId) {
        void describeSwipe(applied.event, locationId).then(setLine);
        void recordEloMsrSwipeFn({
          data: {
            orgId: readTenantPosContext()?.orgId || "",
            locationId,
            deviceId: reader.id,
            raw: next.done,
            giftAction: giftReader ? action : undefined,
            handled: true,
          },
        }).catch(() => undefined);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  if (!line) return null;
  return (
    <p
      className="border-b border-border bg-surface px-3 py-2 text-sm"
      role="status"
      data-msr-received
    >
      {line}
    </p>
  );
}

/** Gift load or redeem on this station names the USB reader assigned here. */
export function UsbGiftMsrNote({ action }: { action: MsrGiftAction }) {
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const tenantLocationId = usePosStore((s) => s.tenantLocationId);
  const devices = usePosStore((s) => s.locationDevices);
  const stationId = useMemo(() => {
    const pair = readStationPair();
    if (isStationPinPath() && pair?.deviceId) return pair.deviceId;
    if (activeDeviceId) return activeDeviceId;
    if (pair?.deviceId) return pair.deviceId;
    const loc = tenantLocationId || pair?.locationId || "";
    return loc ? readPairedDeviceId(loc) || "" : "";
  }, [activeDeviceId, tenantLocationId]);
  const reader = selectStationStripeReader(devices ?? [], stationId, action);
  if (!reader || !(reader.type === "gift_msr" || stationHasUsbGiftMsr(reader))) return null;
  return (
    <p className="text-xs text-muted-foreground" data-usb-gift-msr>
      This station uses the USB magstripe reader for gift cards.
    </p>
  );
}
