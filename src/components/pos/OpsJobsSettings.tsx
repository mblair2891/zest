import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { parseOpsJobsConfig } from "@/lib/ops-jobs/config";
import { JOB_CADENCE_LABEL, JOB_CADENCES, type JobCadence, type OpsJobsConfig, type OpsNotifyRole } from "@/lib/ops-jobs/types";
import { parseLossPrevention } from "@/lib/pos/loss-prevention";
import { parseLaborRules } from "@/lib/labor/rules";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { useCostStore } from "@/lib/costs/store";

const NOTIFY: { id: OpsNotifyRole; label: string }[] = [
  { id: "owner", label: "Owner" },
  { id: "manager", label: "Manager" },
  { id: "host", label: "Host" },
  { id: "accountant", label: "Accountant" },
];

const DAYPARTS = ["morning", "lunch", "afternoon", "dinner", "late"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OpsJobsSettings({ write, persist }: { write: boolean; persist: () => void }) {
  const settings = usePosStore((s) => s.settings);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const cfg = parseOpsJobsConfig(settings.opsJobs);
  const lp = parseLossPrevention(settings.lossPrevention);
  const labor = parseLaborRules(useOpsStore.getState().labor);
  const costSettings = useCostStore((s) => s.settings);

  const patch = (next: Partial<OpsJobsConfig>) => {
    const merged = parseOpsJobsConfig({ ...cfg, ...next });
    updateSettings({ opsJobs: merged });
    persist();
  };

  const patchCadence = (id: JobCadence, field: "enabled" | "hour" | "weekday" | "dayOfMonth", value: number | boolean) => {
    patch({
      cadences: {
        ...cfg.cadences,
        [id]: { ...cfg.cadences[id], [field]: value },
      },
    });
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-sm font-semibold">Scheduled AI ops jobs</h3>
        <GuideLearnLink topicId="ops-jobs" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Hourly while open, then nightly, weekly, pay period, and monthly packs. Real xAI when
        keyed; missing key queues skipped — no invented insights. Never auto clock-out. Never
        invent Quantum/Finix charges. Steam-style bar entities see bar cost/sales; Diamond-style
        food entities see food; host sees the house pack.
      </p>
      <label className="mb-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.enabled}
          disabled={!write}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Jobs enabled
      </label>
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        {JOB_CADENCES.map((id) => {
          const c = cfg.cadences[id];
          return (
            <div key={id} className="rounded-xl border border-border p-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border"
                  checked={c.enabled}
                  disabled={!write}
                  onChange={(e) => patchCadence(id, "enabled", e.target.checked)}
                />
                {JOB_CADENCE_LABEL[id]}
              </label>
              {id !== "service_hourly" && (
                <label className="mt-1 block text-xs text-muted-foreground">
                  Hour
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    disabled={!write}
                    value={c.hour}
                    onChange={(e) => patchCadence(id, "hour", Number(e.target.value))}
                  />
                </label>
              )}
              {id === "weekly" && (
                <label className="mt-1 block text-xs text-muted-foreground">
                  Weekday
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2"
                    disabled={!write}
                    value={c.weekday}
                    onChange={(e) => patchCadence(id, "weekday", Number(e.target.value))}
                  >
                    {WEEKDAYS.map((d, i) => (
                      <option key={d} value={i}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {id === "monthly" && (
                <label className="mt-1 block text-xs text-muted-foreground">
                  Day of month
                  <Input
                    type="number"
                    min={1}
                    max={28}
                    disabled={!write}
                    value={c.dayOfMonth}
                    onChange={(e) => patchCadence(id, "dayOfMonth", Number(e.target.value))}
                  />
                </label>
              )}
            </div>
          );
        })}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Open (hourly while open)
          <Input
            disabled={!write}
            value={cfg.openTime}
            onChange={(e) => patch({ openTime: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Close
          <Input
            disabled={!write}
            value={cfg.closeTime}
            onChange={(e) => patch({ closeTime: e.target.value })}
          />
        </label>
        <label className="text-sm">
          Notify email (Resend → printable pack; else inbox)
          <Input
            type="email"
            disabled={!write}
            value={cfg.notifyEmail}
            placeholder={settings.aiReportEmail || "ops@house.example"}
            onChange={(e) => patch({ notifyEmail: e.target.value })}
          />
        </label>
        <div className="text-sm">
          Notify roles
          <div className="mt-1 flex flex-wrap gap-2">
            {NOTIFY.map((n) => (
              <label key={n.id} className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border"
                  checked={cfg.notifyRoles.includes(n.id)}
                  disabled={!write}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...cfg.notifyRoles, n.id]
                      : cfg.notifyRoles.filter((r) => r !== n.id);
                    patch({ notifyRoles: next });
                  }}
                />
                {n.label}
              </label>
            ))}
          </div>
        </div>
        <label className="text-sm">
          Labor % target
          <Input
            type="number"
            disabled={!write}
            value={cfg.laborPctTarget}
            onChange={(e) => patch({ laborPctTarget: Number(e.target.value) })}
          />
          <span className="text-[11px] text-muted-foreground">
            Staffing recs use {labor.staffingRecs.laborPctTarget}% unless you override here for jobs.
          </span>
        </label>
        <label className="text-sm">
          Min staff (jobs)
          <Input
            type="number"
            disabled={!write}
            value={cfg.minStaff}
            onChange={(e) => patch({ minStaff: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Food cost % target
          <Input
            type="number"
            disabled={!write}
            value={cfg.foodCostTargetPct}
            onChange={(e) => patch({ foodCostTargetPct: Number(e.target.value) })}
          />
          <span className="text-[11px] text-muted-foreground">
            Cost catalog default {costSettings.targetCostPct.food}%.
          </span>
        </label>
        <label className="text-sm">
          Liquor cost % target
          <Input
            type="number"
            disabled={!write}
            value={cfg.liquorCostTargetPct}
            onChange={(e) => patch({ liquorCostTargetPct: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Exception $ (cents)
          <Input
            type="number"
            disabled={!write}
            value={cfg.exceptionDollarCents}
            onChange={(e) => patch({ exceptionDollarCents: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Exception %
          <Input
            type="number"
            disabled={!write}
            value={cfg.exceptionPct}
            onChange={(e) => patch({ exceptionPct: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Exception idle minutes
          <Input
            type="number"
            disabled={!write}
            value={cfg.exceptionIdleMinutes}
            onChange={(e) => patch({ exceptionIdleMinutes: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          House Z / night close
          <select
            className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2"
            disabled={!write}
            value={cfg.houseCloseMode}
            onChange={(e) => {
              const mode = e.target.value === "hard_block" ? "hard_block" : "ack";
              patch({ houseCloseMode: mode });
              updateSettings({
                lossPrevention: { ...lp, nightCloseMode: mode },
              });
              persist();
            }}
          >
            <option value="ack">Manager ack remaining exceptions</option>
            <option value="hard_block">Hard-block until cleared</option>
          </select>
          <span className="text-[11px] text-muted-foreground">
            Same setting as Loss prevention (currently {lp.nightCloseMode}).
          </span>
        </label>
      </div>
      <p className="mt-3 text-xs font-medium">Rush-lock windows (jobs + staffing)</p>
      <div className="mt-1 flex flex-wrap gap-2">
        {DAYPARTS.map((d) => (
          <label key={d} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-border"
              checked={cfg.rushLockDayparts.includes(d)}
              disabled={!write}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...cfg.rushLockDayparts, d]
                  : cfg.rushLockDayparts.filter((x) => x !== d);
                patch({ rushLockDayparts: next });
              }}
            />
            {d}
          </label>
        ))}
      </div>
      <p className="mt-3 text-xs font-medium">Theoretical use (recipes × net sales)</p>
      <label className="mt-1 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.theoreticalIncludeVoids}
          disabled={!write}
          onChange={(e) => {
            patch({ theoreticalIncludeVoids: e.target.checked });
            useCostStore.setState({
              settings: {
                ...useCostStore.getState().settings,
                theoreticalIncludeVoids: e.target.checked,
              },
            });
          }}
        />
        Include voids in theoretical use (default off)
      </label>
      <label className="mt-1 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={cfg.theoreticalIncludeComps}
          disabled={!write}
          onChange={(e) => {
            patch({ theoreticalIncludeComps: e.target.checked });
            useCostStore.setState({
              settings: {
                ...useCostStore.getState().settings,
                theoreticalIncludeComps: e.target.checked,
              },
            });
          }}
        />
        Include comps in theoretical use (default on — product left the well)
      </label>
    </div>
  );
}
