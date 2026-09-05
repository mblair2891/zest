import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  claimLocationDeviceFn,
  deactivateLocationDeviceFn,
  listLocationDevicesFn,
  saveLocationDeviceFn,
} from "@/lib/access/api";
import { getSessionContextFn } from "@/lib/saas/api";
import {
  DEVICE_FUNCTION_LABEL,
  DEVICE_TYPE_LABEL,
  HARDWARE_DEVICE_TYPES,
  PRINT_STATIONS,
  PRINT_STATION_LABEL,
  PRINTER_CONNECTIONS,
  PRINTER_CONNECTION_LABEL,
  PRINTER_FAMILIES,
  PRINTER_FAMILY_LABEL,
  STATION_DEVICE_FUNCTIONS,
  STATION_DEVICE_TYPES,
  defaultFunctionForType,
  functionForPrintStation,
  readOrCreateBrowserDeviceId,
  readPairedDeviceId,
  writePairedDeviceId,
  type DeviceFunction,
  type LocationDevice,
  type LocationDeviceType,
  type PrintStation,
  type PrinterConnection,
  type PrinterFamily,
} from "@/lib/pos/location-devices";
import { dispatchPrintJob, testPrintJob } from "@/lib/print/dispatch";
import { usePosStore } from "@/lib/pos/store";
import { formatTime } from "@/lib/utils";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { pairQrImageSrc, stationPairHref } from "@/lib/pos/station-pair";
import { DEVICE_ROLE_LABEL, deviceRoleFromFunction } from "@/lib/pos/device-roles";

type Mode = "stations" | "hardware";

const HARDWARE_FUNCTIONS: DeviceFunction[] = ["cashier", "expo", "floor_pos"];

function typeOptions(mode: Mode): LocationDeviceType[] {
  return mode === "hardware" ? HARDWARE_DEVICE_TYPES : STATION_DEVICE_TYPES;
}

function functionOptions(mode: Mode): DeviceFunction[] {
  return mode === "hardware" ? HARDWARE_FUNCTIONS : STATION_DEVICE_FUNCTIONS;
}

