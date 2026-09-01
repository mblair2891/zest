import { usePosStore } from "@/lib/pos/store";
import {
  APPROVAL_GATES,
  DEFAULT_DISCOUNT_CAPS,
  DEFAULT_SHIFT_LEAD_GATES,
  parseLossPrevention,
  SHIFT_LEAD_ROLES,
  type DiscountCap,
  type GateMode,
  type PendingRejectPolicy,
  type ShiftLeadGrant,
} from "@/lib/pos/loss-prevention";
import type { EmployeeRole } from "@/lib/pos/types";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const CAP_ROLES: EmployeeRole[] = [
  "server",
  "bartender",
  "host",
  "cashier",
  "manager",
];

export function LossPreventionSettings({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const cfg = parseLossPrevention(settings.lossPrevention);

  const patch = (next: Partial<typeof cfg>) => {
    if (!write) return;
    updateSettings({ lossPrevention: { ...cfg, ...next } });
  };

  const patchCap = (role: EmployeeRole, cap: DiscountCap) => {
    patch({ discountCaps: { ...cfg.discountCaps, [role]: cap } });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Gates log who authorized a change. They do not accuse anyone. Paid checks stay frozen until a
        manager reopens them with a reason.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Num
          label="Lock PIN after failures"
          value={cfg.pinLockoutAttempts}
          min={3}
          max={20}
          disabled={!write}
          onChange={(n) => patch({ pinLockoutAttempts: n })}
        />
        <Num
          label="Manager session (minutes)"
          value={cfg.managerSessionMinutes}
          min={1}
          max={60}
          disabled={!write}
          onChange={(n) => patch({ managerSessionMinutes: n })}
        />
      </div>
      <Gate
        label="Void after send to ODS"
        value={cfg.voidAfterSend}
        disabled={!write}
        onChange={(v) => patch({ voidAfterSend: v })}
      />
      <Gate
        label="Void after bump (ticket marked VOID)"
        value={cfg.voidAfterBump}
        disabled={!write}
        onChange={(v) => patch({ voidAfterBump: v })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.compAlwaysManager}
          disabled={!write}
          onChange={(e) => patch({ compAlwaysManager: e.target.checked })}
        />
        Comp always needs manager PIN + reason
      </label>
      <Gate
        label="Discount after send"
        value={cfg.discountAfterSend}
        disabled={!write}
        onChange={(v) => patch({ discountAfterSend: v })}
      />
      <Gate
        label="Reopen / tender-swap paid check"
        value={cfg.paidCheckReopen}
        disabled={!write}
        onChange={(v) => patch({ paidCheckReopen: v })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.giftAdjustManager}
          disabled={!write}
          onChange={(e) => patch({ giftAdjustManager: e.target.checked })}
        />
        Gift adjust / deactivate is manager only
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.giftLoadRequiresTender}
          disabled={!write}
          onChange={(e) => patch({ giftLoadRequiresTender: e.target.checked })}
        />
        Gift load requires cash or card on the same ticket
      </label>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Discount caps by role (no silent stacking)
        </p>
        <div className="space-y-2">
          {CAP_ROLES.map((role) => {
            const cap = cfg.discountCaps[role] ?? DEFAULT_DISCOUNT_CAPS[role];
            return (
              <div key={role} className="grid grid-cols-[7rem_1fr_1fr] items-center gap-2 text-sm">
                <span>{ROLE_LABEL[role]}</span>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  %
                  <input
                    type="number"
                    min={0}
                    max={100}
                    disabled={!write}
                    className="h-8 w-16 rounded-md border border-border bg-bg px-2 text-foreground"
                    value={cap.maxPercent}
                    onChange={(e) =>
                      patchCap(role, { ...cap, maxPercent: Math.max(0, Number(e.target.value) || 0) })
                    }
                  />
                </label>
                <label className="flex items-center gap-1 text-xs text-muted-foreground">
                  extra $
                  <input
                    type="number"
                    min={0}
                    disabled={!write}
                    className="h-8 w-20 rounded-md border border-border bg-bg px-2 text-foreground"
                    value={(cap.maxCents / 100).toFixed(0)}
                    onChange={(e) =>
                      patchCap(role, {
                        ...cap,
                        maxCents: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)),
                      })
                    }
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>
      <Num
        label="Void/comp before send under $ (no gate)"
        value={cfg.voidCompBeforeSendCents / 100}
        min={0}
        max={50}
        step={0.5}
        disabled={!write}
        onChange={(n) => patch({ voidCompBeforeSendCents: Math.round(n * 100) })}
      />
      <p className="text-sm font-medium">When no manager is on the floor</p>
      <ShiftLeadEditor
        grants={cfg.shiftLeadGrants}
        disabled={!write}
        onChange={(shiftLeadGrants) => patch({ shiftLeadGrants })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.pendingApproval}
          disabled={!write}
          onChange={(e) => patch({ pendingApproval: e.target.checked })}
        />
        Pending approval — hold the action for a manager or shift lead
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Fired ODS tickets on deny</span>
        <select
          disabled={!write}
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
          value={cfg.pendingRejectPolicy}
          onChange={(e) => patch({ pendingRejectPolicy: e.target.value as PendingRejectPolicy })}
        >
          <option value="leave">Leave in kitchen</option>
          <option value="auto_void">Auto-void kitchen ticket</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.remoteApprove}
          disabled={!write}
          onChange={(e) => patch({ remoteApprove: e.target.checked })}
        />
        Notify on-call (in-app + SMS when Twilio is on)
      </label>
      <OnCallEditor
        list={cfg.onCallList}
        disabled={!write}
        onChange={(onCallList) => patch({ onCallList })}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.breakGlass}
          disabled={!write}
          onChange={(e) => patch({ breakGlass: e.target.checked })}
        />
        Break-glass — clocked-in PIN + reason; always alerts and flags
      </label>
      <Num
        label="Flag vs house when ≥ this × house rate"
        value={cfg.outlierMultiplier}
        min={1.5}
        max={10}
        step={0.5}
        disabled={!write}
        onChange={(n) => patch({ outlierMultiplier: n })}
      />
      <p className="text-xs text-muted-foreground">
        Gift adjust, paid-check reopen, and tender-swap stay manager-only unless you grant them to a
        shift-lead role. No-sale, blind count, over/short $X, and closeout-before-clock-out stay on
        Cash drawers. Outliers and break-glass queue for review — they are never an automatic
        accusation.
      </p>
    </div>
  );
}

