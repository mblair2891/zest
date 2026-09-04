import { usePosStore } from "@/lib/pos/store";
import {
  DEFAULT_FLOOR_COLORS,
  DEFAULT_FLASH_MINUTES,
  FLOOR_PIPELINE,
  FLOOR_STATUS_LABEL,
  parseFloorStatusConfig,
  type FloorPipelineStatus,
} from "@/lib/pos/floor-status";
import { parseQrMode } from "@/lib/pos/qr-table";
import {
  DEFAULT_QR_POLICY,
  QR_AFTER_PAY_LABEL,
  QR_FLAG_LABEL,
  QR_MODE_FLAGS,
  QR_ORDER_ALLOW_LABEL,
  QR_PAY_ALLOW_LABEL,
  QR_SPLIT_LABEL,
  legacyModeFromFlags,
  parseQrPolicy,
  type QrAfterPay,
  type QrModeFlag,
  type QrOrderAllow,
  type QrPayAllow,
  type QrSplitMode,
} from "@/lib/pos/qr-policy";
import type { EmployeeRole } from "@/lib/pos/types";
import { ROLE_LABEL } from "@/lib/pos/rbac";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { persistQrPolicy } from "@/lib/pos/persist-location-setup";

const STATUS_ROLES: EmployeeRole[] = [
  "owner",
  "manager",
  "host",
  "server",
  "busser",
  "bartender",
];

