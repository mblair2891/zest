import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  STAFFING_DAYPARTS,
  STAFFING_NOTIFY,
  STAFFING_ROLES,
  type StaffingNotifyRole,
  type StaffingRecsConfig,
} from "@/lib/ops-ai/staffing";
import type { EmployeeRole } from "@/lib/pos/types";

export function StaffingRecsSettings({
  cfg,
  write,
  onChange,
}: {
  cfg: StaffingRecsConfig;
  write: boolean;
  onChange: (next: StaffingRecsConfig) => void;
}) {
  const patch = (p: Partial<StaffingRecsConfig>) => {
    if (!write) return;
    onChange({ ...cfg, ...p });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold">Realtime staffing recommendations</p>
        <GuideLearnLink topicId="staffing-recs" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Cut / hold / add only. Never auto clock-out. Manager decides.
      </p>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          disabled={!write}
          checked={cfg.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
        />
        Staffing recs on
      </label>
      <p className="text-[11px] font-medium text-muted-foreground">Min headcount per role</p>
      <div className="grid grid-cols-2 gap-2">
        {STAFFING_ROLES.map((role) => (
          <label key={role} className="text-[11px] text-muted-foreground">
            {role}
            <Input
              className="mt-1 h-8"
              disabled={!write}
              inputMode="numeric"
              value={String(cfg.minHeadcount[role] ?? 0)}
              onChange={(e) =>
                patch({
                  minHeadcount: {
                    ...cfg.minHeadcount,
                    [role]: Math.max(0, parseInt(e.target.value, 10) || 0),
                  },
                })
              }
            />
          </label>
        ))}
      </div>
      <label className="block text-xs text-muted-foreground">
        Labor % target
        <Input
          className="mt-1"
          disabled={!write}
          inputMode="decimal"
          value={String(cfg.laborPctTarget)}
          onChange={(e) => patch({ laborPctTarget: Math.max(1, parseFloat(e.target.value) || 0) })}
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Labor % high alert
        <Input
          className="mt-1"
          disabled={!write}
          inputMode="decimal"
          value={String(cfg.laborPctHighAlert)}
          onChange={(e) => patch({ laborPctHighAlert: Math.max(1, parseFloat(e.target.value) || 0) })}
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Sales per labor-hour floor ($)
        <Input
          className="mt-1"
          disabled={!write}
          inputMode="decimal"
          value={(cfg.salesPerLaborHourFloorCents / 100).toFixed(0)}
          onChange={(e) =>
            patch({
              salesPerLaborHourFloorCents: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100)),
            })
          }
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        Idle minutes with no tables/tickets before a cut rec
        <Input
          className="mt-1"
          disabled={!write}
          inputMode="numeric"
          value={String(cfg.idleMinutesBeforeCut)}
          onChange={(e) => patch({ idleMinutesBeforeCut: Math.max(0, parseInt(e.target.value, 10) || 0) })}
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          No-cut after open (min)
          <Input
            className="mt-1"
            disabled={!write}
            value={String(cfg.noCutOpenPaddingMinutes)}
            onChange={(e) =>
              patch({ noCutOpenPaddingMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
          />
        </label>
        <label className="text-xs text-muted-foreground">
          No-cut before close (min)
          <Input
            className="mt-1"
            disabled={!write}
            value={String(cfg.noCutClosePaddingMinutes)}
            onChange={(e) =>
              patch({ noCutClosePaddingMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
          />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Open (HH:mm)
          <Input
            className="mt-1"
            disabled={!write}
            value={cfg.openTime}
            onChange={(e) => patch({ openTime: e.target.value })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Close (HH:mm)
          <Input
            className="mt-1"
            disabled={!write}
            value={cfg.closeTime}
            onChange={(e) => patch({ closeTime: e.target.value })}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">Rush lock (no cuts) by daypart</p>
      <div className="flex flex-wrap gap-2">
        {STAFFING_DAYPARTS.map((d) => (
          <label key={d} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              disabled={!write}
              checked={cfg.rushLockDayparts.includes(d)}
              onChange={(e) =>
                patch({
                  rushLockDayparts: e.target.checked
                    ? [...cfg.rushLockDayparts, d]
                    : cfg.rushLockDayparts.filter((x) => x !== d),
                })
              }
            />
            {d}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">
          Typical turn (min)
          <Input
            className="mt-1"
            disabled={!write}
            value={String(cfg.typicalTurnMinutes)}
            onChange={(e) => patch({ typicalTurnMinutes: Math.max(15, parseInt(e.target.value, 10) || 75) })}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          Lookahead (min)
          <Input
            className="mt-1"
            disabled={!write}
            value={String(cfg.lookaheadMinutes)}
            onChange={(e) => patch({ lookaheadMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          />
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">Notify roles</p>
      <div className="flex flex-wrap gap-2">
        {STAFFING_NOTIFY.map((r) => (
          <label key={r} className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              disabled={!write}
              checked={cfg.notifyRoles.includes(r)}
              onChange={(e) =>
                patch({
                  notifyRoles: e.target.checked
                    ? [...cfg.notifyRoles, r]
                    : cfg.notifyRoles.filter((x) => x !== r),
                })
              }
            />
            {r}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          disabled={!write}
          checked={cfg.recommendAdd}
          onChange={(e) => patch({ recommendAdd: e.target.checked })}
        />
        Also recommend ADD staff when queue/wait exceeds thresholds
      </label>
      {cfg.recommendAdd && (
        <div className="grid grid-cols-3 gap-2">
          <label className="text-[11px] text-muted-foreground">
            Waitlist #
            <Input
              className="mt-1 h-8"
              disabled={!write}
              value={String(cfg.addWaitlistThreshold)}
              onChange={(e) =>
                patch({ addWaitlistThreshold: Math.max(1, parseInt(e.target.value, 10) || 1) })
              }
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Quoted wait
            <Input
              className="mt-1 h-8"
              disabled={!write}
              value={String(cfg.addQuotedWaitMinutes)}
              onChange={(e) =>
                patch({ addQuotedWaitMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
            />
          </label>
          <label className="text-[11px] text-muted-foreground">
            ODS depth
            <Input
              className="mt-1 h-8"
              disabled={!write}
              value={String(cfg.addOdsDepth)}
              onChange={(e) => patch({ addOdsDepth: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

export type { EmployeeRole, StaffingNotifyRole };