function inMode(d: LocationDevice, mode: Mode): boolean {
  const types = typeOptions(mode);
  return types.includes(d.type);
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
  const [operators, setOperators] = useState<Array<{ id: string; name: string }>>([]);
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
  const [printFamily, setPrintFamily] = useState<PrinterFamily>("generic");
  const [printConnection, setPrintConnection] = useState<PrinterConnection>("browser");
  const [printTarget, setPrintTarget] = useState("");
  const [printStation, setPrintStation] = useState<PrintStation>("receipt");
  const [busy, setBusy] = useState(false);
  const [claimInput, setClaimInput] = useState("");
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
    if (orgId && locationId) return;
    let cancelled = false;
    void getSessionContextFn()
      .then((ctx) => {
        if (cancelled) return;
        const locs = ctx.locations.map((l) => ({ id: l.id, name: l.name, orgId: l.orgId }));
        setSessionLocs(locs);
        const loc =
          locs.find((l) => l.id === ctx.active?.locationId) ?? locs[0];
        if (!loc) return;
        const org = ctx.orgs.find((o) => o.id === loc.orgId) ?? ctx.orgs[0];
        setResolvedLocId(loc.id);
        setResolvedName(loc.name);
        setResolvedOrgId(org?.id || loc.orgId);
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
      setHostName(res.hostName || locationName);
      try {
        usePosStore.setState({ locationDevices: res.devices.filter((d) => d.status !== "inactive") });
      } catch {
        /* POS store may not be hydrated on dashboard */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load devices");
    } finally {
      setLoading(false);
    }
  }, [resolvedOrgId, resolvedLocId, locationName]);

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
    setPrintFamily(preset?.print?.family ?? "generic");
    setPrintConnection(preset?.print?.connection ?? "browser");
    setPrintTarget(preset?.print?.target ?? "");
    setPrintStation(preset?.print?.station ?? "receipt");
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
      const printer = type === "printer";
      await saveLocationDeviceFn({
        data: {
          orgId: resolvedOrgId,
          locationId: resolvedLocId,
          device: {
            id,
            label: name,
            type,
            assignment: {
              operatorId,
              function: printer ? functionForPrintStation(printStation) : fn,
            },
            serial: opts?.asBrowser
              ? readOrCreateBrowserDeviceId(resolvedLocId)
              : printTarget || undefined,
            print: printer
              ? {
                  family: printFamily,
                  connection: printConnection,
                  target: printTarget.trim(),
                  station: printStation,
                }
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

  const heading = mode === "hardware" ? "Hardware" : "Devices";
  const help =
    mode === "hardware"
      ? "Register Quantum readers and Star/Epson printers. Assign kitchen, bar, receipt, or expo. Test print from this list."
      : "Pair a Summex Station tablet with the venue code or QR. The APK has no location baked in. After pair, the tablet is PIN only.";
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
            <GuideLearnLink topicId={mode === "hardware" ? "printers-kds" : "station-switcher"}>
              Learn
            </GuideLearnLink>
            <Button size="sm" onClick={() => resetForm()}>
              {addLabel}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {resolvedName || locationName} · persist on this location
        </p>
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
              onChange={(e) => setClaimInput(e.target.value.toUpperCase())}
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
                value={type}
                onChange={(e) => {
                  const next = e.target.value as LocationDeviceType;
                  setType(next);
                  setFn(defaultFunctionForType(next));
                }}
              >
                {typeOptions(mode).map((t) => (
                  <option key={t} value={t}>
                    {DEVICE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              Entity
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                value={operatorId}
                onChange={(e) => setOperatorId(e.target.value)}
              >
                <option value={HOST_SCOPE}>{hostName || "Host"}</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
            {type === "printer" ? (
              <label className="text-xs text-muted-foreground">
                Prints
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                  value={printStation}
                  onChange={(e) => setPrintStation(e.target.value as PrintStation)}
                >
                  {PRINT_STATIONS.map((s) => (
                    <option key={s} value={s}>
                      {PRINT_STATION_LABEL[s]}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
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
            )}
          </div>
          {type === "printer" && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="text-xs text-muted-foreground">
                Model family
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                  value={printFamily}
                  onChange={(e) => setPrintFamily(e.target.value as PrinterFamily)}
                >
                  {PRINTER_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {PRINTER_FAMILY_LABEL[f]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                Connection
                <select
                  className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm text-foreground"
                  value={printConnection}
                  onChange={(e) => setPrintConnection(e.target.value as PrinterConnection)}
                >
                  {PRINTER_CONNECTIONS.map((c) => (
                    <option key={c} value={c}>
                      {PRINTER_CONNECTION_LABEL[c]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted-foreground">
                IP / target
                <Input
                  className="mt-1"
                  placeholder="192.168.1.50:9100"
                  value={printTarget}
                  onChange={(e) => setPrintTarget(e.target.value)}
                  disabled={printConnection === "browser"}
                />
              </label>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={() => void save()}>
              Save
            </Button>
            {mode === "stations" && !editingId && (
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
                {mode === "stations" && d.claimCode ? (
                  <img
                    src={pairQrImageSrc(d.claimCode)}
                    alt={`Pair QR ${d.claimCode}`}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] shrink-0 rounded-md border border-border bg-white p-1"
                  />
                ) : null}
                <div className="min-w-0">
                <p className="font-medium">
                  {d.label}
                  {(pairedId === d.id || d.id === thisBrowserId || d.serial === thisBrowserId) && (
                    <span className="ml-2 text-[11px] font-normal text-primary">This browser</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {DEVICE_TYPE_LABEL[d.type]} · {entityName(d.assignment.operatorId)} ·{" "}
                  {d.print
                    ? `${PRINT_STATION_LABEL[d.print.station]} · ${PRINTER_FAMILY_LABEL[d.print.family]} · ${PRINTER_CONNECTION_LABEL[d.print.connection]}${d.print.target ? ` · ${d.print.target}` : ""}`
                    : `${DEVICE_FUNCTION_LABEL[d.assignment.function]} · ${DEVICE_ROLE_LABEL[deviceRoleFromFunction(d.assignment.function)]}`}
                </p>
                {mode === "stations" && d.claimCode ? (
                  <p className="mt-1 font-mono text-sm tracking-[0.2em] text-foreground">
                    {d.claimCode}
                    <span className="ml-2 font-sans text-[11px] tracking-normal text-muted-foreground">
                      {stationPairHref(d.claimCode).replace(/^https?:\/\//, "")}
                    </span>
                  </p>
                ) : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    d.status === "online" ? "success" : d.status === "pending" ? "warn" : "secondary"
                  }
                >
                  {d.status}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {d.lastSeenAt ? formatTime(d.lastSeenAt) : "—"}
                </span>
                {d.type === "printer" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      const job = testPrintJob({
                        locationId: resolvedLocId,
                        locationName: hostName || locationName,
                        station: d.print?.station ?? "receipt",
                      });
                      void dispatchPrintJob(job, [d], {
                        forceBrowser: d.print?.connection === "browser" || !d.print?.target,
                      });
                    }}
                  >
                    Test print
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => resetForm(d)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void toggleActive(d)}
                >
                  Deactivate
                </Button>
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
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void toggleActive(d)}
                >
                  Reactivate
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
