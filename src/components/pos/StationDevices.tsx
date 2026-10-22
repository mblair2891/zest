import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { saveLocationDeviceFn } from "@/lib/access/api";
import { finixConnectAuthFn, getPaymentsStatusFn, listPaxReadersFn, paxReaderSessionFn } from "@/lib/payments/api";
import {
  CARD_READER_USB_NOT_CONNECTED,
  PAX_MSG,
  decideStationReaderConnect,
  finixConnectBanner,
  finixConnectDiagnostic,
  finixMerchantDataGap,
  finixMerchantDataPreview,
  finixSdkTraceFromConnect,
  logFinixConnectDiagnostic,
  paxConnectActivityTrace,
  paxSdkConnectActivityResult,
  normalizePaxSerial,
  readerLink,
  paxAutoConnectPlan,
  paxScanPresentation,
  paxScanRowLabel,
  paxTabletCallback,
  readerForSerial,
  rememberPaxBluetooth,
  rememberedPaxBluetooth,
  runPaxConnect,
  stationDeviceFaceStatus,
  type PaxReader,
  type PaxScanRow,
} from "@/lib/payments/pax-d135";
import { connectForPaxReader, paxReaderOnThisStation, scanForPaxReaders, usbReaderAttached } from "@/lib/payments/pax-d135-native";
import { noteStationActivity, paxReaderSessionData } from "@/lib/payments/station-activity";
import {
  beginPaxConnect,
  beginPaxScan,
  clearPaxScanRows,
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
import { readPairedDeviceId, type LocationDevice } from "@/lib/pos/location-devices";
import { readStationPair } from "@/lib/pos/station-pair";
import { usePosStore } from "@/lib/pos/store";
import {
  assignedStationSystems,
  loginConnectionPrinters,
  stationHealthNotices,
} from "@/lib/pos/station-device-health";
import { startStationConnectionCheck, subscribeStationPrinterProbe, getStationPrinterProbe } from "@/lib/pos/station-connection-check";
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

let connectBusyCount = 0;
const connectBusyListeners = new Set<() => void>();

function setConnectBusy(on: boolean): void {
  connectBusyCount += on ? 1 : -1;
  if (connectBusyCount < 0) connectBusyCount = 0;
  for (const listener of connectBusyListeners) listener();
}

function useConnectBusy(): boolean {
  return useSyncExternalStore(
    (listener) => {
      connectBusyListeners.add(listener);
      return () => connectBusyListeners.delete(listener);
    },
    () => connectBusyCount > 0,
    () => false,
  );
}

let autoQueue: Promise<void> = Promise.resolve();
const autoSeen = new Set<string>();

function assignedReaderNow(): { station: LocationDevice | null; reader: PaxReader } | null {
  const devices = usePosStore.getState().locationDevices;
  const station = devices.find((device) => device.id === stationIdNow()) ?? null;
  const reader = readerForSerial(getPaxStationLink().readers, String(station?.cardReaderId ?? ""));
  if (!reader) return null;
  return { station, reader };
}

/** Launch tries once. Opening Devices tries once more. A USB cable can try once. */
function requestAssignedReaderConnect(reason: "launch" | "devices" | "usb"): void {
  const found = assignedReaderNow();
  if (!found) return;
  const kind = readerLink(found.reader);
  if (kind === "network") return;
  if (reason === "usb" && kind !== "usb") return;
  const key = `${reason}:${found.reader.serial}`;
  if (autoSeen.has(key)) return;
  const link = getPaxStationLink();
  const held = link.phase === "connected" ? normalizePaxSerial(link.reader?.serial ?? "") : "";
  if (held && held === found.reader.serial) return;
  if (link.phase === "scanning" || link.phase === "connecting" || link.phase === "setting_up") return;
  autoSeen.add(key);
  const serial = found.reader.serial;
  autoQueue = autoQueue.then(() => runAssignedReaderConnect(serial)).catch(() => undefined);
}

async function connectPaxRow(input: {
  row: PaxScanRow;
  station: LocationDevice | null;
  assignedSerial: string | null;
}): Promise<boolean> {
  const { row, station } = input;
  setConnectBusy(true);
  let sent: ReturnType<typeof paxConnectActivityTrace> | undefined;
  try {
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
      assignedSerial: input.assignedSerial,
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
      return false;
    }
    beginPaxConnect(decision.reader);
    let diagnostic = "";
    const logConnect = async (
      result: string,
      trace?: {
        applicationId?: string;
        environment?: string;
        usernamePresent?: "yes" | "no";
        passwordPresent?: "yes" | "no";
        merchantId?: string;
        deviceId?: string;
      },
    ) => {
      await noteStationActivity({
        locationId,
        action: "connect",
        diagnostic,
        readerEntity,
        applicationId: trace?.applicationId,
        environment: trace?.environment,
        usernamePresent: trace?.usernamePresent,
        passwordPresent: trace?.passwordPresent,
        merchantId: trace?.merchantId,
        deviceId: trace?.deviceId,
        result,
      });
    };
    const session = await paxReaderSessionFn({
      data: paxReaderSessionData({
        locationId,
        serial: decision.reader.serial,
        entityId: decision.reader.entityId,
      }),
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
      return false;
    }
    const creds = {
      userId: session.userId.trim(),
      password: session.password.trim(),
      merchantId: session.merchantId.trim(),
      deviceId: session.deviceId.trim(),
      env: session.env,
      mid: session.mid.trim(),
    };
    diagnostic = finixConnectDiagnostic(creds);
    sent = paxConnectActivityTrace(creds);
    logFinixConnectDiagnostic(diagnostic);
    await noteStationActivity({
      locationId,
      action: "Finix keys",
      diagnostic,
      readerEntity,
      result: diagnostic,
    });
    const preview = finixMerchantDataPreview(creds);
    logFinixConnectDiagnostic(preview);
    await noteStationActivity({
      locationId,
      action: "connect",
      diagnostic,
      readerEntity,
      environment: sent?.environment,
      usernamePresent: sent?.usernamePresent,
      passwordPresent: sent?.passwordPresent,
      merchantId: sent?.merchantId,
      deviceId: sent?.deviceId,
      result: preview,
    });
    showPaxConnectBanner(preview);
    const gap = finixMerchantDataGap(creds);
    if (gap) {
      await logConnect(gap, sent);
      failPaxConnect(gap);
      return false;
    }
    let raw = "";
    let trace:
      | {
          applicationId?: string;
          environment?: string;
          usernamePresent?: "yes" | "no";
          passwordPresent?: "yes" | "no";
          merchantId?: string;
          deviceId?: string;
        }
      | undefined;
    if (!paxReaderOnThisStation()) {
      try {
        const auth = await finixConnectAuthFn({
          data: paxReaderSessionData({
            locationId,
            serial: decision.reader.serial,
            entityId: decision.reader.entityId,
          }),
        });
        trace = {
          applicationId: auth.applicationId,
          environment: auth.environment,
          usernamePresent: auth.usernamePresent,
          passwordPresent: auth.passwordPresent,
          merchantId: auth.merchantId,
          deviceId: auth.deviceId,
        };
        raw = String(auth.response ?? "").trim();
        if (!auth.ok) {
          const body = String(auth.error ?? "").trim();
          await logConnect(raw || body || "Finix login check failed", trace);
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message.trim() : "";
        await logConnect(detail || "Finix login check failed", trace);
      }
    }
    const connected = await runPaxConnect(() =>
      connectForPaxReader({
        name: row.name,
        address: row.address,
        merchantId: creds.merchantId,
        deviceId: creds.deviceId,
        userId: creds.userId,
        password: creds.password,
        mid: creds.mid,
        env: creds.env,
        link: readerLink(decision.reader),
      }),
    );
    const sdkTrace = finixSdkTraceFromConnect(connected);
    const activity = {
      ...paxConnectActivityTrace({
        ...creds,
        applicationId: trace?.applicationId,
      }),
      ...(sdkTrace?.environment ? { environment: sdkTrace.environment } : {}),
      ...(sdkTrace?.merchantId ? { merchantId: sdkTrace.merchantId } : {}),
      ...(sdkTrace?.deviceId ? { deviceId: sdkTrace.deviceId } : {}),
    };
    const sdk = paxSdkConnectActivityResult(connected);
    logFinixConnectDiagnostic(sdk);
    if (!connected.ok) {
      const shown = paxTabletCallback(connected);
      await logConnect(sdk || shown, activity);
      failPaxConnect(shown);
      return false;
    }
    await logConnect(sdk, activity);
    if (readerLink(decision.reader) === "bluetooth") {
      rememberPaxBluetooth({
        serial: decision.reader.serial,
        address: row.address,
        name: row.name || decision.reader.name,
      });
    }
    markPaxConnected(
      decision.reader,
      typeof connected.batteryPercent === "number" ? connected.batteryPercent : null,
      finixConnectBanner(diagnostic, PAX_MSG.ready),
    );
    clearPaxScanRows();
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
    return true;
  } catch (err) {
    const detail = err instanceof Error ? err.message.trim() : "";
    const outcome = detail || "Exception during connection";
    await noteStationActivity({
      locationId: locationIdNow(),
      action: "connect",
      environment: sent?.environment,
      usernamePresent: sent?.usernamePresent,
      passwordPresent: sent?.passwordPresent,
      merchantId: sent?.merchantId,
      deviceId: sent?.deviceId,
      result: outcome,
    });
    failPaxConnect(outcome);
    return false;
  } finally {
    setConnectBusy(false);
  }
}

async function runAssignedReaderConnect(serial: string): Promise<void> {
  const found = assignedReaderNow();
  if (!found || found.reader.serial !== serial) return;
  const kind = readerLink(found.reader);
  if (kind === "network") return;
  const link = getPaxStationLink();
  let usbAttached: boolean | null = null;
  if (kind === "usb") {
    try {
      usbAttached = await usbReaderAttached();
    } catch {
      usbAttached = false;
    }
  }
  const memory = kind === "bluetooth" ? rememberedPaxBluetooth(serial) : null;
  const plan = paxAutoConnectPlan({
    phase: link.phase,
    connectedSerial: link.phase === "connected" ? link.reader?.serial : "",
    assigned: found.reader,
    rememberedAddress: memory?.address,
    usbAttached,
    inFlight: link.phase === "scanning" || link.phase === "connecting" || link.phase === "setting_up",
  });
  if (plan === "skip") return;
  if (plan === "usb") {
    await connectPaxRow({
      row: {
        name: found.reader.name,
        address: "usb",
        serial: found.reader.serial,
        registered: true,
        entityId: found.reader.entityId,
      },
      station: found.station,
      assignedSerial: serial,
    });
    return;
  }
  if (plan === "direct" && memory) {
    const ok = await connectPaxRow({
      row: {
        name: memory.name || found.reader.name,
        address: memory.address,
        serial: found.reader.serial,
        registered: true,
        entityId: found.reader.entityId,
      },
      station: found.station,
      assignedSerial: serial,
    });
    if (ok) return;
    const after = getPaxStationLink();
    if (after.phase === "scanning" || after.phase === "connecting" || after.phase === "setting_up") return;
  }
  beginPaxScan();
  let presented: ReturnType<typeof paxScanPresentation>;
  try {
    const scanned = await scanForPaxReaders();
    presented = paxScanPresentation(scanned, getPaxStationLink().readers);
  } catch {
    presented = { phase: "idle", message: PAX_MSG.permissions, rows: [] };
  }
  finishPaxScan(presented);
  const row = presented.rows.find((item) => normalizePaxSerial(item.serial) === normalizePaxSerial(serial));
  if (!row) return;
  const again = assignedReaderNow();
  await connectPaxRow({
    row,
    station: again?.station ?? found.station,
    assignedSerial: serial,
  });
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
      const handle = await mod.paxPlugin.addListener("status", (status) => {
        notePaxStatus(status);
        if (status.state !== "processing") return;
        const step = String(status.message ?? "").trim();
        if (!step) return;
        void noteStationActivity({
          locationId: locationIdNow(),
          action: "connect",
          result: step,
        });
      });
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
  const probe = useSyncExternalStore(subscribeStationPrinterProbe, getStationPrinterProbe, getStationPrinterProbe);
  const sectionKey = usePosStore((s) => s.floorSections.map((section) => section.id).join("|"));
  const stationId = useMemo(() => {
    const pair = readStationPair();
    if (isStationPinPath() && pair?.deviceId) return pair.deviceId;
    if (activeDeviceId) return activeDeviceId;
    if (pair?.deviceId) return pair.deviceId;
    const loc = tenantLocationId || pair?.locationId || "";
    return loc ? readPairedDeviceId(loc) || "" : "";
  }, [activeDeviceId, tenantLocationId]);
  const systems = useMemo(() => {
    const readers = assignedStationSystems({
      stationId,
      devices,
      readers: link.readers,
    }).filter((system) => system.kind === "card_reader");
    const printers = loginConnectionPrinters({
      stationId,
      devices,
      sectionIds: sectionKey ? sectionKey.split("|") : [],
    });
    return [...readers, ...printers];
  }, [stationId, devices, link.readers, sectionKey]);
  const printerKey = systems
    .filter((system) => system.kind !== "card_reader")
    .map((system) => `${system.id}:${system.usb ? "usb" : system.host ?? ""}:${system.port}`)
    .join("|");

  useEffect(() => {
    const printers = systems.filter((system) => system.kind !== "card_reader");
    startStationConnectionCheck({
      printers,
      devices,
      locationId: tenantLocationId || readStationPair()?.locationId || "",
    });
    // printerKey is the assigned printer set. systems and devices are this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printerKey, tenantLocationId]);

  const readerKey = link.readers.map((reader) => `${reader.serial}:${reader.link ?? ""}`).join("|");
  const assignedSerial = useMemo(() => {
    const station = devices.find((device) => device.id === stationId);
    return String(station?.cardReaderId ?? "");
  }, [devices, stationId]);
  useEffect(() => {
    if (!readerKey || !assignedSerial) return;
    requestAssignedReaderConnect("launch");
  }, [readerKey, assignedSerial]);

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
  const busy = useConnectBusy();
  const stationId = stationIdNow();
  const station = devices.find((device) => device.id === stationId) ?? null;
  const connectedSerial = link.phase === "connected" ? link.reader?.serial ?? "" : "";
  const assigned = readerForSerial(link.readers, String(station?.cardReaderId ?? ""));
  const usbMode = readerLink(assigned) === "usb";
  const [usbAttached, setUsbAttached] = useState<boolean | null>(null);
  useEffect(() => {
    if (!usbMode) {
      setUsbAttached(null);
      return;
    }
    let cancel = false;
    const tick = () => {
      void usbReaderAttached().then((attached) => {
        if (cancel) return;
        setUsbAttached(attached);
        if (!attached && getPaxStationLink().phase === "connected" && readerLink(getPaxStationLink().reader) === "usb") {
          failPaxConnect(CARD_READER_USB_NOT_CONNECTED);
          return;
        }
        if (attached) requestAssignedReaderConnect("usb");
      });
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [usbMode]);

  const readerKey = link.readers.map((reader) => reader.serial).join("|");
  useEffect(() => {
    if (!assigned?.serial) return;
    requestAssignedReaderConnect("devices");
  }, [assigned?.serial, readerKey]);

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

  const face = stationDeviceFaceStatus({
    phase: link.phase,
    connectedSerial,
    assignedSerial: assigned?.serial ?? "",
    usb: usbMode,
    usbAttached,
  });
  const readerName = assigned?.name?.trim() || "";

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
        <p
          className={`text-lg font-semibold ${face.connected ? "text-emerald-700" : "text-amber-700"}`}
          data-pax-status
          data-pax-connected={connectedSerial}
          data-pax-face={face.connected ? "connected" : "down"}
        >
          {face.label}
        </p>
        {readerName ? (
          <p className="text-sm text-muted-foreground" data-pax-reader-name>
            {readerName}
          </p>
        ) : null}
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
            onClick={() => {
              void connectPaxRow({
                row,
                station,
                assignedSerial: station?.cardReaderId ?? null,
              });
            }}
          >
            {paxScanRowLabel(row, link.readers)}
          </button>
        ))}
      </div>
    </div>
  );
}
