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
import { getSessionContextFn } from "@/lib/saas/api";
import { canDeleteVenueDevice } from "@/lib/saas/tenant-users";
import {
  DEVICE_FUNCTION_LABEL,
  DEVICE_TYPE_LABEL,
  HARDWARE_DEVICE_TYPES,
  PRINT_ROUTE_LABEL,
  PRINT_ROUTES,
  PRINT_STATION_LABEL,
  PRINTER_LINK_LABEL,
  PRINTER_LINKS,
  PRINTER_MODEL_LABEL,
  PRINTER_MODEL_PRESETS,
  STATION_DEVICE_FUNCTIONS,
  STATION_DEVICE_TYPES,
  defaultFunctionForType,
  defaultRoutesForPrinterType,
  familyFromModelPreset,
  functionForPrintStation,
  isPairedActivatedStation,
  isPrinterDevice,
  isPrinterType,
  printerStatusLabel,
  readOrCreateBrowserDeviceId,
  readPairedDeviceId,
  stationFromPrinterType,
  writePairedDeviceId,
  type DeviceFunction,
  type DeviceRoleChange,
  type LocationDevice,
  type LocationDeviceType,
  type PrintRoute,
  type PrinterDrawerKick,
  type PrinterLink,
  type PrinterModelPreset,
} from "@/lib/pos/location-devices";
import { dispatchPrintJob, testPrintJob } from "@/lib/print/dispatch";
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
  return [
    ...STATION_DEVICE_TYPES,
    "receipt_printer",
    "kitchen_printer",
    "bar_printer",
    "label_printer",
  ];
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
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<LocationDeviceType>(
    mode === "hardware" ? "printer" : "tablet_pos",
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
  const [printModel, setPrintModel] = useState<PrinterModelPreset>("epson_tm_t20");
  const [drawerKick, setDrawerKick] = useState<PrinterDrawerKick>("attached");
  const [printRoutes, setPrintRoutes] = useState<PrintRoute[]>(["receipts"]);
  const [boundStationIds, setBoundStationIds] = useState<string[]>([]);
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

  const load = useCallback(async () => {
    if (!resolvedOrgId || !resolvedLocId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listLocationDevicesFn({
        data: { orgId: resolvedOrgId, locationId: resolvedLocId },
      });
      setDevices(res.devices);
      setOperators(res.operators);
      setRoleHistory(res.roleHistory ?? []);
      setHostName(res.hostName || locationName || "Venue");
      try {
        const next = res.devices.filter((d) => d.status !== "inactive");
        const prev = usePosStore.getState().locationDevices ?? [];
        const same =
          prev.length === next.length &&
          prev.every((d, i) => d.id === next[i]?.id && d.status === next[i]?.status);
        if (!same) usePosStore.setState({ locationDevices: next });
      } catch {
        /* POS store may not be hydrated on dashboard */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load devices");
    } finally {
      setLoading(false);
    }
    // locationName is a fallback label only — do not re-fetch when the house name types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedOrgId, resolvedLocId]);

  useEffect(() => {
    void load();
  }, [load]);

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
    setType(preset?.type ?? (mode === "hardware" ? "printer" : "tablet_pos"));
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
    const printerType = preset?.type && isPrinterType(preset.type) ? preset.type : null;
    setPrintLink(preset?.print?.link ?? "ethernet");
    setPrintIp(preset?.print?.ip ?? (preset?.print?.target?.split(":")[0] ?? ""));
    setPrintPort(String(preset?.print?.port ?? 9100));
    setPrintModel(
      preset?.print?.modelPreset ??
        (printerType === "kitchen_printer" ? "epson_tm_u220" : "epson_tm_t20"),
    );
    setDrawerKick(
      preset?.print?.drawerKick ??
        (printerType === "receipt_printer" || printerType === "printer" ? "attached" : "none"),
    );
    setPrintRoutes(
      preset?.print?.routes?.length
        ? preset.print.routes
        : printerType
          ? defaultRoutesForPrinterType(printerType)
          : ["receipts"],
    );
    setBoundStationIds(preset?.print?.boundStationIds ?? []);
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
          ? functionForPrintStation(stationFromPrinterType(type))
          : mode === "stations"
            ? functionForDeviceRole(stationRole)
            : fn;
      const ip = printIp.trim();
      const port = Number(printPort) || 9100;
      const target = ip ? `${ip}:${port}` : "";
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
                  station: stationFromPrinterType(type),
                  link: printLink,
                  ip,
                  port,
                  modelPreset: printModel,
                  drawerKick,
                  routes: printRoutes.length
                    ? printRoutes
                    : defaultRoutesForPrinterType(type),
                  boundStationIds,
                }
              : undefined,
            receiptPrinterId: printer ? null : receiptPrinterId || null,
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
    try {
      const job = testPrintJob({
        locationId: resolvedLocId,
        locationName: hostName || locationName,
        station: d.print?.station ?? stationFromPrinterType(d.type),
      });
      const noTarget = !d.print?.target && !d.print?.ip;
      const result = await dispatchPrintJob(job, [d], {
        forceBrowser: noTarget,
        printerId: d.id,
      });
      const ok = result.printed > 0;
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
              lastPrintAt: ok ? Date.now() : d.print?.lastPrintAt,
              reachability: ok ? "idle" : "unreachable",
            },
          },
        },
      });
      await load();
      if (!ok) setError("Test print did not reach the printer.");
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
      ? "Register Quantum readers and Epson / ESC/POS printers. Wi-Fi or Ethernet, static IP (port 9100). Test print from this list."
      : "Add a tablet or a printer from the same button. Tablets: pick Order / Host / ODS / Kiosk, then type the one-time code on the glass. Printers: name, Wi-Fi or Ethernet, static IP, routes, entity, and which stations send to it. Host and order tablets use the bound receipt printer; ODS does not need one. Deactivate or Delete works the same for both.";
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
                    setPrintRoutes(defaultRoutesForPrinterType(next));
                    setDrawerKick(next === "receipt_printer" ? "attached" : "none");
                    setPrintModel(next === "kitchen_printer" ? "epson_tm_u220" : "epson_tm_t20");
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
                    onChange={(e) => setPrintModel(e.target.value as PrinterModelPreset)}
                  >
                    {PRINTER_MODEL_PRESETS.map((m) => (
                      <option key={m} value={m}>
                        {PRINTER_MODEL_LABEL[m]}
                      </option>
                    ))}
                  </select>
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
                <label className="text-xs text-muted-foreground">
                  Cash drawer kick
                  <select
                    className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                    value={drawerKick}
                    onChange={(e) => setDrawerKick(e.target.value as PrinterDrawerKick)}
                  >
                    <option value="none">None</option>
                    <option value="attached">Attached to this printer</option>
                  </select>
                </label>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-xs text-muted-foreground">Routes</legend>
                <div className="flex flex-wrap gap-3">
                  {PRINT_ROUTES.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={printRoutes.includes(r)}
                        onChange={(e) =>
                          setPrintRoutes((prev) =>
                            e.target.checked
                              ? [...prev, r]
                              : prev.filter((x) => x !== r),
                          )
                        }
                      />
                      {PRINT_ROUTE_LABEL[r]}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-1">
                <legend className="text-xs text-muted-foreground">
                  Station bindings
                </legend>
                <p className="text-[11px] text-muted-foreground">
                  Which order / host / ODS devices send to this printer. Empty = venue default for
                  its routes. ODS does not need a receipt printer.
                </p>
                <div className="flex flex-col gap-1">
                  {devices
                    .filter((d) => !isPrinterDevice(d) && d.status !== "inactive")
                    .map((d) => {
                      const role = deviceRoleFromFunction(d.assignment.function);
                      if (type === "receipt_printer" && (role === "ods" || role === "kiosk")) {
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
            </div>
          )}
          {!isPrinterType(type) &&
            mode === "stations" &&
            stationRole !== "ods" &&
            stationRole !== "kiosk" && (
            <label className="block text-xs text-muted-foreground">
              Receipt printer
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                value={receiptPrinterId}
                onChange={(e) => setReceiptPrinterId(e.target.value)}
              >
                <option value="">Venue default receipt printer</option>
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
            </label>
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
              ? "Add a card terminal or receipt/kitchen printer so the house can find it."
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
                  {DEVICE_TYPE_LABEL[d.type]} · {entityName(d.assignment.operatorId)} ·{" "}
                  {isPrinterDevice(d) && d.print
                    ? `${(d.print.routes ?? []).map((r) => PRINT_ROUTE_LABEL[r]).join(" / ") || PRINT_STATION_LABEL[d.print.station]} · ${d.print.modelPreset ? PRINTER_MODEL_LABEL[d.print.modelPreset] : ""} · ${d.print.link ? PRINTER_LINK_LABEL[d.print.link] : ""} ${d.print.ip || d.print.target || "(pending IP)"}`
                    : `${DEVICE_FUNCTION_LABEL[d.assignment.function]} · ${DEVICE_ROLE_LABEL[deviceRoleFromFunction(d.assignment.function)]}`}
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
                <Badge
                  variant={
                    isPrinterDevice(d)
                      ? printerStatusLabel(d) === "last-print"
                        ? "success"
                        : printerStatusLabel(d) === "unreachable" ||
                            printerStatusLabel(d) === "pending"
                          ? "warn"
                          : "secondary"
                      : d.status === "online"
                        ? "success"
                        : d.status === "pending"
                          ? "warn"
                          : "secondary"
                  }
                >
                  {isPrinterDevice(d) ? printerStatusLabel(d) : d.status}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {d.lastSeenAt ? formatTime(d.lastSeenAt) : "—"}
                </span>
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
