import { usePosStore } from "@/lib/pos/store";
import {
  DEFAULT_DISCOUNT_CAPS,
  parseLossPrevention,
  type DiscountCap,
  type GateMode,
} from "@/lib/pos/loss-prevention";
import type { EmployeeRole } from "@/lib/pos/types";
import { ROLE_LABEL } from "@/lib/pos/rbac";

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
        label="Flag vs house when ≥ this × house rate"
        value={cfg.outlierMultiplier}
        min={1.5}
        max={10}
        step={0.5}
        disabled={!write}
        onChange={(n) => patch({ outlierMultiplier: n })}
      />
      <p className="text-xs text-muted-foreground">
        No-sale, blind count, over/short $X, and closeout-before-clock-out stay on Cash drawers.
        Outliers queue for review — they are never an automatic accusation.
      </p>
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
