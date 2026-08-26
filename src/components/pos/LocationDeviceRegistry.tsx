import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  deactivateLocationDeviceFn,
  listLocationDevicesFn,
  saveLocationDeviceFn,
} from "@/lib/access/api";
import {
  DEVICE_FUNCTION_LABEL,
  DEVICE_TYPE_LABEL,
  HARDWARE_DEVICE_TYPES,
  STATION_DEVICE_FUNCTIONS,
  STATION_DEVICE_TYPES,
  defaultFunctionForType,
  readOrCreateBrowserDeviceId,
  type DeviceFunction,
  type LocationDevice,
  type LocationDeviceType,
} from "@/lib/pos/location-devices";
import { usePosStore } from "@/lib/pos/store";
import { formatTime } from "@/lib/utils";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

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
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !locationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await listLocationDevicesFn({ data: { orgId, locationId } });
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
  }, [orgId, locationId, locationName]);

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
    setFormOpen(true);
  };

  const save = async (opts?: { id?: string; asBrowser?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      const id = opts?.id || editingId || (opts?.asBrowser ? readOrCreateBrowserDeviceId(locationId) : "");
      const name =
        label.trim() ||
        (opts?.asBrowser ? "This browser" : mode === "hardware" ? "Printer" : "Device");
      await saveLocationDeviceFn({
        data: {
          orgId,
          locationId,
          device: {
            id,
            label: name,
            type,
            assignment: { operatorId, function: fn },
            serial: opts?.asBrowser ? "browser" : undefined,
          },
        },
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

  const toggleActive = async (d: LocationDevice) => {
    setBusy(true);
    setError(null);
    try {
      await deactivateLocationDeviceFn({
        data: {
          orgId,
          locationId,
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

  const heading = mode === "hardware" ? "Hardware" : "Devices";
  const help =
    mode === "hardware"
      ? "Register card terminals and printers for this location. They are house assets — not locked to one operator."
      : "Register tablets, order displays, and kiosks. Suggested entity and function is a default; any device can switch via This station.";
  const addLabel = mode === "hardware" ? "Add terminal / printer" : "Add device";

  if (!locationId) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-dashed border-border bg-surface px-6 py-10 text-center">
        <p className="font-semibold">{heading}</p>
        <p className="mt-1 text-sm text-muted-foreground">Pick a location first.</p>
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
            {mode === "stations" && (
              <GuideLearnLink topicId="station-switcher">Learn</GuideLearnLink>
            )}
            <Button size="sm" onClick={() => resetForm()}>
              {addLabel}
            </Button>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {locationName} · persist on this location
        </p>
      </div>

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
          </div>
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
                Use this browser as a device
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
              : "Add a tablet, order display, or kiosk — or register this browser."}
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
                Use this browser as a device
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
              <div className="min-w-0">
                <p className="font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">
                  {DEVICE_TYPE_LABEL[d.type]} · {entityName(d.assignment.operatorId)} ·{" "}
                  {DEVICE_FUNCTION_LABEL[d.assignment.function]}
                  {d.claimCode ? ` · claim ${d.claimCode}` : ""}
                </p>
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