export function FloorQrSettings({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const cfg = parseFloorStatusConfig(settings.floorStatusConfig);
  const qrMode = parseQrMode(settings.qrMode);
  const qrPolicy = parseQrPolicy(settings.qrPolicy, settings.qrMode);

  const savePolicy = (next: Partial<typeof qrPolicy>) => {
    const flags = next.flags ?? qrPolicy.flags;
    const policy = { ...qrPolicy, ...next, flags };
    updateSettings({
      qrPolicy: policy,
      qrMode: legacyModeFromFlags(policy.flags),
    });
    persistQrPolicy();
  };

  const patchCfg = (next: Partial<typeof cfg>) => {
    updateSettings({ floorStatusConfig: { ...cfg, ...next } });
  };

  return (
    <div className="space-y-5" data-demo="floor-qr-settings">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Color-coded floor statuses, optional flash SLAs, and how table QR
          behaves for guests. Layout is drawn in Floor editor.
        </p>
        <GuideLearnLink topicId="floor-status" compact>
          Learn
        </GuideLearnLink>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          QR modes (combinable)
        </p>
        <div className="grid gap-2">
          {QR_MODE_FLAGS.map((flag) => (
            <label
              key={flag}
              className="flex items-start gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                disabled={!write}
                checked={qrPolicy.flags.includes(flag)}
                onChange={(e) => {
                  const flags = e.target.checked
                    ? [...new Set([...qrPolicy.flags, flag])]
                    : qrPolicy.flags.filter((f) => f !== flag);
                  savePolicy({ flags: flags.length ? flags : (["pay_only"] as QrModeFlag[]) });
                }}
              />
              <span>
                <span className="font-medium">{flag.replaceAll("_", " ")}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {QR_FLAG_LABEL[flag]}
                </span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Legacy shorthand: {qrMode}. Reorder-after-open never silently starts a new check.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          QR may order
          <select
            disabled={!write}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
            value={qrPolicy.orderAllow}
            onChange={(e) => savePolicy({ orderAllow: e.target.value as QrOrderAllow })}
          >
            {(Object.keys(QR_ORDER_ALLOW_LABEL) as QrOrderAllow[]).map((k) => (
              <option key={k} value={k}>
                {QR_ORDER_ALLOW_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          QR may pay
          <select
            disabled={!write}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
            value={qrPolicy.payAllow}
            onChange={(e) => savePolicy({ payAllow: e.target.value as QrPayAllow })}
          >
            {(Object.keys(QR_PAY_ALLOW_LABEL) as QrPayAllow[]).map((k) => (
              <option key={k} value={k}>
                {QR_PAY_ALLOW_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          Guest split
          <select
            disabled={!write}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
            value={qrPolicy.split}
            onChange={(e) => savePolicy({ split: e.target.value as QrSplitMode })}
          >
            {(Object.keys(QR_SPLIT_LABEL) as QrSplitMode[]).map((k) => (
              <option key={k} value={k}>
                {QR_SPLIT_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-muted-foreground">
          After pay
          <select
            disabled={!write}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm text-foreground"
            value={qrPolicy.afterPay}
            onChange={(e) => savePolicy({ afterPay: e.target.value as QrAfterPay })}
          >
            {(Object.keys(QR_AFTER_PAY_LABEL) as QrAfterPay[]).map((k) => (
              <option key={k} value={k}>
                {QR_AFTER_PAY_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            disabled={!write}
            checked={qrPolicy.tip}
            onChange={(e) => savePolicy({ tip: e.target.checked })}
          />
          <span>
            Tip on QR pay
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Guest sees tip chips before charging Quantum Payments.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border"
            disabled={!write}
            checked={qrPolicy.alcoholAgeAffirm}
            onChange={(e) => savePolicy({ alcoholAgeAffirm: e.target.checked })}
          />
          <span>
            Age affirm when drinks are on the QR menu
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Guest taps “I am of legal drinking age” before drink items show.
            </span>
          </span>
        </label>
        <label className="block text-xs text-muted-foreground sm:col-span-2">
          Ticket QR lifetime (minutes)
          <Input
            className="mt-1 h-10 w-28"
            type="number"
            min={1}
            max={1440}
            disabled={!write}
            value={Math.round(qrPolicy.ticketQrTtlSec / 60)}
            onChange={(e) =>
              savePolicy({
                ticketQrTtlSec: Math.max(1, Number(e.target.value) || 15) * 60,
              })
            }
          />
          <span className="mt-1 block text-[11px]">
            Signed check QR. Reprinted checks mint a fresh code. Default {DEFAULT_QR_POLICY.ticketQrTtlSec / 60} min.
          </span>
        </label>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Who may seat
        </p>
        <select
          disabled={!write}
          className="h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
          value={cfg.seatingRole}
          onChange={(e) =>
            patchCfg({
              seatingRole: e.target.value as typeof cfg.seatingRole,
            })
          }
        >
          <option value="host_or_manager">Host stand, manager, or server</option>
          <option value="host">Host stand (and managers)</option>
          <option value="manager">Manager / owner only</option>
        </select>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Who may change status
        </p>
        <div className="flex flex-wrap gap-3">
          {STATUS_ROLES.map((role) => (
            <label key={role} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                disabled={!write}
                checked={cfg.changeRoles.includes(role)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? Array.from(new Set([...cfg.changeRoles, role]))
                    : cfg.changeRoles.filter((r) => r !== role);
                  patchCfg({ changeRoles: next });
                }}
              />
              {ROLE_LABEL[role]}
            </label>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="pb-2 pr-2 font-medium">Status</th>
              <th className="pb-2 pr-2 font-medium">On</th>
              <th className="pb-2 pr-2 font-medium">Color</th>
              <th className="pb-2 font-medium">Flash after (min)</th>
            </tr>
          </thead>
          <tbody>
            {FLOOR_PIPELINE.map((st: FloorPipelineStatus) => (
              <tr key={st} className="border-t border-border">
                <td className="py-2 pr-2">{FLOOR_STATUS_LABEL[st]}</td>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border"
                    disabled={!write || st === "empty"}
                    checked={cfg.enabled[st] !== false}
                    onChange={(e) =>
                      patchCfg({
                        enabled: { ...cfg.enabled, [st]: e.target.checked },
                      })
                    }
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="color"
                    disabled={!write}
                    value={cfg.colors[st]}
                    onChange={(e) =>
                      patchCfg({
                        colors: { ...cfg.colors, [st]: e.target.value },
                      })
                    }
                    className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent p-0"
                  />
                </td>
                <td className="py-2">
                  <Input
                    className="h-8 w-24"
                    inputMode="decimal"
                    disabled={!write || st === "empty"}
                    placeholder="off"
                    value={cfg.flashMinutes[st] ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      const v =
                        raw === "" ? null : Number(raw);
                      patchCfg({
                        flashMinutes: {
                          ...cfg.flashMinutes,
                          [st]: v == null || Number.isNaN(v) ? null : v,
                        },
                      });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={!write}
          onClick={() =>
            patchCfg({
              colors: { ...DEFAULT_FLOOR_COLORS },
              flashMinutes: { ...DEFAULT_FLASH_MINUTES },
            })
          }
        >
          Reset colors &amp; SLAs
        </Button>
        <p className="self-center text-[11px] text-muted-foreground">
          Demo houses use sub-minute flash so you can watch a pulse without waiting.
        </p>
      </div>
    </div>
  );
}
