import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import {
  DEVICE_FUNCTION_LABEL,
  DEVICE_FUNCTIONS,
  DEVICE_TYPE_LABEL,
  DEVICE_TYPES,
  type DeviceFunction,
  type LocationDeviceType,
} from "@/lib/pos/location-devices";
import { saveLocationDeviceFn } from "@/lib/access/api";
import { isProspectDemo } from "@/lib/demo/session";
import { useSaasStore } from "@/lib/pos/saas-store";

export function DeviceAssignmentPanel({ write }: { write: boolean }) {
  const devices = usePosStore((s) => s.locationDevices ?? []);
  const vendors = usePosStore((s) => s.vendors);
  const settings = usePosStore((s) => s.settings);
  const assign = usePosStore((s) => s.setLocationDeviceAssignment);
  const enroll = usePosStore((s) => s.enrollLocationDevice);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const orgId = useSaasStore((s) => s.org.id);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<LocationDeviceType>("tablet_pos");
  const [op, setOp] = useState(HOST_SCOPE);
  const [fn, setFn] = useState<DeviceFunction>("floor_pos");
  const [claim, setClaim] = useState<string | null>(null);

  const names = (id: string) =>
    id === HOST_SCOPE
      ? settings.name || "Host"
      : vendors.find((v) => v.id === id)?.name ?? id;

  const persist = (
    id: string,
    assignment: { operatorId: string; function: DeviceFunction },
    extra?: { label?: string; type?: LocationDeviceType },
  ) => {
    assign(id, assignment);
    if (!isProspectDemo() && orgId && locId) {
      const d = usePosStore.getState().locationDevices.find((x) => x.id === id);
      void saveLocationDeviceFn({
        data: {
          orgId,
          locationId: locId,
          device: {
            id,
            label: extra?.label || d?.label || "Device",
            type: extra?.type || d?.type || "tablet_pos",
            serial: d?.serial,
            assignment,
          },
        },
      }).catch(() => undefined);
    }
  };

  const add = () => {
    if (!write || !label.trim()) return;
    const res = enroll({
      label: label.trim(),
      type,
      assignment: { operatorId: op, function: fn },
    });
    setClaim(res.claimCode);
    setLabel("");
    if (res.id) persist(res.id, { operatorId: op, function: fn }, { label: label.trim(), type });
  };

  return (
    <section
      className="rounded-2xl border border-border bg-surface p-4"
      data-demo="device-assign"
    >
      <h3 className="mb-1 text-sm font-semibold">Device assignment</h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Location assets. Assign any tablet to an entity and a function (Floor POS,
        Kitchen ODS, Bar ODS, Expo) without new hardware. Claim codes pair devices.
      </p>
      <ul className="space-y-2">
        {devices.map((d) => (
          <li
            key={d.id}
            className="grid gap-2 rounded-xl border border-border px-3 py-2 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
          >
            <div>
              <p className="text-sm font-medium">{d.label}</p>
              <p className="text-xs text-muted-foreground">
                {DEVICE_TYPE_LABEL[d.type]} · {d.status}
                {d.claimCode ? ` · claim ${d.claimCode}` : ""}
              </p>
            </div>
            <select
              className="h-9 rounded-md border border-border bg-bg px-2 text-xs"
              value={d.assignment.operatorId}
              disabled={!write}
              onChange={(e) =>
                persist(d.id, { ...d.assignment, operatorId: e.target.value })
              }
            >
              <option value={HOST_SCOPE}>{settings.name || "Host"}</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-border bg-bg px-2 text-xs"
              value={d.assignment.function}
              disabled={!write}
              onChange={(e) =>
                persist(d.id, {
                  ...d.assignment,
                  function: e.target.value as DeviceFunction,
                })
              }
            >
              {DEVICE_FUNCTIONS.map((f) => (
                <option key={f} value={f}>
                  {DEVICE_FUNCTION_LABEL[f]}
                </option>
              ))}
            </select>
            <Badge variant="secondary">
              {names(d.assignment.operatorId)}
            </Badge>
          </li>
        ))}
        {devices.length === 0 && (
          <li className="text-sm text-muted-foreground">No devices enrolled yet.</li>
        )}
      </ul>
      {write && (
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          <Input
            placeholder="Label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <select
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value as LocationDeviceType)}
          >
            {DEVICE_TYPES.map((t) => (
              <option key={t} value={t}>
                {DEVICE_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
            value={op}
            onChange={(e) => setOp(e.target.value)}
          >
            <option value={HOST_SCOPE}>{settings.name || "Host"}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
            value={fn}
            onChange={(e) => setFn(e.target.value as DeviceFunction)}
          >
            {DEVICE_FUNCTIONS.map((f) => (
              <option key={f} value={f}>
                {DEVICE_FUNCTION_LABEL[f]}
              </option>
            ))}
          </select>
          <Button type="button" className="sm:col-span-4" disabled={!label.trim()} onClick={add}>
            Enroll device
          </Button>
          {claim && (
            <p className="sm:col-span-4 text-xs text-muted-foreground">
              Claim code {claim}. Pair the tablet, or reassign here any time.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
