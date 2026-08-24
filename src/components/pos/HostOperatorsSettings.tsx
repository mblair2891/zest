import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { OperatorOpsView } from "./OperatorOpsView";
import type { Vendor } from "@/lib/pos/types";
import { saveOperatorPayoutFn } from "@/lib/access/api";
import { isProspectDemo } from "@/lib/demo/session";
import { useSaasStore } from "@/lib/pos/saas-store";

export function HostOperatorsSettings({ write }: { write: boolean }) {
  const vendors = usePosStore((s) => s.vendors);
  const createVendor = usePosStore((s) => s.createVendor);
  const updateVendor = usePosStore((s) => s.updateVendor);
  const createEmployee = usePosStore((s) => s.createEmployee);
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const [selected, setSelected] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [stationType, setStationType] = useState<"bar" | "kitchen" | "both">("kitchen");
  const [bankLast4, setBankLast4] = useState("");
  const [bankLabel, setBankLabel] = useState("Operator payout");
  const [pinNote, setPinNote] = useState<string | null>(null);

  const onboard = () => {
    if (!write || !name.trim()) return;
    const { id } = createVendor({
      name: name.trim(),
      stationType,
      bankLast4,
      bankLabel,
    });
    if (!id) return;
    const staff = createEmployee({
      name: `${name.trim()} operator`,
      role: "vendor_operator",
      operatorId: id,
      title: "Vendor operator",
    });
    setPinNote(`Onboarded ${name.trim()}. Operator PIN ${staff.pin}. Payout is host-managed.`);
    setName("");
    setBankLast4("");
    setSelected(id);
  };

  if (selected) {
    return (
      <div>
        <Button size="sm" variant="outline" className="mb-3" onClick={() => setSelected(null)}>
          ← All operators
        </Button>
        <OperatorOpsView operatorId={selected} hostManaged />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-demo="host-operators">
      <p className="text-xs text-muted-foreground">
        You are the subscriber host. Guest operators (stalls, kitchens, bars) get operator ops
        only — not location tax, cash discount, packages, or payout routing. Collect their payout
        destination here; they cannot change it.
      </p>

      <section className="rounded-2xl border border-border bg-surface p-4" data-demo="host-payouts">
        <h3 className="mb-3 text-sm font-semibold">Payout destinations (host-managed)</h3>
        <div className="space-y-2">
          {vendors.map((v) => (
            <PayoutRow
              key={v.id}
              vendor={v}
              write={write}
              onSave={(id, patch) => {
                updateVendor(id, patch);
                if (!isProspectDemo() && orgId && locId && patch.bankLast4) {
                  void saveOperatorPayoutFn({
                    data: {
                      orgId,
                      locationId: locId,
                      operatorId: id,
                      bankLast4: patch.bankLast4,
                      bankLabel: patch.bankLabel || v.bankLabel,
                    },
                  }).catch(() => undefined);
                }
              }}
            />
          ))}
          {vendors.length === 0 && (
            <p className="text-sm text-muted-foreground">No guest operators yet.</p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="mb-3 text-sm font-semibold">Operators at this host</h3>
        <ul className="space-y-2">
          {vendors.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">
                  <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: v.color }} />
                  {v.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {v.stationLabel} · {v.active ? "Active" : "Suspended"}
                </p>
              </div>
              <div className="flex gap-2">
                {write && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateVendor(v.id, { active: !v.active })}
                  >
                    {v.active ? "Suspend" : "Restore"}
                  </Button>
                )}
                <Button size="sm" onClick={() => setSelected(v.id)}>
                  Operator ops
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {write && (
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h3 className="mb-3 text-sm font-semibold">Onboard guest operator</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Steam Distillery" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Station</span>
              <select
                className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
                value={stationType}
                onChange={(e) => setStationType(e.target.value as "bar" | "kitchen" | "both")}
              >
                <option value="kitchen">Kitchen</option>
                <option value="bar">Bar</option>
                <option value="both">Bar + kitchen</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Payout bank last 4</span>
              <Input
                value={bankLast4}
                maxLength={4}
                onChange={(e) => setBankLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Payout label</span>
              <Input value={bankLabel} onChange={(e) => setBankLabel(e.target.value)} />
            </label>
          </div>
          <Button className="mt-3" type="button" disabled={!name.trim()} onClick={onboard}>
            Onboard operator
          </Button>
          {pinNote && <p className="mt-2 text-xs text-muted-foreground">{pinNote}</p>}
        </section>
      )}
    </div>
  );
}

function PayoutRow({
  vendor,
  write,
  onSave,
}: {
  vendor: Vendor;
  write: boolean;
  onSave: (id: string, patch: { bankLast4?: string; bankLabel?: string }) => void;
}) {
  const [last4, setLast4] = useState(vendor.bankLast4);
  const [label, setLabel] = useState(vendor.bankLabel);
  return (
    <div className="grid gap-2 rounded-xl border border-border px-3 py-2 sm:grid-cols-4 sm:items-end">
      <p className="text-sm font-medium sm:col-span-1">{vendor.shortName}</p>
      <label className="text-xs text-muted-foreground">
        Bank last 4
        <Input
          className="mt-1"
          value={last4}
          maxLength={4}
          disabled={!write}
          onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Label
        <Input className="mt-1" value={label} disabled={!write} onChange={(e) => setLabel(e.target.value)} />
      </label>
      {write && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => onSave(vendor.id, { bankLast4: last4, bankLabel: label })}
        >
          Save payout
        </Button>
      )}
      {!write && (
        <Badge variant="secondary" className="h-fit">
          Host-managed
        </Badge>
      )}
    </div>
  );
}
