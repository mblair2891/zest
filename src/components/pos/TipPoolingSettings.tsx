import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import type { EmployeeRole } from "@/lib/pos/types";
import {
  AUTOGRAT_DESTS,
  BAR_POOL_SCOPES,
  DEFAULT_ROLE_POINTS,
  includeRolesForMode,
  POOL_CONTRIBUTIONS,
  POOL_SETTLES,
  POOL_SPLITS,
  SERVICE_CHARGE_DESTS,
  TIP_POOL_MODE_BLURB,
  TIP_POOL_MODE_LABEL,
  TIP_POOL_MODES,
  TIP_POOL_STAFF_ROLES,
  type AutogratDest,
  type BarPoolScope,
  type PoolContribution,
  type PoolSettle,
  type PoolSplit,
  type ServiceChargeDest,
  type TipPoolMode,
  type TipPoolingConfig,
} from "@/lib/pos/tip-pooling";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

const CONTRIB_LABEL: Record<PoolContribution, string> = {
  card_tips: "Card tips",
  cash_declared: "Declared cash tips",
  both: "Card + declared cash",
  percent_of_tips: "% of tips",
  percent_of_sales: "% of sales",
};

const SPLIT_LABEL: Record<PoolSplit, string> = {
  hours: "Hours worked",
  points: "Point table × hours",
  equal: "Equal shares",
  sales: "Sales",
  manual: "Manual at closeout",
};

export function TipPoolingSettings({
  cfg,
  write,
  onChange,
}: {
  cfg: TipPoolingConfig;
  write: boolean;
  onChange: (next: TipPoolingConfig) => void;
}) {
  const patch = (p: Partial<TipPoolingConfig>) => {
    if (!write) return;
    onChange({ ...cfg, ...p });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Tip pooling
        </p>
        <GuideLearnLink topicId="tip-pooling" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pooling rules vary by state. Summex calculates the policy you set — it is not legal advice
        and not a payroll run.
      </p>
      <Field label="Mode" hint={TIP_POOL_MODE_BLURB[cfg.mode]}>
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write}
          value={cfg.mode}
          onChange={(e) => {
            const mode = e.target.value as TipPoolMode;
            patch({ mode, includeRoles: includeRolesForMode(mode) });
          }}
        >
          {TIP_POOL_MODES.map((m) => (
            <option key={m} value={m}>
              {TIP_POOL_MODE_LABEL[m]}
            </option>
          ))}
        </select>
      </Field>
      {cfg.mode === "bar_pool" && (
        <Field label="Bar pool scope">
          <select
            className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
            disabled={!write}
            value={cfg.barPoolScope}
            onChange={(e) => patch({ barPoolScope: e.target.value as BarPoolScope })}
          >
            {BAR_POOL_SCOPES.map((s) => (
              <option key={s} value={s}>
                {s === "all_wells" ? "All wells together" : "Per well"}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label="Pool contribution">
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write}
          value={cfg.contribution}
          onChange={(e) => patch({ contribution: e.target.value as PoolContribution })}
        >
          {POOL_CONTRIBUTIONS.map((c) => (
            <option key={c} value={c}>
              {CONTRIB_LABEL[c]}
            </option>
          ))}
        </select>
      </Field>
      {(cfg.contribution === "percent_of_tips" || cfg.contribution === "percent_of_sales") && (
        <Field label="Contribution percent">
          <Input
            disabled={!write}
            inputMode="decimal"
            value={String(cfg.contributionPercent)}
            onChange={(e) =>
              patch({ contributionPercent: Math.max(0, parseFloat(e.target.value) || 0) })
            }
          />
        </Field>
      )}
      <Field label="Pool split">
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write}
          value={cfg.split}
          onChange={(e) => patch({ split: e.target.value as PoolSplit })}
        >
          {POOL_SPLITS.map((s) => (
            <option key={s} value={s}>
              {SPLIT_LABEL[s]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Settle">
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write}
          value={cfg.settle}
          onChange={(e) => patch({ settle: e.target.value as PoolSettle })}
        >
          {POOL_SETTLES.map((s) => (
            <option key={s} value={s}>
              {s === "end_of_shift" ? "End of shift" : "End of pay period"}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Auto-grat"
        hint="Party-size auto-grat on the check. Split custom uses the percent below."
      >
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write}
          value={cfg.autogratDest}
          onChange={(e) => patch({ autogratDest: e.target.value as AutogratDest })}
        >
          {AUTOGRAT_DESTS.map((d) => (
            <option key={d} value={d}>
              {d === "stays_with_server"
                ? "Stays with the server"
                : d === "enters_pool"
                  ? "Enters the pool"
                  : "Split custom"}
            </option>
          ))}
        </select>
      </Field>
      {cfg.autogratDest === "split_custom" && (
        <Field label="Auto-grat % to pool">
          <Input
            disabled={!write}
            inputMode="decimal"
            value={String(cfg.autogratPoolPercent)}
            onChange={(e) =>
              patch({ autogratPoolPercent: Math.max(0, parseFloat(e.target.value) || 0) })
            }
          />
        </Field>
      )}
      <Field
        label="Service charge"
        hint="Never labeled a tip unless you check treat as tip."
      >
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write}
          value={cfg.serviceChargeDest}
          onChange={(e) => patch({ serviceChargeDest: e.target.value as ServiceChargeDest })}
        >
          {SERVICE_CHARGE_DESTS.map((d) => (
            <option key={d} value={d}>
              {d === "house" ? "House (not a tip)" : "% to staff pool"}
            </option>
          ))}
        </select>
      </Field>
      {cfg.serviceChargeDest === "percent_to_staff_pool" && (
        <>
          <Field label="Service charge % to staff pool">
            <Input
              disabled={!write}
              inputMode="decimal"
              value={String(cfg.serviceChargeToPoolPercent)}
              onChange={(e) =>
                patch({
                  serviceChargeToPoolPercent: Math.max(0, parseFloat(e.target.value) || 0),
                })
              }
            />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              disabled={!write}
              checked={cfg.serviceChargeTreatAsTip}
              onChange={(e) => patch({ serviceChargeTreatAsTip: e.target.checked })}
            />
            <span>Treat pool share as a tip (otherwise it stays a service charge)</span>
          </label>
        </>
      )}
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.excludeManagers}
          onChange={(e) => patch({ excludeManagers: e.target.checked })}
        />
        <span>Exclude managers and owners from the pool (default on)</span>
      </label>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Include roles</p>
        <div className="flex flex-wrap gap-2">
          {TIP_POOL_STAFF_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                disabled={!write}
                checked={cfg.includeRoles.includes(role)}
                onChange={(e) => {
                  const includeRoles = e.target.checked
                    ? [...cfg.includeRoles, role]
                    : cfg.includeRoles.filter((r) => r !== role);
                  patch({ includeRoles });
                }}
              />
              {role}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Point table (per role)</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {TIP_POOL_STAFF_ROLES.map((role) => (
            <li key={role} className="flex items-center gap-2">
              <span className="w-24 text-xs">{role}</span>
              <Input
                disabled={!write}
                inputMode="decimal"
                value={String(cfg.rolePoints[role] ?? DEFAULT_ROLE_POINTS[role] ?? 0)}
                onChange={(e) =>
                  patch({
                    rolePoints: {
                      ...cfg.rolePoints,
                      [role]: Math.max(0, parseFloat(e.target.value) || 0),
                    },
                  })
                }
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