function ShiftLeadEditor({
  grants,
  disabled,
  onChange,
}: {
  grants: ShiftLeadGrant[];
  disabled: boolean;
  onChange: (g: ShiftLeadGrant[]) => void;
}) {
  const used = new Set(grants.map((g) => g.role));
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Shift-lead roles
      </p>
      {grants.map((g, i) => (
        <div key={g.role} className="space-y-1 rounded-lg bg-bg p-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm">{ROLE_LABEL[g.role]}</span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                cap $
                <input
                  type="number"
                  min={0}
                  disabled={disabled}
                  className="h-8 w-20 rounded-md border border-border bg-surface px-2"
                  value={(g.maxCents / 100).toFixed(0)}
                  onChange={(e) => {
                    const next = [...grants];
                    next[i] = { ...g, maxCents: Math.max(0, Math.round((Number(e.target.value) || 0) * 100)) };
                    onChange(next);
                  }}
                />
              </label>
              {!disabled && (
                <Button size="sm" variant="ghost" className="h-7" onClick={() => onChange(grants.filter((_, j) => j !== i))}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {APPROVAL_GATES.map((k) => (
              <label key={k} className="flex items-center gap-1 text-[11px]">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border"
                  disabled={disabled}
                  checked={g.gates.includes(k)}
                  onChange={(e) => {
                    const gates = e.target.checked
                      ? [...g.gates, k]
                      : g.gates.filter((x) => x !== k);
                    const next = [...grants];
                    next[i] = { ...g, gates: gates.length ? gates : [...DEFAULT_SHIFT_LEAD_GATES] };
                    onChange(next);
                  }}
                />
                {k.replace("_", " ")}
              </label>
            ))}
          </div>
        </div>
      ))}
      {!disabled && (
        <select
          className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
          value=""
          onChange={(e) => {
            const role = e.target.value as EmployeeRole;
            if (!role || used.has(role)) return;
            onChange([
              ...grants,
              { role, gates: [...DEFAULT_SHIFT_LEAD_GATES], maxCents: 2000 },
            ]);
          }}
        >
          <option value="">Add shift-lead role…</option>
          {SHIFT_LEAD_ROLES.filter((r) => !used.has(r)).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function OnCallEditor({
  list,
  disabled,
  onChange,
}: {
  list: { employeeId: string; phone: string }[];
  disabled: boolean;
  onChange: (l: { employeeId: string; phone: string }[]) => void;
}) {
  const employees = usePosStore((s) => s.employees.filter((e) => e.active));
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        On-call list
      </p>
      {list.map((c, i) => (
        <div key={`${c.employeeId}-${i}`} className="flex flex-wrap items-center gap-2">
          <select
            disabled={disabled}
            className="h-9 min-w-[8rem] flex-1 rounded-md border border-border bg-bg px-2 text-sm"
            value={c.employeeId}
            onChange={(e) => {
              const next = [...list];
              next[i] = { ...c, employeeId: e.target.value };
              onChange(next);
            }}
          >
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} · {ROLE_LABEL[e.role]}
              </option>
            ))}
          </select>
          <Input
            disabled={disabled}
            className="h-9 w-36"
            placeholder="SMS number"
            value={c.phone}
            onChange={(e) => {
              const next = [...list];
              next[i] = { ...c, phone: e.target.value.replace(/[^\d+]/g, "").slice(0, 20) };
              onChange(next);
            }}
          />
          {!disabled && (
            <Button size="sm" variant="ghost" onClick={() => onChange(list.filter((_, j) => j !== i))}>
              Remove
            </Button>
          )}
        </div>
      ))}
      {!disabled && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const first = employees.find((e) => e.role === "manager" || e.role === "owner") ?? employees[0];
            if (!first) return;
            onChange([...list, { employeeId: first.id, phone: "" }]);
          }}
        >
          Add on-call
        </Button>
      )}
    </div>
  );
}

function Gate({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: GateMode;
  disabled: boolean;
  onChange: (v: GateMode) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <select
        disabled={disabled}
        className="h-9 rounded-md border border-border bg-bg px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as GateMode)}
      >
        <option value="manager">Manager PIN + reason</option>
        <option value="off">Log only</option>
      </select>
    </label>
  );
}

function Num({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled: boolean;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        disabled={disabled}
        className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
