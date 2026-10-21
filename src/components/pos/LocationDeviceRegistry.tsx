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
import { recordEloMsrSwipeFn } from "@/lib/pos/elo-msr.api";
import {
  MSR_ROLE_LABEL,
  MSR_ROLES,
  isMsrStationType,
  type MsrGiftAction,
  type MsrRole,
} from "@/lib/pos/elo-msr";
import { hashPin, isFourDigitPin } from "@/lib/pos/pin";
import { flushLocationCatalog, persistLocationCatalog } from "@/lib/pos/persist-location-setup";
import { publishOwnerBlock } from "@/lib/pos/room-owner";
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
  orderPrinterVisibleToStation,
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
import { nativeUsbPrinterConnected } from "@/lib/print/capacitor-raw-print";
import {
  printerEthernetOnly,
  printerIsUsb,
  printerLinkChoices,
  usbStatusLabel,
} from "@/lib/print/printer-transport";
import { isNativeApp } from "@/lib/native-shell";
import {
  isBarOrderPrinter,
  seedDefaultPrinterAssignments,
} from "@/lib/print/printer-assignment";
import {
  enqueueStationPrintFn,
  getStationPrintJobFn,
  readPrinterScanFn,
  requestPrinterScanFn,
} from "@/lib/print/api";
import { discoverPrinters } from "@/lib/print/discover-printers";
import type { DiscoveredPrinter } from "@/lib/print/printer-discover";
import { destinationForGroup } from "@/lib/pos/order-destinations";
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
import { SquareTerminalPanel } from "@/components/pos/SquareTerminalPanel";
import {
  listPaxReadersFn,
  reassignPaxReaderFn,
  reenrollPaxReaderForLiveFn,
  registerPaxReaderFn,
  removePaxReaderFn,
  renamePaxReaderFn,
  replacePaxReaderFn,
  setPaxDeviceIdFn,
  setPaxReaderLinkFn,
  listStationActivityFn,
} from "@/lib/payments/api";
import {
  PAX_READER_LINKS,
  normalizePaxLink,
  readerAssignOptions,
  readerAssignmentBlock,
  readerLink,
  type PaxReader,
  type PaxReaderLink,
} from "@/lib/payments/pax-d135";
import {
  formatStationActivityLine,
  type StationActivityEntry,
} from "@/lib/payments/station-activity-log";
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
  return [...STATION_DEVICE_TYPES, ...PRINTER_UI_TYPES, "elo_msr"];
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
  const [cardReaders, setCardReaders] = useState<PaxReader[]>([]);
  const [activity, setActivity] = useState<StationActivityEntry[]>([]);
  const [paxName, setPaxName] = useState("");
  const [paxSerial, setPaxSerial] = useState("");
  const [paxLink, setPaxLink] = useState<PaxReaderLink>("bluetooth");
  const [paxDeviceId, setPaxDeviceId] = useState("");
  const [paxEntityId, setPaxEntityId] = useState("");
  const [paxMsg, setPaxMsg] = useState<string | null>(null);
  const [renamingReaderId, setRenamingReaderId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [openReaderId, setOpenReaderId] = useState<string | null>(null);
  const [deviceDraft, setDeviceDraft] = useState("");
  const [replacingReaderId, setReplacingReaderId] = useState<string | null>(null);
  const [replaceSerial, setReplaceSerial] = useState("");
  const [replaceDeviceId, setReplaceDeviceId] = useState("");
  const [reassignReaderId, setReassignReaderId] = useState<string | null>(null);
  const [reassignEntityId, setReassignEntityId] = useState("");
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
  const [usbLive, setUsbLive] = useState<boolean | null>(null);
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
  const [foodGroupIds, setFoodGroupIds] = useState<string[]>([]);
  const [scanBusy, setScanBusy] = useState(false);
  const [foundPrinters, setFoundPrinters] = useState<DiscoveredPrinter[]>([]);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const floorSections = usePosStore((s) => s.floorSections);
  const categories = usePosStore((s) => s.categories);
  const updateCategory = usePosStore((s) => s.updateCategory);
  const [stationClass, setStationClass] = useState<"handheld" | "terminal">("handheld");
  const [cardReaderKind, setCardReaderKind] = useState<"mobile" | "counter">("mobile");
  const [cardReaderId, setCardReaderId] = useState("");
  const [receiptPrinterId, setReceiptPrinterId] = useState<string>("");
  const [orderPrinterIds, setOrderPrinterIds] = useState<string[]>([]);
  const [msrRole, setMsrRole] = useState<MsrRole>("gift");
  const [msrStationId, setMsrStationId] = useState("");
  const [msrTestAction, setMsrTestAction] = useState<MsrGiftAction>("balance");
  const [msrNote, setMsrNote] = useState<string | null>(null);
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
    if (!printerIsUsb(printLink, printModel) || !isNativeApp()) {
      setUsbLive(null);
      return;
    }
    let cancel = false;
    const tick = () => {
      void nativeUsbPrinterConnected().then((attached) => {
        if (!cancel && attached != null) setUsbLive(attached);
      });
    };
    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      cancel = true;
      window.clearInterval(id);
    };
  }, [printLink, printModel]);

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
      if (mode === "stations") {
        try {
          const listed = await listPaxReadersFn({ data: { locationId: resolvedLocId } });
          setCardReaders(listed.readers ?? []);
          try {
            const logged = await listStationActivityFn({ data: { locationId: resolvedLocId } });
            setActivity(logged.entries ?? []);
          } catch {
            /* readers still list when the activity log cannot load */
          }
          try {
            usePosStore.getState().updateSettings({ paxReaders: listed.readers ?? [] });
          } catch {
            /* station publish still carries the list */
          }
        } catch {
          /* device list still stands if readers cannot load */
        }
      }
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
              d.lastSeenAt === next[i]?.lastSeenAt &&
              d.squareDeviceId === next[i]?.squareDeviceId &&
              d.squarePairStatus === next[i]?.squarePairStatus &&
              (d.cardReaderId ?? null) === (next[i]?.cardReaderId ?? null) &&
              (d.receiptPrinterId ?? null) === (next[i]?.receiptPrinterId ?? null),
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
  }, [resolvedOrgId, resolvedLocId, mode]);

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
    const legacyOrderPrinterIds = preset?.id
      ? devices
          .filter(
            (d) =>
              isOrderPrinterType(d.type) &&
              (d.print?.boundStationIds ?? []).includes(preset.id as string),
          )
          .map((d) => d.id)
      : [];
    setOrderPrinterIds(
      Array.isArray(preset?.orderPrinterIds) ? preset.orderPrinterIds : legacyOrderPrinterIds,
    );
    setMsrRole(preset?.msr?.role ?? "gift");
    setMsrStationId(preset?.msr?.stationId ?? "");
    const cats = usePosStore.getState().categories;
    setFoodGroupIds(
      preset?.id ? cats.filter((c) => c.printerId === preset.id).map((c) => c.id) : [],
    );
    setFormOpen(true);
  };

  const openScannedPrinter = (found: DiscoveredPrinter) => {
    const ip = found.ip;
    const existing = devices.find(
      (d) =>
        isPrinterDevice(d) &&
        (d.print?.ip === ip || (d.print?.target ?? "").startsWith(`${ip}:`)),
    );
    if (existing) {
      resetForm(existing);
      return;
    }
    resetForm();
    setEditingId(null);
    setLabel(found.name);
    setType("receipt_printer");
    setPrintLink("wifi");
    setPrintIp(ip);
    setPrintPort(String(found.port > 0 ? found.port : 9100));
    setPrintModel(defaultPrinterModel("receipt"));
    setDrawerKick("attached");
    setFormOpen(true);
  };

  const scanForPrinters = async () => {
    setScanBusy(true);
    setScanNote(null);
    setError(null);
    setFoundPrinters([]);
    try {
      const found = await discoverPrinters();
      if (found.printers.length) {
        setFoundPrinters(found.printers);
        setScanNote(
          found.printers.length === 1
            ? "1 printer on this Wi-Fi. Name it and save."
            : `${found.printers.length} printers on this Wi-Fi. Name one and save.`,
        );
        return;
      }
      const stationOnline = devices.some((d) => isVenueStationOnline(d));
      if (found.source !== "station" && stationOnline && resolvedLocId) {
        setScanNote("Scanning from a station on this Wi-Fi…");
        const req = await requestPrinterScanFn({ data: { locationId: resolvedLocId } });
        const id = req.ticket?.id;
        if (id) {
          const deadline = Date.now() + 18_000;
          while (Date.now() < deadline) {
            await new Promise((r) => window.setTimeout(r, 700));
            const st = await readPrinterScanFn({ data: { locationId: resolvedLocId } });
            const ticket = st.ticket;
            if (!ticket || ticket.id !== id || ticket.status === "pending") continue;
            if (ticket.printers.length) {
              setFoundPrinters(ticket.printers);
              setScanNote(
                ticket.printers.length === 1
                  ? "1 printer on this Wi-Fi. Name it and save."
                  : `${ticket.printers.length} printers on this Wi-Fi. Name one and save.`,
              );
              return;
            }
            setScanNote(ticket.error || "No printers found on this Wi-Fi.");
            return;
          }
        }
      }
      setScanNote(found.error || "No printers found on this Wi-Fi.");
    } catch (e) {
      setScanNote(e instanceof Error ? e.message : "Printer scan failed.");
    } finally {
      setScanBusy(false);
    }
  };

  const save = async (opts?: { id?: string; asBrowser?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const printerGate = isPrinterType(type);
      const id =
        opts?.id ||
        editingId ||
        (opts?.asBrowser
          ? readOrCreateBrowserDeviceId(resolvedLocId)
          : printerGate
            ? `dev_${Math.random().toString(36).slice(2, 10)}`
            : "");
      if (!printerGate && cardReaderId) {
        const blocked = readerAssignmentBlock({
          readers: cardReaders,
          devices,
          tabletId: id,
          serial: cardReaderId,
        });
        if (blocked) {
          setError(blocked);
          return;
        }
      }
      const name =
        label.trim() ||
        (opts?.asBrowser ? "This browser" : mode === "hardware" ? "Printer" : "Device");
      const printer = isPrinterType(type);
      const stationType = printer
        ? type
        : type === "elo_msr"
          ? "elo_msr"
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
      const link = printerEthernetOnly(printModel) ? "ethernet" : printLink;
      const usb = link === "usb";
      const ip = usb ? "" : printIp.trim();
      const port = usb ? spec.port : Number(printPort) || spec.port;
      const target = usb ? "" : ip ? `${ip}:${port}` : "";
      const savedUsb = devices.find((d) => d.id === id)?.print?.usbAttached;
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
                  link,
                  usbAttached: usb ? savedUsb : undefined,
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
            orderPrinterIds: printer
              ? null
              : orderPrinterIds.filter((pid) => {
                  const row = devices.find((d) => d.id === pid);
                  return (
                    !!row &&
                    isOrderPrinterType(row.type) &&
                    orderPrinterVisibleToStation(row.assignment.operatorId, operatorId)
                  );
                }),
            stationClass: printer || stationType === "elo_msr" ? null : stationClass,
            cardReaderId: printer || stationType === "elo_msr" ? null : cardReaderId || null,
            cardReaderKind: printer || stationType === "elo_msr" ? null : cardReaderKind,
            msr:
              stationType === "elo_msr"
                ? { mount: "side" as const, role: msrRole, stationId: msrStationId || null }
                : undefined,
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
        const barDest = dest.toLowerCase() === "bar";
        if (!barDest) {
          let menuChanged = false;
          for (const cat of usePosStore.getState().categories) {
            const want = foodGroupIds.includes(cat.id);
            const has = cat.printerId === id;
            if (want && !has) {
              updateCategory(cat.id, { printerId: id, destinationName: dest });
              menuChanged = true;
            } else if (!want && has) {
              updateCategory(cat.id, { printerId: "" });
              menuChanged = true;
            }
          }
          if (menuChanged) persistLocationCatalog("menu");
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

  const testMsr = async (d: LocationDevice) => {
    setBusy(true);
    setError(null);
    setMsrNote(null);
    try {
      const res = await recordEloMsrSwipeFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          deviceId: d.id,
          giftAction: d.msr?.role === "gift" ? msrTestAction : undefined,
        },
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMsrNote(`Swipe received on ${res.stationLabel}. ${res.event.summary}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test swipe failed");
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
              transport: payload.transport,
              stationIds: payload.stationIds,
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
      const usbQueued = result.target === "usb" && result.queued;
      if (!usbQueued) await saveLocationDeviceFn({
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
              usbAttached:
                result.target === "usb" && printed ? true : d.print?.usbAttached,
            },
          },
        },
      });
      await load();
      if (!result.ok) {
        setError(result.error || "Use a paired station or print agent.");
      } else if (usbQueued) {
        setNotice("USB printer not connected. The job waits until it is plugged in.");
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
    const ownerBlock = publishOwnerBlock(usePosStore.getState().floorSections);
    if (ownerBlock) {
      setError(ownerBlock);
      setBusy(false);
      return;
    }
    try {
      await flushLocationCatalog("floor");
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
      ? "Register Quantum readers and hospitality printers (Star, Epson, Citizen, Bixolon, generic ESC/POS). Ethernet uses a static IP (port 9100). USB uses the station’s USB port. Test print sends raw bytes — never the OS dialog."
      : "Add a tablet, a printer, or an Elo side-mounted MSR from the same button. Tablets: pick Order / Host / ODS / Kiosk, then type the one-time code on the glass. Printers: Receipt printer or Order printer. The Elo reader links to a tablet already on this list. Gift swipes use the house gift ledger.";
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
            <Button
              size="sm"
              variant="outline"
              disabled={busy || scanBusy}
              data-scan-printers
              onClick={() => void scanForPrinters()}
            >
              {scanBusy ? "Scanning…" : "Scan for printers"}
            </Button>
            <Button size="sm" onClick={() => resetForm()}>
              {addLabel}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {resolvedName || locationName} · persist on this location
        </p>
        {publishMsg && <p className="mt-1 text-xs text-primary">{publishMsg}</p>}
        {scanNote && (
          <p className="mt-2 text-sm" data-printer-scan-status role="status">
            {scanNote}
          </p>
        )}
        {foundPrinters.length > 0 && (
          <ul className="mt-2 space-y-1" data-printer-scan-results>
            {foundPrinters.map((p) => {
              const saved = devices.some(
                (d) =>
                  isPrinterDevice(d) &&
                  (d.print?.ip === p.ip || (d.print?.target ?? "").startsWith(`${p.ip}:`)),
              );
              return (
                <li key={p.ip}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-left text-sm"
                    data-printer-scan-ip={p.ip}
                    onClick={() => openScannedPrinter(p)}
                  >
                    <span>
                      <span className="font-medium">{p.name || "Printer"}</span>
                      <span className="ml-2 text-muted-foreground">{p.ip}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {saved ? "Already saved" : "Name and save"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          <SquareTerminalPanel
            locationId={resolvedLocId}
            devices={devices}
            onPaired={() => void load({ silent: true })}
          />
        </div>
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
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4" data-station-activity-log="">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Station activity</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Card-reader connects, entity matches, and Finix key status for this location.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              data-station-activity-download=""
              disabled={!resolvedLocId}
              onClick={() => {
                void (async () => {
                  if (!resolvedLocId) return;
                  try {
                    const logged = await listStationActivityFn({
                      data: { locationId: resolvedLocId, full: true },
                    });
                    const blob = new Blob([logged.text], { type: "text/plain;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "station-activity.txt";
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "The log was not downloaded.");
                  }
                })();
              }}
            >
              Download log
            </Button>
          </div>
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">No station activity yet.</p>
          ) : (
            <ul className="max-h-56 space-y-2 overflow-y-auto text-xs">
              {activity.map((entry) => (
                <li key={entry.id} data-station-activity-entry="" className="break-words font-mono">
                  {formatStationActivityLine(entry)}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {mode === "stations" && (
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4" data-pax-readers="">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Card readers</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add a PAX D135 for a selling entity at this location. Reassign moves it to another entity here and keeps the tablet. After this location switches from sandbox to live, choose Re-enroll for live. Cash still works with no reader.
              </p>
            </div>
            <GuideLearnLink topicId="pax-card-reader">Learn</GuideLearnLink>
          </div>
          {cardReaders.length === 0 ? (
            <p className="text-xs text-muted-foreground">No card reader on this location yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {cardReaders.map((reader) => (
                <li key={reader.id} data-pax-registered={reader.serial} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                  {renamingReaderId === reader.id ? (
                    <>
                      <Input
                        className="h-8 max-w-[12rem]"
                        data-pax-rename-input=""
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !renameDraft.trim()}
                        onClick={() => {
                          void (async () => {
                            if (!resolvedLocId) return;
                            setBusy(true);
                            setPaxMsg(null);
                            try {
                              const res = await renamePaxReaderFn({
                                data: { locationId: resolvedLocId, id: reader.id, name: renameDraft },
                              });
                              if (!res.ok) {
                                setPaxMsg(res.error);
                                return;
                              }
                              setRenamingReaderId(null);
                              setPaxMsg(`${res.reader.name} still uses serial ${res.reader.serial}.`);
                              await load({ silent: true });
                            } catch (e) {
                              setPaxMsg(e instanceof Error ? e.message : "The name was not saved.");
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Save name
                      </Button>
                    </>
                  ) : (
                    <>
                      <span data-pax-reader-name="">{reader.name}</span>
                      <span className="text-muted-foreground" data-pax-reader-serial="">
                        {reader.serial}
                      </span>
                      <span className="text-muted-foreground" data-pax-reader-entity={reader.entityId}>
                        · {reader.entityName || reader.entityId}
                      </span>
                      {reader.needsLiveReenroll ? (
                        <span className="text-xs font-medium text-amber-800">Needs re-enrollment for live</span>
                      ) : null}
                      <label className="text-xs text-muted-foreground">
                        Connection
                        <select
                          className="ml-2 h-8 rounded-md border border-border bg-bg px-2 text-sm text-foreground"
                          data-pax-connection={reader.serial}
                          value={readerLink(reader)}
                          disabled={busy}
                          onChange={(e) => {
                            const next = normalizePaxLink(e.target.value);
                            void (async () => {
                              if (!resolvedLocId) return;
                              setBusy(true);
                              setPaxMsg(null);
                              try {
                                const res = await setPaxReaderLinkFn({
                                  data: { locationId: resolvedLocId, id: reader.id, link: next },
                                });
                                if (!res.ok) {
                                  setPaxMsg(res.error);
                                  return;
                                }
                                setCardReaders((rows) =>
                                  rows.map((row) => (row.id === res.reader.id ? res.reader : row)),
                                );
                                setPaxMsg(`${res.reader.name} uses ${readerLink(res.reader)}.`);
                                await load({ silent: true });
                              } catch (err) {
                                setPaxMsg(err instanceof Error ? err.message : "The connection was not saved.");
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          {PAX_READER_LINKS.map((choice) => (
                            <option key={choice.id} value={choice.id}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-pax-rename=""
                        disabled={busy}
                        onClick={() => {
                          setRenamingReaderId(reader.id);
                          setRenameDraft(reader.name);
                          setOpenReaderId(null);
                          setReplacingReaderId(null);
                          setReassignReaderId(null);
                        }}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-pax-open=""
                        disabled={busy}
                        onClick={() => {
                          setOpenReaderId(reader.id);
                          setDeviceDraft(reader.finixDeviceId);
                          setRenamingReaderId(null);
                          setReplacingReaderId(null);
                          setReassignReaderId(null);
                        }}
                      >
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-pax-replace=""
                        disabled={busy}
                        onClick={() => {
                          setReplacingReaderId(reader.id);
                          setReplaceSerial(reader.serial);
                          setReplaceDeviceId(reader.finixDeviceId);
                          setOpenReaderId(null);
                          setRenamingReaderId(null);
                          setReassignReaderId(null);
                        }}
                      >
                        Replace
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-pax-reassign=""
                        disabled={busy}
                        onClick={() => {
                          setReassignReaderId(reader.id);
                          setReassignEntityId(reader.entityId);
                          setOpenReaderId(null);
                          setRenamingReaderId(null);
                          setReplacingReaderId(null);
                        }}
                      >
                        Reassign
                      </Button>
                      {reader.needsLiveReenroll ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-pax-reenroll-live=""
                          disabled={busy}
                          onClick={() => {
                            void (async () => {
                              if (!resolvedLocId) return;
                              setBusy(true);
                              setPaxMsg(null);
                              try {
                                const res = await reenrollPaxReaderForLiveFn({
                                  data: { locationId: resolvedLocId, id: reader.id },
                                });
                                if (!res.ok) {
                                  setPaxMsg(res.error);
                                  return;
                                }
                                setCardReaders((rows) =>
                                  rows.map((row) => (row.id === res.reader.id ? res.reader : row)),
                                );
                                setPaxMsg(
                                  `${res.reader.name} is enrolled for the live merchant. Connect the reader again.`,
                                );
                                await load({ silent: true });
                              } catch (e) {
                                setPaxMsg(e instanceof Error ? e.message : "The reader was not re-enrolled.");
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          Re-enroll for live
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        data-pax-remove=""
                        disabled={busy}
                        onClick={() => {
                          void (async () => {
                            if (!resolvedLocId) return;
                            setBusy(true);
                            setPaxMsg(null);
                            try {
                              const res = await removePaxReaderFn({
                                data: { locationId: resolvedLocId, id: reader.id },
                              });
                              if (!res.ok) {
                                setPaxMsg(res.error);
                                return;
                              }
                              setCardReaders((rows) => rows.filter((row) => row.id !== reader.id));
                              setDevices(res.devices);
                              if (cardReaderId.replace(/\s+/g, "") === reader.serial.replace(/\s+/g, "")) {
                                setCardReaderId("");
                              }
                              if (replacingReaderId === reader.id) setReplacingReaderId(null);
                              if (reassignReaderId === reader.id) setReassignReaderId(null);
                              if (openReaderId === reader.id) setOpenReaderId(null);
                              if (renamingReaderId === reader.id) setRenamingReaderId(null);
                              setPaxMsg(`${res.removed.name} was removed.`);
                              await load({ silent: true });
                            } catch (e) {
                              setPaxMsg(e instanceof Error ? e.message : "The reader could not be removed.");
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Remove
                      </Button>
                    </>
                  )}
                  </div>
                  {openReaderId === reader.id ? (
                    <div className="flex flex-wrap items-end gap-2" data-pax-device-editor="">
                      <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
                        Finix device ID
                        <Input
                          className="mt-1"
                          data-pax-device-id=""
                          placeholder="DVxxxxx"
                          value={deviceDraft}
                          onChange={(e) => setDeviceDraft(e.target.value)}
                        />
                      </label>
                      <Button
                        size="sm"
                        data-pax-save-device=""
                        disabled={busy || !deviceDraft.replace(/\s+/g, "").startsWith("DV")}
                        onClick={() => {
                          void (async () => {
                            if (!resolvedLocId) return;
                            setBusy(true);
                            setPaxMsg(null);
                            try {
                              const res = await setPaxDeviceIdFn({
                                data: {
                                  locationId: resolvedLocId,
                                  id: reader.id,
                                  deviceId: deviceDraft,
                                },
                              });
                              if (!res.ok) {
                                setPaxMsg(res.error);
                                return;
                              }
                              setDeviceDraft(res.reader.finixDeviceId);
                              setCardReaders((rows) =>
                                rows.map((row) => (row.id === res.reader.id ? res.reader : row)),
                              );
                              setPaxMsg(`${res.reader.name} stores ${res.reader.finixDeviceId}.`);
                              await load({ silent: true });
                            } catch (e) {
                              setPaxMsg(e instanceof Error ? e.message : "The reader could not be saved.");
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                  {replacingReaderId === reader.id ? (
                    <div className="flex flex-wrap items-end gap-2" data-pax-replace-form="">
                      <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
                        Serial
                        <Input
                          className="mt-1"
                          data-pax-replace-serial=""
                          value={replaceSerial}
                          onChange={(e) => setReplaceSerial(e.target.value)}
                        />
                      </label>
                      <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
                        Finix device ID
                        <Input
                          className="mt-1"
                          data-pax-replace-device-id=""
                          placeholder="DVxxxxx"
                          value={replaceDeviceId}
                          onChange={(e) => setReplaceDeviceId(e.target.value)}
                        />
                      </label>
                      <Button
                        size="sm"
                        data-pax-replace-save=""
                        disabled={
                          busy ||
                          !replaceSerial.trim() ||
                          !replaceDeviceId.replace(/\s+/g, "").startsWith("DV")
                        }
                        onClick={() => {
                          void (async () => {
                            if (!resolvedLocId) return;
                            setBusy(true);
                            setPaxMsg(null);
                            const previousSerial = reader.serial;
                            try {
                              const res = await replacePaxReaderFn({
                                data: {
                                  locationId: resolvedLocId,
                                  id: reader.id,
                                  serial: replaceSerial,
                                  deviceId: replaceDeviceId,
                                },
                              });
                              if (!res.ok) {
                                setPaxMsg(res.error);
                                return;
                              }
                              setCardReaders((rows) =>
                                rows.map((row) => (row.id === res.reader.id ? res.reader : row)),
                              );
                              setDevices(res.devices);
                              if (cardReaderId.replace(/\s+/g, "") === previousSerial.replace(/\s+/g, "")) {
                                setCardReaderId(res.reader.serial);
                              }
                              setReplacingReaderId(null);
                              setPaxMsg(
                                `${res.reader.name} now uses serial ${res.reader.serial}. The station assignment stays.`,
                              );
                              await load({ silent: true });
                            } catch (e) {
                              setPaxMsg(e instanceof Error ? e.message : "The reader could not be saved.");
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                  {reassignReaderId === reader.id ? (
                    <div className="flex flex-wrap items-end gap-2" data-pax-reassign-form="">
                      <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
                        Selling entity
                        <select
                          className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                          data-pax-reassign-entity=""
                          value={reassignEntityId}
                          onChange={(e) => setReassignEntityId(e.target.value)}
                        >
                          <option value="">Pick the selling entity</option>
                          <option value={HOST_SCOPE}>{hostName}</option>
                          {operators
                            .filter((op) => op.id !== HOST_SCOPE)
                            .map((op) => (
                              <option key={op.id} value={op.id}>
                                {op.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <Button
                        size="sm"
                        data-pax-reassign-save=""
                        disabled={busy || !reassignEntityId || reassignEntityId === reader.entityId}
                        onClick={() => {
                          void (async () => {
                            if (!resolvedLocId) return;
                            setBusy(true);
                            setPaxMsg(null);
                            const entityName =
                              reassignEntityId === HOST_SCOPE
                                ? hostName
                                : operators.find((op) => op.id === reassignEntityId)?.name ||
                                  reassignEntityId;
                            try {
                              const res = await reassignPaxReaderFn({
                                data: {
                                  locationId: resolvedLocId,
                                  id: reader.id,
                                  entityId: reassignEntityId,
                                  entityName,
                                },
                              });
                              if (!res.ok) {
                                setPaxMsg(res.error);
                                return;
                              }
                              setCardReaders((rows) =>
                                rows.map((row) => (row.id === res.reader.id ? res.reader : row)),
                              );
                              setReassignReaderId(null);
                              setPaxMsg(
                                `${res.reader.name} is registered to ${res.reader.entityName || res.reader.entityId}. The tablet stays paired.`,
                              );
                              await load({ silent: true });
                            } catch (e) {
                              setPaxMsg(e instanceof Error ? e.message : "The reader could not be reassigned.");
                            } finally {
                              setBusy(false);
                            }
                          })();
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
              Name
              <Input
                className="mt-1"
                data-pax-name=""
                placeholder="Bar 1"
                value={paxName}
                onChange={(e) => setPaxName(e.target.value)}
              />
            </label>
            <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
              Serial
              <Input
                className="mt-1"
                data-pax-serial=""
                placeholder="Reader serial"
                value={paxSerial}
                onChange={(e) => setPaxSerial(e.target.value)}
              />
            </label>
            <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
              Finix device ID
              <Input
                className="mt-1"
                data-pax-new-device-id=""
                placeholder="DVxxxxx"
                value={paxDeviceId}
                onChange={(e) => setPaxDeviceId(e.target.value)}
              />
            </label>
            <label className="min-w-[10rem] flex-1 text-xs text-muted-foreground">
              Connection
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                data-pax-connection=""
                value={paxLink}
                onChange={(e) => setPaxLink(normalizePaxLink(e.target.value))}
              >
                {PAX_READER_LINKS.map((choice) => (
                  <option key={choice.id} value={choice.id}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
              Selling entity
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm"
                data-pax-entity=""
                value={paxEntityId}
                onChange={(e) => setPaxEntityId(e.target.value)}
              >
                <option value="">Pick the selling entity</option>
                <option value={HOST_SCOPE}>{hostName}</option>
                {operators
                  .filter((op) => op.id !== HOST_SCOPE)
                  .map((op) => (
                    <option key={op.id} value={op.id}>
                      {op.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              size="sm"
              data-pax-add=""
              disabled={
                busy ||
                !paxName.trim() ||
                !paxSerial.trim() ||
                !paxEntityId ||
                !paxDeviceId.replace(/\s+/g, "").startsWith("DV")
              }
              onClick={() => {
                void (async () => {
                  if (!resolvedLocId) return;
                  setBusy(true);
                  setPaxMsg(null);
                  const entityName =
                    paxEntityId === HOST_SCOPE
                      ? hostName
                      : operators.find((op) => op.id === paxEntityId)?.name || paxEntityId;
                  try {
                    const res = await registerPaxReaderFn({
                      data: {
                        locationId: resolvedLocId,
                        name: paxName,
                        serial: paxSerial,
                        entityId: paxEntityId,
                        entityName,
                        deviceId: paxDeviceId,
                        link: paxLink,
                      },
                    });
                    if (!res.ok) {
                      setPaxMsg(res.error);
                      return;
                    }
                    setPaxName("");
                    setPaxSerial("");
                    setPaxDeviceId("");
                    setPaxLink("bluetooth");
                    setCardReaders((rows) => {
                      const rest = rows.filter((row) => row.serial !== res.reader.serial);
                      return [...rest, res.reader];
                    });
                    setPaxMsg(`${res.reader.name} · ${res.reader.serial} is registered to ${res.reader.entityName || res.reader.entityId}.`);
                    await load({ silent: true });
                  } catch (e) {
                    setPaxMsg(e instanceof Error ? e.message : "The reader could not be saved.");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Add card reader
            </Button>
          </div>
          {paxMsg && (
            <p className="text-xs text-muted-foreground" role="status">
              {paxMsg}
            </p>
          )}
        </section>
      )}

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
      {msrNote && (
        <p className="rounded-xl border border-border bg-surface px-3 py-2 text-sm" role="status" data-msr-received>
          {msrNote}
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
                  mode === "stations" && !isPrinterType(type) && type !== "elo_msr"
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
            {mode === "hardware" && !isPrinterType(type) && type !== "elo_msr" ? (
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
          {type === "elo_msr" && (
            <div className="grid gap-2 sm:grid-cols-2" data-elo-msr-form>
              <label className="text-xs text-muted-foreground">
                Role
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                  data-msr-role
                  value={msrRole}
                  onChange={(e) => setMsrRole(e.target.value as MsrRole)}
                >
                  {MSR_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {MSR_ROLE_LABEL[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Tablet
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                  data-msr-station
                  value={msrStationId}
                  onChange={(e) => setMsrStationId(e.target.value)}
                >
                  <option value="">Link a tablet</option>
                  {devices
                    .filter((d) => isMsrStationType(d.type) && d.status !== "inactive")
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.label}
                      </option>
                    ))}
                </select>
              </label>
              <p className="text-[11px] text-muted-foreground sm:col-span-2">
                Gift card load, redeem, and balance use the house gift ledger. The side reader
                sends the stripe to the linked tablet. A bank card is not stored.
              </p>
            </div>
          )}
          {isPrinterType(type) && (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-muted-foreground">
                  Connection
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                    data-printer-connection
                    value={printerEthernetOnly(printModel) ? "ethernet" : printLink}
                    onChange={(e) => setPrintLink(e.target.value as PrinterLink)}
                  >
                    {printerLinkChoices(printLink, printModel).map((c) => (
                      <option key={c} value={c}>
                        {PRINTER_LINK_LABEL[c]}
                      </option>
                    ))}
                  </select>
                  {printerEthernetOnly(printModel) ? (
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      Star kitchen printers stay on Ethernet.
                    </span>
                  ) : null}
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
                      if (printerEthernetOnly(next)) setPrintLink("ethernet");
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
                {printerIsUsb(printLink, printModel) ? (
                  <p className="text-xs text-muted-foreground sm:col-span-2" data-printer-usb-status>
                    {usbStatusLabel(
                      usbLive === false
                        ? false
                        : usbLive === true
                          ? true
                          : devices.find((row) => row.id === editingId)?.print?.usbAttached,
                    )}
                  </p>
                ) : (
                  <>
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
                  </>
                )}
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
                      ? "Print check and paid receipt for a table go to the receipt printer for that table’s section."
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
                  <fieldset className="space-y-1" data-printer-food-groups>
                    <legend className="text-xs text-muted-foreground">Food groups</legend>
                    <p className="text-[11px] text-muted-foreground">
                      Menu groups checked here print on this printer. Same destination and printer
                      on one Send is one slip. Drinks still use the bar printer for the table’s
                      section.
                    </p>
                    <div className="flex flex-col gap-1">
                      {categories
                        .filter((cat) => destinationForGroup(cat).toLowerCase() !== "bar")
                        .slice()
                        .sort((a, b) => a.sort - b.sort)
                        .map((cat) => (
                          <label key={cat.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-border"
                              data-printer-food-group={cat.id}
                              checked={foodGroupIds.includes(cat.id)}
                              onChange={(e) =>
                                setFoodGroupIds((prev) =>
                                  e.target.checked
                                    ? [...prev, cat.id]
                                    : prev.filter((x) => x !== cat.id),
                                )
                              }
                            />
                            {cat.name}
                          </label>
                        ))}
                      {categories.filter((cat) => destinationForGroup(cat).toLowerCase() !== "bar")
                        .length === 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Add menu groups first, then assign them here.
                        </p>
                      )}
                    </div>
                  </fieldset>
                )}
              {isOrderPrinterType(type) && (
                <p className="text-[11px] text-muted-foreground" data-order-printer-station-note>
                  Order tablets and host stations choose which order printers they send to. This
                  printer does not assign stations.
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
          {!isPrinterType(type) && type !== "elo_msr" && mode === "stations" && stationRole !== "ods" && stationRole !== "kiosk" && (
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
              Assigned reader
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                data-pax-assign=""
                value={cardReaderId}
                onChange={(e) => setCardReaderId(e.target.value)}
              >
                <option value="">No reader</option>
                {readerAssignOptions({
                  readers: cardReaders,
                  devices,
                  tabletId: editingId,
                }).map((option) => (
                  <option key={option.serial} value={option.serial}>
                    {option.name}
                  </option>
                ))}
                {cardReaderId &&
                !cardReaders.some((reader) => reader.serial === cardReaderId) ? (
                  <option value={cardReaderId}>{cardReaderId}</option>
                ) : null}
              </select>
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
            <fieldset className="space-y-1" data-station-order-printers>
              <legend className="text-xs text-muted-foreground">
                Order printers this station sends to
              </legend>
              <p className="text-[11px] text-muted-foreground">
                Food from this station uses only the order printers checked here. Liquor still prints
                on the bar printer for the table’s section. The list is this entity’s printers and
                shared printers.
              </p>
              <div className="flex flex-col gap-1">
                {devices
                  .filter(
                    (d) =>
                      isOrderPrinterType(d.type) &&
                      d.status !== "inactive" &&
                      orderPrinterVisibleToStation(d.assignment.operatorId, operatorId),
                  )
                  .map((d) => (
                    <label key={d.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        data-station-order-printer={d.id}
                        checked={orderPrinterIds.includes(d.id)}
                        onChange={(e) =>
                          setOrderPrinterIds((prev) =>
                            e.target.checked
                              ? [...prev, d.id]
                              : prev.filter((x) => x !== d.id),
                          )
                        }
                      />
                      {d.label}
                    </label>
                  ))}
                {devices.filter(
                  (d) =>
                    isOrderPrinterType(d.type) &&
                    d.status !== "inactive" &&
                    orderPrinterVisibleToStation(d.assignment.operatorId, operatorId),
                ).length === 0 && (
                  <p className="text-[11px] text-muted-foreground">
                    Add an order printer for this entity, then check it here.
                  </p>
                )}
              </div>
            </fieldset>
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
              data-device-type={d.type}
              {...(mode === "stations" && !isPrinterDevice(d)
                ? { "data-station-reader": d.cardReaderId || "" }
                : {})}
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
                      } · ${entityName(d.assignment.operatorId)} · ${d.print.modelPreset ? PRINTER_MODEL_LABEL[d.print.modelPreset] : ""} · ${d.print.link ? PRINTER_LINK_LABEL[d.print.link] : ""} ${printerIsUsb(d.print.link, d.print.modelPreset) ? usbStatusLabel(d.print.usbAttached) : d.print.ip || d.print.target || "(pending IP)"}`
                    : d.type === "elo_msr"
                      ? `${DEVICE_TYPE_LABEL[d.type]} · ${MSR_ROLE_LABEL[d.msr?.role ?? "gift"]} · ${
                          devices.find((row) => row.id === d.msr?.stationId)?.label || "No tablet"
                        }`
                      : `${DEVICE_TYPE_LABEL[d.type]} · ${entityName(d.assignment.operatorId)} · ${DEVICE_FUNCTION_LABEL[d.assignment.function]} · ${DEVICE_ROLE_LABEL[deviceRoleFromFunction(d.assignment.function)]}`}
                </p>
                {d.type === "elo_msr" ? (
                  <p className="mt-1 text-[11px] text-muted-foreground" data-msr-status>
                    {d.msr?.lastSwipeAt
                      ? `Last swipe · ${d.msr.lastSwipeSummary || "Swipe"} · ${formatTime(d.msr.lastSwipeAt)}`
                      : "Last swipe · none"}
                  </p>
                ) : null}
                {mode === "stations" && !isPrinterDevice(d) && d.type !== "elo_msr" && d.claimCode && d.status !== "online" ? (
                  <DevicePairCode
                    code={d.claimCode}
                    expiresAt={d.claimExpiresAt}
                    locId={resolvedLocId}
                    role={deviceRoleFromFunction(d.assignment.function)}
                  />
                ) : mode === "stations" && !isPrinterDevice(d) && d.type !== "elo_msr" && d.status === "online" ? (
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
                {d.type === "elo_msr" && (
                  <>
                    {d.msr?.role === "gift" ? (
                      <label className="text-[11px] text-muted-foreground">
                        Test
                        <select
                          className="ml-1 h-8 rounded-lg border border-border bg-bg px-2 text-xs text-foreground"
                          data-msr-test-action
                          value={msrTestAction}
                          onChange={(e) => setMsrTestAction(e.target.value as MsrGiftAction)}
                        >
                          <option value="balance">Balance</option>
                          <option value="load">Load</option>
                          <option value="redeem">Redeem</option>
                        </select>
                      </label>
                    ) : null}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      data-msr-test-swipe={d.id}
                      onClick={() => void testMsr(d)}
                    >
                      Test swipe
                    </Button>
                  </>
                )}
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
  const usb = isPrinterDevice(d) && printerIsUsb(d.print?.link, d.print?.modelPreset);
  const lan = !usb && isPrinterDevice(d) ? printerLanVia(d, devices) : null;
  const presence = lan || usb ? null : stationPresenceStatus(d);
  const live = usb ? d.print?.usbAttached !== false : lan ? lan.badge === "lan_via_station" : presence === "online";
  const pending = usb ? d.print?.usbAttached === false : lan ? false : presence === "pending";
  const label = usb
    ? usbStatusLabel(d.print?.usbAttached)
    : lan
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
