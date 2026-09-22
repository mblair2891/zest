import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  changePairedDeviceRoleFn,
  claimLocationDeviceFn,
  deactivateLocationDeviceFn,
  deleteLocationDeviceFn,
  listLocationDevicesFn,
  publishLocationFn,
  rotateDevicePairFn,
  saveLocationDeviceFn,
  saveLocationSettingsFn,
  unpairLocationDeviceFn,
} from "@/lib/access/api";
import { hashPin, isFourDigitPin } from "@/lib/pos/pin";
import { noteChecklistSave, useChecklistLink } from "@/lib/saas/checklist-link";
import { getSessionContextFn } from "@/lib/saas/api";
import { canDeleteVenueDevice } from "@/lib/saas/tenant-users";
import {
  DEVICE_FUNCTION_LABEL,
  DEVICE_TYPE_LABEL,
  HARDWARE_DEVICE_TYPES,
  DEFAULT_ORDER_DESTINATION,
  PRINTER_UI_TYPES,
  PRINTER_LINK_LABEL,
  PRINTER_LINKS,
  PRINTER_MODEL_GROUPS,
  PRINTER_MODEL_LABEL,
  STATION_DEVICE_FUNCTIONS,
  STATION_DEVICE_TYPES,
  defaultFunctionForType,
  defaultPrinterModel,
  defaultRoutesForPrinterType,
  destinationFromLegacyType,
  familyFromModelPreset,
  isPresetDestination,
  mergeOrderDestinations,
  normalizeDestinationName,
  printerModelHint,
  printerModelSpec,
  functionForPrintStation,
  isOrderPrinterType,
  isPairedActivatedStation,
  isPrinterDevice,
  isPrinterType,
  isReceiptPrinterType,
  isVenueStationOnline,
  printerLanVia,
  printerLanBadgeLabel,
  stationPresenceStatus,
  printerTypeFromStation,
  readOrCreateBrowserDeviceId,
  readPairedDeviceId,
  stationFromPrinterType,
  writePairedDeviceId,
  type DeviceFunction,
  type DeviceRoleChange,
  type LocationDevice,
  type LocationDeviceType,
  type PrinterDrawerKick,
  type PrinterLink,
  type PrinterModelPreset,
} from "@/lib/pos/location-devices";
import { dispatchRawTestPrint, testPrintJob } from "@/lib/print/dispatch";
import {
  isBarOrderPrinter,
  seedDefaultPrinterAssignments,
} from "@/lib/print/printer-assignment";
import {
  enqueueStationPrintFn,
  getStationPrintJobFn,
} from "@/lib/print/api";
import { parseQrPolicy, qrPrintOnTicket } from "@/lib/pos/qr-policy";
import { usePosStore } from "@/lib/pos/store";
import { formatTime } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  formatClaimExpiry,
  normalizeClaimCode,
  pairQrImageSrc,
  readStationPair,
} from "@/lib/pos/station-pair";
import { kickStationToPair } from "@/lib/pos/station-kick";
import {
  DEVICE_ROLE_LABEL,
  PAIRED_ROLE_LABEL,
  confirmPairedRoleChange,
  deviceRoleFromFunction,
  functionForDeviceRole,
  listPairedRoleOptions,
  locationHasDualOds,
  locationHasKioskRole,
  pairedRoleFromFunction,
  typeForDeviceRole,
  type DeviceRole,
  type PairedStationRole,
} from "@/lib/pos/device-roles";

type Mode = "stations" | "hardware";

const HARDWARE_FUNCTIONS: DeviceFunction[] = ["cashier", "expo", "floor_pos"];

function typeOptions(mode: Mode): LocationDeviceType[] {
  if (mode === "hardware") return HARDWARE_DEVICE_TYPES;
  return [...STATION_DEVICE_TYPES, ...PRINTER_UI_TYPES];
}

function functionOptions(mode: Mode): DeviceFunction[] {
  return mode === "hardware" ? HARDWARE_FUNCTIONS : STATION_DEVICE_FUNCTIONS;
}

function inMode(d: LocationDevice, mode: Mode): boolean {
  if (isPrinterDevice(d)) return true;
  const types = typeOptions(mode);
  return types.includes(d.type);
}

