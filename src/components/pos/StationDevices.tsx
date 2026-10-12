import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { saveLocationDeviceFn } from "@/lib/access/api";
import { finixConnectAuthFn, getPaymentsStatusFn, listPaxReadersFn, paxReaderSessionFn } from "@/lib/payments/api";
import {
  PAX_MSG,
  decideStationReaderConnect,
  finixConnectBanner,
  finixConnectDiagnostic,
  logFinixConnectDiagnostic,
  paxLinkStatusText,
  paxScanPresentation,
  presentFinixConnectFailure,
  runPaxConnect,
  type PaxReader,
  type PaxScanRow,
} from "@/lib/payments/pax-d135";
import { connectForPaxReader, paxReaderOnThisStation, scanForPaxReaders } from "@/lib/payments/pax-d135-native";
import { noteStationActivity } from "@/lib/payments/station-activity";
import {
  beginPaxConnect,
  beginPaxScan,
  failPaxConnect,
  finishPaxScan,
  getPaxStationLink,
  markPaxConnected,
  showPaxConnectBanner,
  notePaxStatus,
  setPaxReaders,
  usePaxStationLink,
} from "@/lib/pos/pax-station-link";
import { isStationPinPath } from "@/lib/pos/device-roles";
import { readPairedDeviceId } from "@/lib/pos/location-devices";
import { readStationPair } from "@/lib/pos/station-pair";
import { usePosStore } from "@/lib/pos/store";
import {
  assignedStationSystems,
  stationHealthNotices,
  type PrinterProbeState,
} from "@/lib/pos/station-device-health";
import { probePrinter } from "@/lib/print/printer-probe";
import { readTenantPosContext } from "@/lib/saas/pos-context";

let devicesOpen = false;
const openListeners = new Set<() => void>();

function setStationDevicesOpen(open: boolean): void {
  devicesOpen = open;
  for (const listener of openListeners) listener();
}

function useStationDevicesOpen(): boolean {
  return useSyncExternalStore(
    (listener) => {
      openListeners.add(listener);
      return () => openListeners.delete(listener);
    },
    () => devicesOpen,
    () => false,
  );
}

function stationIdNow(): string {
  const pair = readStationPair();
  if (isStationPinPath() && pair?.deviceId) return pair.deviceId;
  const state = usePosStore.getState();
  if (state.activeDeviceId) return state.activeDeviceId;
  if (pair?.deviceId) return pair.deviceId;
  const loc = state.tenantLocationId || pair?.locationId || "";
  return loc ? readPairedDeviceId(loc) || "" : "";
}

function locationIdNow(): string {
  return (
    usePosStore.getState().tenantLocationId ||
    readTenantPosContext()?.locationId ||
    readStationPair()?.locationId ||
    ""
  );
}

function useStationReaders(): void {
  const published = usePosStore((s) => s.settings.paxReaders);
  const loc = usePosStore((s) => s.tenantLocationId);
  useEffect(() => {
    const locationId = loc || readTenantPosContext()?.locationId || readStationPair()?.locationId || "";
    const fromSettings = published ?? [];
    if (!locationId) {
      setPaxReaders(fromSettings);
      return;
    }
    let cancel = false;
    void listPaxReadersFn({ data: { locationId } })
      .then((res) => {
        if (cancel) return;
        const map = new Map<string, PaxReader>();
        for (const reader of [...fromSettings, ...(res.readers ?? [])]) map.set(reader.serial, reader);
        setPaxReaders([...map.values()]);
      })
      .catch(() => {
        if (!cancel) setPaxReaders(fromSettings);
      });
    return () => {
      cancel = true;
    };
  }, [loc, published]);
}

function useNativePaxStatus(): void {
  useEffect(() => {
    let remove: (() => void) | undefined;
    let cancel = false;
    void import("@/lib/payments/pax-d135-native").then(async (mod) => {
      if (cancel || !mod.paxReaderOnThisStation()) return;
      const handle = await mod.paxPlugin.addListener("status", (status) => notePaxStatus(status));
      if (cancel) {
        void handle.remove();
        return;
      }
      remove = () => {
        void handle.remove();
      };
    });
    return () => {
      cancel = true;
      remove?.();
    };
  }, []);
}

export function StationDeviceHealthBanner() {
  useStationReaders();
  useNativePaxStatus();
  const devices = usePosStore((s) => s.locationDevices);
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const tenantLocationId = usePosStore((s) => s.tenantLocationId);
  const link = usePaxStationLink();
  const [probe, setProbe] = useState<Record<string, PrinterProbeState>>({});
  const stationId = useMemo(() => {
    const pair = readStationPair();
    if (isStationPinPath() && pair?.deviceId) return pair.deviceId;
    if (activeDeviceId) return activeDeviceId;
    if (pair?.deviceId) return pair.deviceId;
    const loc = tenantLocationId || pair?.locationId || "";
    return loc ? readPairedDeviceId(loc) || "" : "";
  }, [activeDeviceId, tenantLocationId]);
  const systems = useMemo(
    () =>
      assignedStationSystems({
        stationId,
        devices,
        readers: link.readers,
      }),
    [stationId, devices, link.readers],
  );
  const printerKey = systems
    .filter((system) => system.kind !== "card_reader")
    .map((system) => `${system.id}:${system.host ?? ""}:${system.port}`)
    .join("|");

  useEffect(() => {
    const targets = systems.filter((system) => system.kind !== "card_reader" && system.host);
    if (!targets.length) return;
    let cancel = false;
    setProbe((prev) => {
      const next = { ...prev };
      for (const target of targets) {
        if (!next[target.id]) next[target.id] = "pending";
      }
      return next;
    });
    for (const target of targets) {
      const host = target.host;
      if (!host) continue;
      void probePrinter(host, target.port).then((ok) => {
        if (cancel) return;
        setProbe((prev) => ({ ...prev, [target.id]: ok ? "up" : "down" }));
      });
    }
    return () => {
      cancel = true;
    };
    // printerKey is the assigned printer set. systems is read from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printerKey]);

  const notices = stationHealthNotices({
    systems,
    connectedSerial: link.phase === "connected" ? link.reader?.serial ?? null : null,
    probe,
  });
  if (!notices.length) return null;
  return (
    <div
      data-station-device-health
      role="status"
      className="border-b border-amber-700/30 bg-amber-500/15 px-4 py-2 text-sm font-medium text-foreground"
    >
      {notices.map((notice) => (
        <p key={`${notice.kind}:${notice.id}`}>{notice.text}</p>
      ))}
    </div>
  );
}

export function StationDevicesButton() {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      data-station-devices
      onClick={() => setStationDevicesOpen(true)}
    >
      Devices
    </Button>
  );
}

export function StationDevicesHost() {
  const open = useStationDevicesOpen();
  if (!open) return null;
  return <StationDeviceScreen onClose={() => setStationDevicesOpen(false)} />;
}

function StationDeviceScreen({ onClose }: { onClose: () => void }) {
  const link = usePaxStationLink();
  const devices = usePosStore((s) => s.locationDevices);
  const [busy, setBusy] = useState(false);
  const stationId = stationIdNow();
  const station = devices.find((device) => device.id === stationId) ?? null;
  const connectedSerial = link.phase === "connected" ? link.reader?.serial ?? "" : "";

  const scan = () => {
    void (async () => {
      beginPaxScan();
      try {
        const scanned = await scanForPaxReaders();
        finishPaxScan(paxScanPresentation(scanned, getPaxStationLink().readers));
      } catch {
        finishPaxScan({ phase: "idle", message: PAX_MSG.permissions, rows: [] });
      }
    })();
  };

  const pick = (row: PaxScanRow) => {
    void (async () => {
      const locationId = locationIdNow();
      let locationLive = false;
      if (locationId) {
        try {
          const status = await getPaymentsStatusFn({ data: { locationId } });
          locationLive = status.mode === "live" && !status.lifecycleForcesSandbox;
        } catch {
          locationLive = false;
        }
      }
      const decision = decideStationReaderConnect({
        row,
        readers: getPaxStationLink().readers,
        locationLive,
        assignedSerial: station?.cardReaderId ?? null,
      });
      const readerEntity = decision.ok ? decision.reader.entityName || decision.reader.entityId : "";
      if (!decision.ok) {
        await noteStationActivity({
          locationId,
          action: "connect",
          readerEntity,
          result: decision.message,
        });
        failPaxConnect(decision.message);
        return;
      }
      beginPaxConnect(decision.reader);
      setBusy(true);
      let diagnostic = "";
      const logConnect = async (result: string) => {
        await noteStationActivity({
          locationId,
          action: "connect",
          diagnostic,
          readerEntity,
          result,
        });
      };
      try {
        const session = await paxReaderSessionFn({
          data: {
            locationId,
            serial: decision.reader.serial,
            entityId: decision.reader.entityId,
          },
        });
        if (!session.ok) {
          await noteStationActivity({
            locationId,
            action: "Finix keys",
            usernamePresent: "no",
            passwordPresent: "no",
            readerEntity,
            result: session.error,
          });
          await logConnect(session.error);
          failPaxConnect(session.error);
          setBusy(false);
          return;
        }
        const creds = {
          userId: session.userId,
          password: session.password,
          merchantId: session.merchantId,
          deviceId: session.deviceId,
          env: session.env,
        };
        diagnostic = finixConnectDiagnostic(creds);
        logFinixConnectDiagnostic(diagnostic);
        await noteStationActivity({
          locationId,
          action: "Finix keys",
          diagnostic,
          readerEntity,
          result: diagnostic,
        });
        showPaxConnectBanner(diagnostic);
        if (!paxReaderOnThisStation()) {
          const auth = await finixConnectAuthFn({
            data: {
              locationId,
              serial: decision.reader.serial,
              entityId: decision.reader.entityId,
            },
          });
          if (!auth.ok) {
            const body = String(auth.error ?? "").trim();
            await logConnect(body || "Finix connect failed");
            failPaxConnect(finixConnectBanner(diagnostic, body));
            setBusy(false);
            return;
          }
        }
        const connected = await runPaxConnect(() =>
          connectForPaxReader({
            name: row.name,
            address: row.address,
            merchantId: session.merchantId,
            deviceId: session.deviceId,
            userId: session.userId,
            password: session.password,
            env: "SB",
          }),
        );
        if (!connected.ok) {
          const outcome = presentFinixConnectFailure({ message: connected.message, ...creds });
          await logConnect(outcome);
          failPaxConnect(finixConnectBanner(diagnostic, outcome));
          setBusy(false);
          return;
        }
        await logConnect(PAX_MSG.ready);
        markPaxConnected(
          decision.reader,
          typeof connected.batteryPercent === "number" ? connected.batteryPercent : null,
          finixConnectBanner(diagnostic, PAX_MSG.ready),
        );
        if (decision.claimSlot && station) {
          const nextSerial = decision.reader.serial;
          usePosStore.setState({
            locationDevices: usePosStore.getState().locationDevices.map((device) =>
              device.id === station.id ? { ...device, cardReaderId: nextSerial } : device,
            ),
          });
          const orgId = readStationPair()?.orgId || readTenantPosContext()?.orgId || "";
          if (orgId && locationId) {
            void saveLocationDeviceFn({
              data: {
                orgId,
                locationId,
                device: {
                  id: station.id,
                  label: station.label,
                  type: station.type,
                  serial: station.serial,
                  assignment: station.assignment,
                  receiptPrinterId: station.receiptPrinterId ?? null,
                  stationClass: station.stationClass ?? null,
                  cardReaderId: nextSerial,
                  cardReaderKind: station.cardReaderKind ?? null,
                },
              },
            }).catch(() => undefined);
          }
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message.trim() : "";
        const outcome = detail || "Exception during connection";
        await logConnect(outcome);
        failPaxConnect(diagnostic ? finixConnectBanner(diagnostic, outcome) : outcome);
      }
      setBusy(false);
    })();
  };

  const status = paxLinkStatusText(link);

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground"
      data-station-device-screen
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <h2 className="text-base font-semibold">Devices</h2>
        <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={onClose}>
          Close
        </Button>
      </header>
      <StationDeviceHealthBanner />
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
        <p className="text-sm text-muted-foreground">
          {station?.label ? `${station.label}. ` : ""}
          Scan for a paired PAX D135 and connect it before a check is open.
        </p>
        <p className="text-sm font-medium" data-pax-status data-pax-connected={connectedSerial}>
          {status}
          {link.phase === "connected" && link.battery != null ? ` · Battery ${link.battery}%` : ""}
        </p>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-12"
          disabled={busy || link.phase === "scanning" || link.phase === "connecting" || link.phase === "setting_up"}
          onClick={scan}
        >
          Scan for reader
        </Button>
        {link.rows.map((row) => (
          <button
            key={row.serial}
            type="button"
            data-pax-serial={row.serial}
            className="rounded-lg border border-border px-3 py-3 text-left text-sm"
            onClick={() => pick(row)}
          >
            {row.name}
          </button>
        ))}
      </div>
    </div>
  );
}