function DevicePairCode({
  code,
  expiresAt,
  locId,
  role,
}: {
  code: string;
  expiresAt?: number;
  locId: string;
  role: DeviceRole;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  return (
    <div className="mt-2">
      <p className="font-mono text-3xl font-semibold tracking-[0.28em] text-foreground">
        {code}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        One-time
        {expiresAt ? ` · ${formatClaimExpiry(expiresAt)}` : ""}
        {" · type this on the tablet"}
      </p>
      <button
        type="button"
        className="mt-1 text-[11px] text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setQrOpen((v) => !v)}
      >
        {qrOpen ? "Hide QR" : "Show QR"}
      </button>
      {qrOpen ? (
        <img
          src={pairQrImageSrc(code, undefined, { venue: locId, role })}
          alt={`Pair QR ${code}`}
          width={144}
          height={144}
          className="mt-2 h-36 w-36 rounded-md border border-border bg-white p-1"
        />
      ) : null}
    </div>
  );
}

export function LocationDeviceRegistry({
  orgId,
  locationId,
  locationName,
  mode,
}: {
  orgId: string;
  locationId: string;
  locationName: string;
  mode: Mode;
}) {
  const [devices, setDevices] = useState<LocationDevice[]>([]);
  const [operators, setOperators] = useState<
    Array<{ id: string; name: string; stationType?: string | null }>
  >([]);
  const [roleHistory, setRoleHistory] = useState<DeviceRoleChange[]>([]);
  const [hostName, setHostName] = useState(locationName);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const checklistFocus = useChecklistLink((s) => (s.link?.tab === "devices" ? s.link.focus : null));
  useEffect(() => {
    if (checklistFocus === "receipt-printer") {
      setEditingId(null);
      setLabel("");
      setType("receipt_printer");
      setFormOpen(true);
    } else if (checklistFocus === "order-station") {
      setEditingId(null);
      setLabel("");
      setType("tablet_pos");
      setStationRole("order");
      setFn("floor_pos");
      setFormOpen(true);
    }
  }, [checklistFocus]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<LocationDeviceType>(
    mode === "hardware" ? "receipt_printer" : "tablet_pos",
  );
  const [operatorId, setOperatorId] = useState(HOST_SCOPE);
  const [fn, setFn] = useState<DeviceFunction>(
    mode === "hardware" ? "expo" : "floor_pos",
  );
  const [stationRole, setStationRole] = useState<DeviceRole>("order");
  const [publishMsg, setPublishMsg] = useState<string | null>(null);
  const [printLink, setPrintLink] = useState<PrinterLink>("ethernet");
  const [printIp, setPrintIp] = useState("");
  const [printPort, setPrintPort] = useState("9100");
  const [printModel, setPrintModel] = useState<PrinterModelPreset>(defaultPrinterModel("receipt"));
  const [drawerKick, setDrawerKick] = useState<PrinterDrawerKick>("attached");
  const [destinationName, setDestinationName] = useState(DEFAULT_ORDER_DESTINATION);
  const [orderDestinations, setOrderDestinations] = useState<string[]>(() => mergeOrderDestinations());
  const [addingDest, setAddingDest] = useState(false);
  const [newDest, setNewDest] = useState("");
  const [renamingDest, setRenamingDest] = useState(false);
  const [renameDest, setRenameDest] = useState("");
  const [printPayQr, setPrintPayQr] = useState(true);
  const [boundStationIds, setBoundStationIds] = useState<string[]>([]);
  const [kickStationIds, setKickStationIds] = useState<string[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [serveNoSection, setServeNoSection] = useState(false);
  const [venueDefault, setVenueDefault] = useState(false);
  const floorSections = usePosStore((s) => s.floorSections);
  const [stationClass, setStationClass] = useState<"handheld" | "terminal">("handheld");
  const [cardReaderKind, setCardReaderKind] = useState<"mobile" | "counter">("mobile");
  const [cardReaderId, setCardReaderId] = useState("");
  const [receiptPrinterId, setReceiptPrinterId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<LocationDevice | null>(null);
  const [canDeleteDevice, setCanDeleteDevice] = useState(false);
  const [claimInput, setClaimInput] = useState("");
  const [servicePin, setServicePin] = useState("");
  const [servicePinMsg, setServicePinMsg] = useState<string | null>(null);
  const [resolvedOrgId, setResolvedOrgId] = useState(orgId);
  const [resolvedLocId, setResolvedLocId] = useState(locationId);
  const [resolvedName, setResolvedName] = useState(locationName);
  const [sessionLocs, setSessionLocs] = useState<Array<{ id: string; name: string; orgId: string }>>(
    [],
  );

  useEffect(() => {
    setResolvedOrgId(orgId);
    setResolvedLocId(locationId);
    setResolvedName(locationName);
  }, [orgId, locationId, locationName]);

  useEffect(() => {
    let cancelled = false;
    void getSessionContextFn()
      .then((ctx) => {
        if (cancelled) return;
        const locs = ctx.locations.map((l) => ({ id: l.id, name: l.name, orgId: l.orgId }));
        const picked =
          locs.find((l) => l.id === locationId) ??
          locs.find((l) => l.id === ctx.active?.locationId) ??
          locs[0];
        if (!orgId || !locationId) {
          setSessionLocs(locs);
          if (picked) {
            const org = ctx.orgs.find((o) => o.id === picked.orgId) ?? ctx.orgs[0];
            setResolvedLocId(picked.id);
            setResolvedName(picked.name);
            setResolvedOrgId(org?.id || picked.orgId);
          }
        }
        const loc = ctx.locations.find((l) => l.id === (locationId || picked?.id));
        const org = ctx.orgs.find((o) => o.id === (orgId || loc?.orgId));
        const mem = ctx.memberships.find(
          (m) =>
            m.orgId === (orgId || loc?.orgId) &&
            (!m.locationId || m.locationId === (locationId || loc?.id)),
        );
        setCanDeleteDevice(
          canDeleteVenueDevice({
            isPlatformAdmin: ctx.isPlatformAdmin,
            membershipRole: loc?.role ?? org?.role ?? mem?.role,
            operatorId: loc?.operatorId ?? mem?.operatorId,
          }),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [orgId, locationId]);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!resolvedOrgId || !resolvedLocId) return;
    if (!opts?.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await listLocationDevicesFn({
        data: { orgId: resolvedOrgId, locationId: resolvedLocId },
      });
      const sections = usePosStore.getState().floorSections;
      const seeded = seedDefaultPrinterAssignments(res.devices, sections);
      setDevices(seeded);
      setOperators(res.operators);
      setRoleHistory(res.roleHistory ?? []);
      setHostName(res.hostName || locationName || "Venue");
      setOrderDestinations(
        mergeOrderDestinations(
          res.orderDestinations,
          res.devices.map((d) => d.print?.destinationName ?? ""),
        ),
      );
      try {
        const next = seeded.filter((d) => d.status !== "inactive");
        const prev = usePosStore.getState().locationDevices ?? [];
        const same =
          prev.length === next.length &&
          prev.every(
            (d, i) =>
              d.id === next[i]?.id &&
              d.status === next[i]?.status &&
              d.lastSeenAt === next[i]?.lastSeenAt,
          );
        if (!same) usePosStore.setState({ locationDevices: next });
      } catch {
        /* POS store may not be hydrated on dashboard */
      }
    } catch (e) {
      if (!opts?.silent) setError(e instanceof Error ? e.message : "Could not load devices");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
    // locationName is a fallback label only — do not re-fetch when the house name types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOrgId, resolvedLocId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      void load({ silent: true });
    }, 15_000);
    return () => window.clearInterval(t);
  }, [load]);

  const destinationOptions = useMemo(
    () =>
      mergeOrderDestinations(
        orderDestinations,
        devices.map((d) => d.print?.destinationName ?? ""),
        destinationName ? [destinationName] : [],
      ),
    [orderDestinations, devices, destinationName],
  );

  const persistOrderDestinations = async (next: string[]) => {
    const merged = mergeOrderDestinations(next);
    setOrderDestinations(merged);
    if (!resolvedOrgId || !resolvedLocId) return;
    await saveLocationSettingsFn({
      data: {
        orgId: resolvedOrgId,
        locationId: resolvedLocId,
        setup: { orderDestinations: merged.filter((n) => !isPresetDestination(n)) },
      },
    });
  };

  const addOrderDestination = async () => {
    const name = normalizeDestinationName(newDest);
    if (!name) return;
    await persistOrderDestinations([...orderDestinations, name]);
    setDestinationName(name);
    setNewDest("");
    setAddingDest(false);
  };

  const renameOrderDestination = async () => {
    const from = normalizeDestinationName(destinationName);
    const to = normalizeDestinationName(renameDest);
    if (!from || !to || from.toLowerCase() === to.toLowerCase()) {
      setRenamingDest(false);
      return;
    }
    const extras = orderDestinations
      .filter((n) => !isPresetDestination(n) && n.toLowerCase() !== from.toLowerCase())
      .concat(isPresetDestination(to) ? [] : [to]);
    await persistOrderDestinations(extras);
    setDestinationName(to);
    for (const d of devices) {
      if (!isOrderPrinterType(d.type) || normalizeDestinationName(d.print?.destinationName) !== from) {
        continue;
      }
      await saveLocationDeviceFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          device: {
            id: d.id,
            label: d.label,
            type: d.type,
            assignment: d.assignment,
            print: {
              family: d.print?.family ?? "generic",
              connection: d.print?.connection ?? "lan",
              target: d.print?.target ?? "",
              station: d.print?.station ?? stationFromPrinterType(d.type, to),
              ...d.print,
              destinationName: to,
            },
          },
        },
      });
    }
    setRenamingDest(false);
    await load();
  };

  const visible = useMemo(
    () => devices.filter((d) => inMode(d, mode)),
    [devices, mode],
  );
  const active = visible.filter((d) => d.status !== "inactive");
  const inactive = visible.filter((d) => d.status === "inactive");

  const entityName = (id: string) =>
    id === HOST_SCOPE ? hostName || "Host" : operators.find((o) => o.id === id)?.name ?? id;

  const resetForm = (preset?: Partial<LocationDevice>) => {
    setEditingId(preset?.id ?? null);
    setLabel(preset?.label ?? "");
    const printerType =
      preset?.type && isPrinterType(preset.type)
        ? printerTypeFromStation(preset.type, preset.print?.station)
        : null;
    const orderType = printerType ? isOrderPrinterType(printerType) : false;
    setType(
      printerType ??
        preset?.type ??
        (mode === "hardware" ? "receipt_printer" : "tablet_pos"),
    );
    setOperatorId(preset?.assignment?.operatorId ?? HOST_SCOPE);
    setFn(
      preset?.assignment?.function ??
        (mode === "hardware" ? "expo" : "floor_pos"),
    );
    setStationRole(
      preset?.assignment?.function
        ? deviceRoleFromFunction(preset.assignment.function)
        : "order",
    );
    setPrintLink(preset?.print?.link ?? "ethernet");
    setPrintIp(preset?.print?.ip ?? (preset?.print?.target?.split(":")[0] ?? ""));
    setPrintPort(String(preset?.print?.port ?? 9100));
    setPrintModel(
      preset?.print?.modelPreset ?? defaultPrinterModel(orderType ? "order" : "receipt"),
    );
    setDrawerKick(
      preset?.print?.drawerKick ??
        (printerType && isReceiptPrinterType(printerType) ? "attached" : "none"),
    );
    setDestinationName(
      preset?.print?.destinationName ||
        (printerType
          ? destinationFromLegacyType(preset?.type ?? printerType, preset?.print?.station)
          : DEFAULT_ORDER_DESTINATION),
    );
    setAddingDest(false);
    setNewDest("");
    setRenamingDest(false);
    setRenameDest("");
    setPrintPayQr(preset?.print?.printPayQr !== false);
    setBoundStationIds(preset?.print?.boundStationIds ?? []);
    setKickStationIds(preset?.print?.kickStationIds ?? preset?.print?.boundStationIds ?? []);
    const seeded = seedDefaultPrinterAssignments(
      preset ? [preset as LocationDevice] : [],
      usePosStore.getState().floorSections,
    )[0];
    const print = seeded?.print ?? preset?.print;
    const allSectionIds = usePosStore.getState().floorSections.map((s) => s.id);
    const existingReceipts = devices.filter(
      (d) => isReceiptPrinterType(d.type) && d.status !== "inactive" && d.id !== preset?.id,
    );
    const existingBars = devices.filter((d) => isBarOrderPrinter(d) && d.id !== preset?.id);
    const newReceipt = Boolean(!preset && printerType && isReceiptPrinterType(printerType));
    const newBar = Boolean(
      !preset &&
        printerType &&
        isOrderPrinterType(printerType) &&
        normalizeDestinationName(print?.destinationName).toLowerCase() === "bar",
    );
    setSectionIds(
      print?.sectionIds ??
        (newReceipt && existingReceipts.length === 0
          ? allSectionIds
          : newBar && existingBars.length === 0
            ? allSectionIds
            : []),
    );
    setServeNoSection(
      print?.serveNoSection === true ||
        (newReceipt && existingReceipts.length === 0) ||
        (newBar && existingBars.length === 0),
    );
    setVenueDefault(print?.venueDefault === true || (newReceipt && existingReceipts.length === 0));
    const klass =
      preset?.stationClass === "terminal" || preset?.stationClass === "handheld"
        ? preset.stationClass
        : stationRole === "host"
          ? "terminal"
          : "handheld";
    setStationClass(klass);
    setCardReaderKind(
      preset?.cardReaderKind === "counter" || preset?.cardReaderKind === "mobile"
        ? preset.cardReaderKind
        : klass === "terminal"
          ? "counter"
          : "mobile",
    );
    setCardReaderId(preset?.cardReaderId ?? "");
    setReceiptPrinterId(preset?.receiptPrinterId ?? "");
    setFormOpen(true);
  };

  const save = async (opts?: { id?: string; asBrowser?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const id =
        opts?.id ||
        editingId ||
        (opts?.asBrowser ? readOrCreateBrowserDeviceId(resolvedLocId) : "");
      const name =
        label.trim() ||
        (opts?.asBrowser ? "This browser" : mode === "hardware" ? "Printer" : "Device");
      const printer = isPrinterType(type);
      const stationType = printer
        ? type
        : mode === "stations"
          ? typeForDeviceRole(stationRole)
          : type;
      const stationFn =
        printer
          ? functionForPrintStation(stationFromPrinterType(type, destinationName))
          : mode === "stations"
            ? functionForDeviceRole(stationRole)
            : fn;
      const spec = printerModelSpec(printModel);
      const ip = printIp.trim();
      const port = Number(printPort) || spec.port;
      const target = ip ? `${ip}:${port}` : "";
      const isBarDest =
        isOrderPrinterType(type) &&
        normalizeDestinationName(destinationName).toLowerCase() === "bar";
      await saveLocationDeviceFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          device: {
            id,
            label: name,
            type: printer ? type : stationType,
            assignment: {
              operatorId,
              function: stationFn,
            },
            serial: opts?.asBrowser
              ? readOrCreateBrowserDeviceId(resolvedLocId)
              : target || undefined,
            print: printer
              ? {
                  family: familyFromModelPreset(printModel),
                  connection: "lan",
                  target,
                  station: stationFromPrinterType(type, destinationName),
                  link: printLink,
                  ip,
                  port,
                  modelPreset: printModel,
                  emulation: spec.emulation,
                  paperWidthMm: spec.paperWidthMm,
                  cutter: spec.cutter,
                  drawerKick: isReceiptPrinterType(type) ? drawerKick : "none",
                  destinationName: isOrderPrinterType(type)
                    ? normalizeDestinationName(destinationName) || DEFAULT_ORDER_DESTINATION
                    : undefined,
                  printPayQr: isReceiptPrinterType(type) ? printPayQr : undefined,
                  routes: isReceiptPrinterType(type)
                    ? ["receipts"]
                    : defaultRoutesForPrinterType(type, destinationName),
                  boundStationIds,
                  kickStationIds,
                  sectionIds: isReceiptPrinterType(type) || isBarDest ? sectionIds : undefined,
                  serveNoSection:
                    isReceiptPrinterType(type) || isBarDest ? serveNoSection : undefined,
                  venueDefault: isReceiptPrinterType(type) ? venueDefault : undefined,
                }
              : undefined,
            receiptPrinterId: printer ? null : receiptPrinterId || null,
            stationClass: printer ? null : stationClass,
            cardReaderId: printer ? null : cardReaderId || null,
            cardReaderKind: printer ? null : cardReaderKind,
          },
        },
      });
      if (opts?.asBrowser || id === readOrCreateBrowserDeviceId(resolvedLocId)) {
        writePairedDeviceId(resolvedLocId, id);
        try {
          usePosStore.setState({ activeDeviceId: id });
        } catch {
          /* */
        }
      }
      if (isOrderPrinterType(type)) {
        const dest = normalizeDestinationName(destinationName) || DEFAULT_ORDER_DESTINATION;
        if (!isPresetDestination(dest)) {
          await persistOrderDestinations([...orderDestinations, dest]);
        }
      }
      noteChecklistSave({
        tab: "devices",
        focus: isReceiptPrinterType(type) ? "receipt-printer" : "order-station",
      });
      setFormOpen(false);
      setEditingId(null);
      setLabel("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save device");
    } finally {
      setBusy(false);
    }
  };

  const testPrinter = async (d: LocationDevice) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const job = testPrintJob({
        locationId: resolvedLocId,
        locationName: hostName || locationName,
        station: d.print?.station ?? stationFromPrinterType(d.type),
      });
      const stationOnline = devices.some((x) => isVenueStationOnline(x));
      const result = await dispatchRawTestPrint(job, d, {
        stationOnline,
        enqueueToStation: async (payload) => {
          const q = await enqueueStationPrintFn({
            data: {
              orgId: resolvedOrgId,
              locationId: resolvedLocId,
              printerId: payload.printerId,
              host: payload.host,
              port: payload.port,
              escposBase64: payload.escposBase64,
              kind: "test",
            },
          });
          if (!q.ok || !("jobId" in q) || !q.jobId) {
            return { ok: false, error: !q.ok ? q.error : "Could not queue to station" };
          }
          const deadline = Date.now() + 12_000;
          while (Date.now() < deadline) {
            await new Promise((r) => window.setTimeout(r, 400));
            const st = await getStationPrintJobFn({
              data: { locationId: resolvedLocId, jobId: q.jobId },
            });
            if (st.status === "done") return { ok: st.ok === true, queued: false };
          }
          return { ok: true, queued: true };
        },
      });
      const printed = result.ok && !result.queued;
      const failHard = !result.ok && !stationOnline;
      await saveLocationDeviceFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          device: {
            id: d.id,
            label: d.label,
            type: d.type,
            assignment: d.assignment,
            print: {
              ...d.print,
              family: d.print?.family ?? "epson",
              connection: d.print?.connection ?? "lan",
              target: d.print?.target ?? "",
              station: d.print?.station ?? stationFromPrinterType(d.type),
              lastPrintAt: printed ? Date.now() : d.print?.lastPrintAt,
              reachability: failHard ? "unreachable" : "idle",
            },
          },
        },
      });
      await load();
      if (!result.ok) {
        setError(result.error || "Use a paired station or print agent.");
      } else if (result.queued) {
        const via = devices.find((x) => isVenueStationOnline(x));
        setNotice(`Printed via ${via?.label || "station"}`);
      } else {
        setNotice("Printed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test print failed");
    } finally {
      setBusy(false);
    }
  };

  const kickIfThisStation = (deviceId: string): boolean => {
    const pair = readStationPair();
    if (pair?.deviceId !== deviceId) return false;
    kickStationToPair();
    return true;
  };

  const toggleActive = async (d: LocationDevice) => {
    setBusy(true);
    setError(null);
    try {
      await deactivateLocationDeviceFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          deviceId: d.id,
          active: d.status === "inactive",
        },
      });
      if (kickIfThisStation(d.id)) return;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update device");
    } finally {
      setBusy(false);
    }
  };

  const claimSlot = async () => {
    const code = claimInput.trim();
    if (!code || !resolvedLocId) return;
    setBusy(true);
    setError(null);
    try {
      const browserId = readOrCreateBrowserDeviceId(resolvedLocId);
      const res = await claimLocationDeviceFn({
        data: {
          locationId: resolvedLocId,
          claimCode: code,
          browserDeviceId: browserId,
        },
      });
      writePairedDeviceId(resolvedLocId, res.device.id);
      try {
        usePosStore.setState({ activeDeviceId: res.device.id });
      } catch {
        /* */
      }
      setClaimInput("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not claim slot");
    } finally {
      setBusy(false);
    }
  };

  const publishNow = async () => {
    if (!resolvedOrgId || !resolvedLocId) return;
    setBusy(true);
    setError(null);
    setPublishMsg(null);
    try {
      const res = await publishLocationFn({
        data: { orgId: resolvedOrgId, locationId: resolvedLocId },
      });
      setPublishMsg(
        `Published v${res.publish.version}. Idle PIN pads pick it up; staff keep the last snapshot until Switch user.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setBusy(false);
    }
  };

  const unpair = async (d: LocationDevice) => {
    setBusy(true);
    setError(null);
    try {
      await unpairLocationDeviceFn({
        data: { orgId: resolvedOrgId, locationId: resolvedLocId, deviceId: d.id },
      });
      if (kickIfThisStation(d.id)) return;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not unpair");
    } finally {
      setBusy(false);
    }
  };

  const removeDevice = async (d: LocationDevice) => {
    setBusy(true);
    setError(null);
    try {
      await deleteLocationDeviceFn({
        data: { orgId: resolvedOrgId, locationId: resolvedLocId, deviceId: d.id },
      });
      setConfirmDelete(null);
      if (kickIfThisStation(d.id)) return;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete device");
    } finally {
      setBusy(false);
    }
  };

  const replaceDevice = async (d: LocationDevice) => {
    setBusy(true);
    setError(null);
    try {
      await rotateDevicePairFn({
        data: { orgId: resolvedOrgId, locationId: resolvedLocId, deviceId: d.id },
      });
      if (kickIfThisStation(d.id)) return;
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not replace");
    } finally {
      setBusy(false);
    }
  };

  const dualOds = locationHasDualOds(devices, operators);
  const includeKiosk = locationHasKioskRole(devices) || mode === "stations";
  const pairedRoles = listPairedRoleOptions({ dualOds, includeKiosk });

  const changeRole = async (d: LocationDevice, role: PairedStationRole, applyNow: boolean) => {
    if (pairedRoleFromFunction(d.assignment.function, dualOds) === role && !applyNow) return;
    if (!window.confirm(confirmPairedRoleChange(role))) return;
    setBusy(true);
    setError(null);
    try {
      await changePairedDeviceRoleFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          deviceId: d.id,
          role,
          applyNow,
        },
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change role");
    } finally {
      setBusy(false);
    }
  };

  const saveServicePin = async (clear: boolean) => {
    if (!resolvedOrgId || !resolvedLocId) return;
    if (!clear && !isFourDigitPin(servicePin)) {
      setServicePinMsg("Enter a 4-digit PIN.");
      return;
    }
    setBusy(true);
    setServicePinMsg(null);
    try {
      await saveLocationSettingsFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          setup: {
            stationServicePinHash: clear ? "" : hashPin(servicePin, resolvedLocId),
          },
        },
      });
      try {
        usePosStore.setState({
          settings: {
            ...usePosStore.getState().settings,
            stationServicePinHash: clear ? "" : hashPin(servicePin, resolvedLocId),
          },
        });
      } catch {
        /* optional */
      }
      setServicePin("");
      setServicePinMsg(clear ? "Service PIN cleared." : "Service PIN saved.");
    } catch (e) {
      setServicePinMsg(e instanceof Error ? e.message : "Could not save PIN");
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === "hardware" ? "Hardware" : "Devices";
  const help =
    mode === "hardware"
      ? "Register Quantum readers and hospitality printers (Star, Epson, Citizen, Bixolon, generic ESC/POS). Wi-Fi or Ethernet, static IP (port 9100). Test print sends raw bytes — never the OS dialog."
      : "Add a tablet or a printer from the same button. Tablets: pick Order / Host / ODS / Kiosk, then type the one-time code on the glass. Printers: Receipt printer or Order printer. Order destination is the production line (Kitchen, Bar, Expo, Window, Prep, Other — or add one). Receipt printers have no destination. Host and order tablets use the bound receipt printer; ODS does not need one.";
  const addLabel = mode === "hardware" ? "Add terminal / printer" : "Add device";
  const pairedId = resolvedLocId ? readPairedDeviceId(resolvedLocId) : null;
  const thisBrowserId = resolvedLocId ? readOrCreateBrowserDeviceId(resolvedLocId) : "";

  if (!resolvedLocId) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
        <p className="font-semibold">{heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a location first, then add a tablet or pair this browser.
        </p>
        <Button size="sm" className="mt-4" onClick={() => resetForm()}>
          {addLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{heading}</h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{help}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <GuideLearnLink topicId="printers-kds">
              Learn
            </GuideLearnLink>
            {mode === "stations" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => void publishNow()}>
                Publish changes
              </Button>
            )}
            <Button size="sm" onClick={() => resetForm()}>
              {addLabel}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {resolvedName || locationName} · persist on this location
        </p>
        {publishMsg && <p className="mt-1 text-xs text-primary">{publishMsg}</p>}
      {mode === "stations" && (
        <section
          className="mt-4 rounded-2xl border border-border bg-surface p-4"
          data-demo="station-service-pin"
        >
          <p className="text-sm font-medium">Station service PIN</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Optional 4-digit PIN. Same as manager/owner: long-press reload 2 seconds (website
            deploy, no unpin) or Exit kiosk. Staff PINs cannot exit lock-task.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Input
              className="max-w-[8rem] text-center tracking-[0.3em]"
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••"
              value={servicePin}
              onChange={(e) => setServicePin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <Button size="sm" disabled={busy} onClick={() => void saveServicePin(false)}>
              Save PIN
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => void saveServicePin(true)}
            >
              Clear
            </Button>
          </div>
          {servicePinMsg && <p className="mt-2 text-xs text-muted-foreground">{servicePinMsg}</p>}
        </section>
      )}
        {sessionLocs.length > 1 && (
          <label className="mt-2 block text-xs text-muted-foreground">
            Location
            <select
              className="mt-1 h-10 w-full max-w-sm rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
              value={resolvedLocId}
              onChange={(e) => {
                const next = sessionLocs.find((l) => l.id === e.target.value);
                if (!next) return;
                setResolvedLocId(next.id);
                setResolvedName(next.name);
                setResolvedOrgId(next.orgId);
              }}
            >
              {sessionLocs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {mode === "stations" && (
        <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3">
          <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
            Claim slot
            <Input
              className="mt-1"
              placeholder="Claim code on the slot"
              value={claimInput}
              onChange={(e) => setClaimInput(normalizeClaimCode(e.target.value))}
            />
          </label>
          <Button size="sm" disabled={busy || !claimInput.trim()} onClick={() => void claimSlot()}>
            Claim this browser
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => void save({ asBrowser: true })}
          >
            Pair this browser
          </Button>
        </div>
      )}

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm" role="status">
          {notice}
        </p>
      )}

      {formOpen && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">
            {editingId ? "Edit device" : addLabel}
          </p>
          <Input
            placeholder="Name"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-muted-foreground">
              Type
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                data-checklist-focus={isPrinterType(type) ? "receipt-printer" : "order-station"}
                value={
                  mode === "stations" && !isPrinterType(type)
                    ? typeForDeviceRole(stationRole)
                    : type
                }
                onChange={(e) => {
                  const next = e.target.value as LocationDeviceType;
                  setType(next);
                  setFn(defaultFunctionForType(next));
                  if (isPrinterType(next)) {
                    setDrawerKick(isReceiptPrinterType(next) ? "attached" : "none");
                    setPrintModel(defaultPrinterModel(isOrderPrinterType(next) ? "order" : "receipt"));
                    if (isOrderPrinterType(next)) setDestinationName(DEFAULT_ORDER_DESTINATION);
                  } else {
                    setStationRole(deviceRoleFromFunction(defaultFunctionForType(next)));
                  }
                }}
              >
                {typeOptions(mode)
                  .filter((t) => t !== "printer" && t !== "other")
                  .map((t) => (
                    <option key={t} value={t}>
                      {DEVICE_TYPE_LABEL[t]}
                    </option>
                  ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              {isPrinterType(type) ? "Entity filter" : "Entity"}
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              >
                <option value={HOST_SCOPE}>
                  {isPrinterType(type) ? "All entities at this venue" : hostName || "Host"}
                </option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            {mode === "hardware" && !isPrinterType(type) ? (
              <label className="text-xs text-muted-foreground">
                Function
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                  value={fn}
                  onChange={(e) => setFn(e.target.value as DeviceFunction)}
                >
                  {functionOptions(mode).map((f) => (
                    <option key={f} value={f}>
                      {DEVICE_FUNCTION_LABEL[f]}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {isPrinterType(type) && (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Connection
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                    value={printLink}
                    onChange={(e) => setPrintLink(e.target.value as PrinterLink)}
                  >
                    {PRINTER_LINKS.map((c) => (
                      <option key={c} value={c}>
                        {PRINTER_LINK_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-muted-foreground">
                  Make / model
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                    value={printModel}
                    onChange={(e) => {
                      const next = e.target.value as PrinterModelPreset;
                      setPrintModel(next);
                      setPrintPort(String(printerModelSpec(next).port));
                    }}
                  >
                    {PRINTER_MODEL_GROUPS.map((g) => (
                      <optgroup key={g.id} label={g.label}>
                        {g.models.map((m) => (
                          <option key={m} value={m}>
                            {PRINTER_MODEL_LABEL[m]}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {printerModelHint(printModel)}
                  </span>
                </label>
                <label className="text-xs text-muted-foreground">
                  Static IP
                  <Input
                    className="mt-1"
                    placeholder="192.168.1.50"
                    value={printIp}
                    onChange={(e) => setPrintIp(e.target.value)}
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Port
                  <Input
                    className="mt-1"
                    inputMode="numeric"
                    placeholder="9100"
                    value={printPort}
                    onChange={(e) => setPrintPort(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  />
                </label>
                {isReceiptPrinterType(type) && (
                <label className="text-xs text-muted-foreground">
                  Cash drawer kick
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                    value={drawerKick}
                    onChange={(e) => setDrawerKick(e.target.value as PrinterDrawerKick)}
                  >
                    <option value="none">No</option>
                    <option value="attached">Yes — attached to this printer</option>
                  </select>
                </label>
                )}
                {isOrderPrinterType(type) && (
                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs text-muted-foreground">
                    Destination
                    <select
                      className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                      value={
                        destinationOptions.includes(destinationName)
                          ? destinationName
                          : DEFAULT_ORDER_DESTINATION
                      }
                      onChange={(e) => {
                        setDestinationName(e.target.value);
                        setRenamingDest(false);
                      }}
                    >
                      {destinationOptions.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Production line this printer serves. Entity filter above is Hearth vs Copper on a peer venue — not the line. Kitchen stays in this list when Operating as is House.
                    </span>
                  </label>
                  {addingDest ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
                        New destination
                        <Input
                          className="mt-1"
                          placeholder="e.g. Pastry"
                          value={newDest}
                          onChange={(e) => setNewDest(e.target.value)}
                        />
                      </label>
                      <Button
                        size="sm"
                        type="button"
                        disabled={!normalizeDestinationName(newDest)}
                        onClick={() => void addOrderDestination()}
                      >
                        Add
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setAddingDest(false);
                          setNewDest("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : renamingDest ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
                        Rename destination
                        <Input
                          className="mt-1"
                          value={renameDest}
                          onChange={(e) => setRenameDest(e.target.value)}
                        />
                      </label>
                      <Button
                        size="sm"
                        type="button"
                        disabled={!normalizeDestinationName(renameDest)}
                        onClick={() => void renameOrderDestination()}
                      >
                        Save name
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => setRenamingDest(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setAddingDest(true);
                          setNewDest("");
                        }}
                      >
                        Add destination
                      </Button>
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setRenamingDest(true);
                          setRenameDest(destinationName);
                        }}
                      >
                        Rename
                      </Button>
                    </div>
                  )}
                </div>
                )}
              </div>
              {isReceiptPrinterType(type) && (
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    checked={printPayQr}
                    onChange={(e) => setPrintPayQr(e.target.checked)}
                  />
                  <span>
                    Print pay QR
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {qrPrintOnTicket(
                        parseQrPolicy(
                          usePosStore.getState().settings.qrPolicy,
                          usePosStore.getState().settings.qrMode,
                        ),
                      )
                        ? "Venue QR is on. Uncheck to skip the pay code on this printer."
                        : "Venue QR print-on-check is off. Turn it on in Floor / QR to print a pay code."}
                    </span>
                  </span>
                </label>
              )}
              {(isReceiptPrinterType(type) ||
                (isOrderPrinterType(type) &&
                  normalizeDestinationName(destinationName).toLowerCase() === "bar")) && (
                <fieldset className="space-y-1">
                  <legend className="text-xs text-muted-foreground">Floor sections</legend>
                  <p className="text-[11px] text-muted-foreground">
                    {isReceiptPrinterType(type)
                      ? "Print check and paid receipt for a table go to the receipt printer for that table’s section. Order / host tablets fire; they do not own routing."
                      : "Drinks fire to the bar printer for that table’s section (or the well the tab belongs to). If this is the only bar printer, every section maps to it."}
                  </p>
                  <div className="flex flex-col gap-1">
                    {floorSections.map((sec) => (
                      <label key={sec.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={sectionIds.includes(sec.id)}
                          onChange={(e) =>
                            setSectionIds((prev) =>
                              e.target.checked
                                ? [...prev, sec.id]
                                : prev.filter((x) => x !== sec.id),
                            )
                          }
                        />
                        {sec.name}
                      </label>
                    ))}
                    {floorSections.length === 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Add rooms on Floor first, then assign this printer.
                      </p>
                    )}
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={serveNoSection}
                        onChange={(e) => setServeNoSection(e.target.checked)}
                      />
                      Bar tabs / no section
                    </label>
                    {isReceiptPrinterType(type) && (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={venueDefault}
                          onChange={(e) => setVenueDefault(e.target.checked)}
                        />
                        Venue default (to-go / will-call)
                      </label>
                    )}
                  </div>
                </fieldset>
              )}
              {isOrderPrinterType(type) &&
                normalizeDestinationName(destinationName).toLowerCase() !== "bar" && (
                  <p className="text-[11px] text-muted-foreground">
                    Food order printers are assigned on Menu groups (destination + printer). Same
                    destination + same printer on one Send is one slip. Table section does not route
                    food.
                  </p>
                )}
              {isReceiptPrinterType(type) && (
              <fieldset className="space-y-1">
                <legend className="text-xs text-muted-foreground">
                  Fallback stations if the section has none
                </legend>
                <p className="text-[11px] text-muted-foreground">
                  Existing “bound to this tablet” rows stay as fallback. Empty = section map only.
                </p>
                <div className="flex flex-col gap-1">
                  {devices
                    .filter((d) => !isPrinterDevice(d) && d.status !== "inactive")
                    .map((d) => {
                      const role = deviceRoleFromFunction(d.assignment.function);
                      if (role === "ods" || role === "kiosk") {
                        return null;
                      }
                      return (
                        <label key={d.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={boundStationIds.includes(d.id)}
                            onChange={(e) =>
                              setBoundStationIds((prev) =>
                                e.target.checked
                                  ? [...prev, d.id]
                                  : prev.filter((x) => x !== d.id),
                              )
                            }
                          />
                          {d.label} · {DEVICE_ROLE_LABEL[role]}
                        </label>
                      );
                    })}
                </div>
              </fieldset>
              )}
              {isReceiptPrinterType(type) && (
                <fieldset className="space-y-1">
                  <legend className="text-xs text-muted-foreground">
                    Stations that may kick drawer
                  </legend>
                  <p className="text-[11px] text-muted-foreground">
                    Terminals only — cash, No sale, drawer kick. Leave handhelds unchecked.
                  </p>
                  <div className="flex flex-col gap-1">
                    {devices
                      .filter((d) => !isPrinterDevice(d) && d.status !== "inactive")
                      .map((d) => {
                        const role = deviceRoleFromFunction(d.assignment.function);
                        if (role === "ods" || role === "kiosk") return null;
                        return (
                          <label key={`kick-${d.id}`} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border"
                              checked={kickStationIds.includes(d.id)}
                              onChange={(e) =>
                                setKickStationIds((prev) =>
                                  e.target.checked
                                    ? [...prev, d.id]
                                    : prev.filter((x) => x !== d.id),
                                )
                              }
                            />
                            {d.label} · {DEVICE_ROLE_LABEL[role]}
                          </label>
                        );
                      })}
                  </div>
                </fieldset>
              )}
            </div>
          )}
          {!isPrinterType(type) && mode === "stations" && stationRole !== "ods" && stationRole !== "kiosk" && (
            <div className="space-y-3">
            <label className="block text-xs text-muted-foreground">
              Station class
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                value={stationClass}
                onChange={(e) => {
                  const next = e.target.value === "terminal" ? "terminal" : "handheld";
                  setStationClass(next);
                  setCardReaderKind(next === "terminal" ? "counter" : "mobile");
                }}
              >
                <option value="handheld">Handheld (card, no drawer)</option>
                <option value="terminal">Terminal (cash + drawer)</option>
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Card reader
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                value={cardReaderKind}
                onChange={(e) =>
                  setCardReaderKind(e.target.value === "counter" ? "counter" : "mobile")
                }
              >
                <option value="mobile">Mobile reader (handheld)</option>
                <option value="counter">Counter reader (terminal)</option>
              </select>
            </label>
            <label className="block text-xs text-muted-foreground">
              Reader id
              <input
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
                value={cardReaderId}
                onChange={(e) => setCardReaderId(e.target.value)}
                placeholder="Finix / Quantum reader"
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Fallback receipt printer
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                value={receiptPrinterId}
                onChange={(e) => setReceiptPrinterId(e.target.value)}
              >
                <option value="">None — use the table’s section printer</option>
                {devices
                  .filter(
                    (d) =>
                      isPrinterDevice(d) &&
                      d.status !== "inactive" &&
                      (d.print?.routes?.includes("receipts") ||
                        d.print?.station === "receipt" ||
                        d.type === "receipt_printer"),
                  )
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
              </select>
              <span className="mt-0.5 block text-[11px] text-muted-foreground">
                Used only when the table’s section has no receipt printer. Routing is by section, not
                by this tablet.
              </span>
            </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save
            </Button>
            {mode === "stations" && !editingId && !isPrinterType(type) && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void save({ asBrowser: true })}
              >
                Pair this browser
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setFormOpen(false);
                setEditingId(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading devices…</p>
      ) : active.length === 0 && !formOpen ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
          <p className="font-semibold">
            {mode === "hardware" ? "No terminals or printers yet" : "No devices registered"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "hardware"
              ? "Add a card terminal, receipt printer, or order printer so the house can find it."
              : "Add a named slot for a Samsung tablet or wall display, or pair this browser now."}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button size="sm" onClick={() => resetForm()}>
              {addLabel}
            </Button>
            {mode === "stations" && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void save({ asBrowser: true })}
              >
                Pair this browser
              </Button>
            )}
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {active.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="min-w-0">
                <p className="font-medium">
                  {d.label}
                  {(pairedId === d.id || d.id === thisBrowserId || d.serial === thisBrowserId) && (
                    <span className="ml-2 text-[11px] font-normal text-primary">This browser</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPrinterDevice(d) && d.print
                    ? `${DEVICE_TYPE_LABEL[printerTypeFromStation(d.type, d.print.station)]}${
                        d.print.destinationName ? ` · ${d.print.destinationName}` : ""
                      }${
                        isReceiptPrinterType(d.type) || isBarOrderPrinter(d)
                          ? d.print.sectionIds?.length
                            ? ` · ${d.print.sectionIds
                                .map((id) => floorSections.find((s) => s.id === id)?.name ?? id)
                                .join(", ")}`
                            : " · no sections"
                          : ""
                      }${d.print.venueDefault ? " · venue default" : ""}${
                        d.print.serveNoSection ? " · bar tabs" : ""
                      } · ${entityName(d.assignment.operatorId)} · ${d.print.modelPreset ? PRINTER_MODEL_LABEL[d.print.modelPreset] : ""} · ${d.print.link ? PRINTER_LINK_LABEL[d.print.link] : ""} ${d.print.ip || d.print.target || "(pending IP)"}`
                    : `${DEVICE_TYPE_LABEL[d.type]} · ${entityName(d.assignment.operatorId)} · ${DEVICE_FUNCTION_LABEL[d.assignment.function]} · ${DEVICE_ROLE_LABEL[deviceRoleFromFunction(d.assignment.function)]}`}
                </p>
                {mode === "stations" && !isPrinterDevice(d) && d.claimCode && d.status !== "online" ? (
                  <DevicePairCode
                    code={d.claimCode}
                    expiresAt={d.claimExpiresAt}
                    locId={resolvedLocId}
                    role={deviceRoleFromFunction(d.assignment.function)}
                  />
                ) : mode === "stations" && !isPrinterDevice(d) && d.status === "online" ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">Paired · PIN only</p>
                ) : isPrinterDevice(d) && d.print?.lastPrintAt ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Last print · {formatTime(d.print.lastPrintAt)}
                  </p>
                ) : null}
                {mode === "stations" &&
                  isPairedActivatedStation(d) &&
                  (() => {
                    const last = roleHistory.filter((h) => h.deviceId === d.id).at(-1);
                    if (!last) return null;
                    return (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {last.from} → {last.to} · {last.actorName} · {formatTime(last.at)}
                      </p>
                    );
                  })()}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {mode === "stations" && isPairedActivatedStation(d) && (
                  <>
                    <label className="text-[11px] text-muted-foreground">
                      Role
                      <select
                        className="ml-1 h-8 rounded-lg border border-border bg-bg px-2 text-xs text-foreground"
                        disabled={busy}
                        value={pairedRoleFromFunction(d.assignment.function, dualOds)}
                        onChange={(e) =>
                          void changeRole(d, e.target.value as PairedStationRole, false)
                        }
                      >
                        {pairedRoles.map((r) => (
                          <option key={r} value={r}>
                            {PAIRED_ROLE_LABEL[r]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      disabled={busy}
                      title="Idle PIN pad only. Never mid-check."
                      onClick={() =>
                        void changeRole(
                          d,
                          pairedRoleFromFunction(d.assignment.function, dualOds),
                          true,
                        )
                      }
                    >
                      Apply now
                    </Button>
                  </>
                )}
                <DevicePresenceBits d={d} devices={devices} />
                {isPrinterDevice(d) && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void testPrinter(d)}
                  >
                    Test print
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => resetForm(d)}>
                  Edit
                </Button>
                {mode === "stations" && !isPrinterDevice(d) && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void replaceDevice(d)}
                    >
                      {d.status === "online" ? "Replace" : "Regenerate"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void unpair(d)}
                    >
                      Unpair
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void toggleActive(d)}
                >
                  Deactivate
                </Button>
                {canDeleteDevice && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    disabled={busy}
                    data-demo="delete-device"
                    onClick={() => setConfirmDelete(d)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {inactive.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Deactivated
          </p>
          <ul className="space-y-2">
            {inactive.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-muted-foreground"
              >
                <p className="text-sm">
                  {d.label} · {DEVICE_TYPE_LABEL[d.type]}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void toggleActive(d)}
                  >
                    Reactivate
                  </Button>
                  {canDeleteDevice && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      disabled={busy}
                      data-demo="delete-device"
                      onClick={() => setConfirmDelete(d)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm" showClose={false}>
          <DialogHeader>
            <DialogTitle>Delete this device?</DialogTitle>
            <DialogDescription>
              Delete this device. The tablet must scan a new code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy || !confirmDelete}
              onClick={() => confirmDelete && void removeDevice(confirmDelete)}
            >
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DevicePresenceBits({
  d,
  devices,
}: {
  d: LocationDevice;
  devices: LocationDevice[];
}) {
  const lan = isPrinterDevice(d) ? printerLanVia(d, devices) : null;
  const presence = lan ? null : stationPresenceStatus(d);
  const live = lan ? lan.badge === "lan_via_station" : presence === "online";
  const pending = lan ? false : presence === "pending";
  const label = lan
    ? printerLanBadgeLabel(lan.badge, lan.via?.label)
    : presence;
  const seen = lan ? lan.via?.lastSeenAt : d.lastSeenAt;
  return (
    <>
      <Badge variant={live ? "success" : pending ? "warn" : "secondary"}>{label}</Badge>
      <span className="text-[11px] text-muted-foreground">
        {seen ? formatTime(seen) : "—"}
      </span>
    </>
  );
}
