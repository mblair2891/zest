import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { persistCashHandling } from "@/lib/pos/persist-location-setup";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import {
  CASH_MODEL_BLURB,
  CASH_MODEL_LABEL,
  CASH_MODELS,
  DEFAULT_CASH_HANDLING,
  DRAWER_KIND_LABEL,
  DRAWER_KINDS,
  newDrawerId,
  parseCashHandling,
  type CashHandlingConfig,
  type CashModel,
  type CashSinkKind,
  type DrawerKind,
  type OpenOnCashSale,
  type NoSaleOpen,
  type IssueBankWhen,
} from "@/lib/pos/cash-handling";
import type { DeviceRole } from "@/lib/pos/device-roles";
import { DEVICE_ROLE_LABEL } from "@/lib/pos/device-roles";

function save(next: CashHandlingConfig) {
  usePosStore.getState().updateSettings({ cashHandling: next });
  persistCashHandling();
}

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

export function CashHandlingSettings({ write }: { write: boolean }) {
  const settings = usePosStore((s) => s.settings);
  const employees = usePosStore((s) => s.employees);
  const devices = usePosStore((s) => s.locationDevices ?? []);
  const cfg = parseCashHandling(settings.cashHandling);
  const printers = devices.filter((d) => d.type === "printer" && d.status !== "inactive");
  const stations = devices.filter(
    (d) => d.type === "tablet_pos" || d.type === "host_stand" || d.type === "other",
  );
  const staff = employees.filter((e) => e.active);

  const patch = (p: Partial<CashHandlingConfig>) => {
    if (!write) return;
    save({ ...cfg, ...p });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Cash handling</p>
        <GuideLearnLink topicId="cash-handling" compact>
          Learn
        </GuideLearnLink>
      </div>
      <p className="text-xs text-muted-foreground">
        Location default plus per-station override. Mix models — host drawer for to-go, floor
        server banks, one drawer per bar well. No JSON.
      </p>

      <Field label="Location default" hint={CASH_MODEL_BLURB[cfg.defaultModel]}>
        <select
          className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
          disabled={!write}
          value={cfg.defaultModel}
          onChange={(e) => {
            const defaultModel = e.target.value as CashModel;
            const roleOverride = { ...cfg.roleOverride };
            if (defaultModel === "well_plus_server_bank") {
              roleOverride.host = "single_user_drawer";
              roleOverride.order = "server_bank";
              roleOverride.ods = "cash_disabled";
            }
            patch({ defaultModel, roleOverride });
          }}
        >
          {CASH_MODELS.map((m) => (
            <option key={m} value={m}>
              {CASH_MODEL_LABEL[m]}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-2 sm:grid-cols-3">
        {(["order", "host", "ods"] as DeviceRole[]).map((role) => (
          <Field key={role} label={`${DEVICE_ROLE_LABEL[role]} station`}>
            <select
              className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
              disabled={!write}
              value={cfg.roleOverride[role] ?? ""}
              onChange={(e) => {
                const v = e.target.value as CashModel | "";
                const roleOverride = { ...cfg.roleOverride };
                if (!v) delete roleOverride[role];
                else roleOverride[role] = v;
                patch({ roleOverride });
              }}
            >
              <option value="">Use location default</option>
              {CASH_MODELS.map((m) => (
                <option key={m} value={m}>
                  {CASH_MODEL_LABEL[m]}
                </option>
              ))}
            </select>
          </Field>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Named drawers / wells
        </p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Large bar: one drawer per well that takes cash. Well-2 must not kick Well-1.
        </p>
        <ul className="space-y-2">
          {cfg.drawers.map((d) => (
            <li key={d.id} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-2">
              <Input
                disabled={!write}
                value={d.name}
                onChange={(e) =>
                  patch({
                    drawers: cfg.drawers.map((x) =>
                      x.id === d.id ? { ...x, name: e.target.value.slice(0, 40) } : x,
                    ),
                  })
                }
              />
              <select
                className="h-9 rounded-lg border border-border bg-bg px-2 text-sm"
                disabled={!write}
                value={d.kind}
                onChange={(e) =>
                  patch({
                    drawers: cfg.drawers.map((x) =>
                      x.id === d.id ? { ...x, kind: e.target.value as DrawerKind } : x,
                    ),
                  })
                }
              >
                {DRAWER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {DRAWER_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <Field label="Kick printer">
                <select
                  className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
                  disabled={!write}
                  value={d.kickPrinterId ?? ""}
                  onChange={(e) =>
                    patch({
                      drawers: cfg.drawers.map((x) =>
                        x.id === d.id ? { ...x, kickPrinterId: e.target.value || null } : x,
                      ),
                    })
                  }
                >
                  <option value="">None (no kick)</option>
                  {printers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Starting bank ($)">
                <Input
                  disabled={!write}
                  inputMode="decimal"
                  value={(d.startingBankCents / 100).toFixed(2)}
                  onChange={(e) => {
                    const cents = Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100));
                    patch({
                      drawers: cfg.drawers.map((x) =>
                        x.id === d.id ? { ...x, startingBankCents: Number.isFinite(cents) ? cents : 0 } : x,
                      ),
                    });
                  }}
                />
              </Field>
              <Field label="Assigned users">
                <select
                  multiple
                  className="min-h-16 w-full rounded-lg border border-border bg-bg px-2 py-1 text-sm"
                  disabled={!write}
                  value={d.assignedEmployeeIds}
                  onChange={(e) => {
                    const ids = Array.from(e.target.selectedOptions).map((o) => o.value);
                    patch({
                      drawers: cfg.drawers.map((x) =>
                        x.id === d.id ? { ...x, assignedEmployeeIds: ids } : x,
                      ),
                    });
                  }}
                >
                  {staff.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} · {e.role}
                    </option>
                  ))}
                </select>
              </Field>
              {write && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => patch({ drawers: cfg.drawers.filter((x) => x.id !== d.id) })}
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
        {write && (
          <Button
            size="sm"
            className="mt-2"
            variant="outline"
            onClick={() =>
              patch({
                drawers: [
                  ...cfg.drawers,
                  {
                    id: newDrawerId(),
                    name: `Drawer ${cfg.drawers.length + 1}`,
                    kind: "well",
                    kickPrinterId: null,
                    startingBankCents: 20000,
                    assignedEmployeeIds: [],
                  },
                ],
              })
            }
          >
            Add drawer / well
          </Button>
        )}
      </div>

      {stations.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Registered device assignment
          </p>
          <ul className="space-y-2">
            {stations.map((st) => (
              <li key={st.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="min-w-32 truncate">{st.label}</span>
                <select
                  className="h-9 flex-1 rounded-lg border border-border bg-bg px-2 text-sm"
                  disabled={!write}
                  value={cfg.deviceAssignment[st.id] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as CashSinkKind | "";
                    const deviceAssignment = { ...cfg.deviceAssignment };
                    if (!v) delete deviceAssignment[st.id];
                    else deviceAssignment[st.id] = v;
                    patch({ deviceAssignment });
                  }}
                >
                  <option value="">Use station role / location default</option>
                  <option value="none">None (no cash)</option>
                  <option value="server_bank">Server bank</option>
                  {cfg.drawers.map((d) => (
                    <option key={d.id} value={`drawer:${d.id}`}>
                      Drawer: {d.name}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Open drawer on cash sale">
          <select
            className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
            disabled={!write}
            value={cfg.openOnCashSale}
            onChange={(e) => patch({ openOnCashSale: e.target.value as OpenOnCashSale })}
          >
            <option value="always">Always</option>
            <option value="never">Never</option>
            <option value="manager_pin">Manager PIN</option>
          </select>
        </Field>
        <Field label="No-sale open">
          <select
            className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
            disabled={!write}
            value={cfg.noSaleOpen}
            onChange={(e) => patch({ noSaleOpen: e.target.value as NoSaleOpen })}
          >
            <option value="off">Off</option>
            <option value="manager">Manager</option>
            <option value="assigned_user">Assigned user</option>
          </select>
        </Field>
        <Field label="Issue server bank">
          <select
            className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
            disabled={!write}
            value={cfg.issueBank}
            onChange={(e) => patch({ issueBank: e.target.value as IssueBankWhen })}
          >
            <option value="clock_in">At clock-in</option>
            <option value="first_cash_sale">First cash sale</option>
            <option value="manager_issue">Manager issue</option>
          </select>
        </Field>
        <Field label="Server bank starting amount ($)">
          <Input
            disabled={!write}
            inputMode="decimal"
            value={(cfg.serverBankStartingCents / 100).toFixed(2)}
            onChange={(e) =>
              patch({
                serverBankStartingCents: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100) || 0),
              })
            }
          />
        </Field>
        <Field label="Skim / drop required over ($)" hint="0 = no auto skim prompt">
          <Input
            disabled={!write}
            inputMode="decimal"
            value={(cfg.skimOverCents / 100).toFixed(2)}
            onChange={(e) =>
              patch({ skimOverCents: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100) || 0) })
            }
          />
        </Field>
        <Field label="Handheld ringing well tabs">
          <select
            className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
            disabled={!write}
            value={cfg.handheldWellCash}
            onChange={(e) =>
              patch({ handheldWellCash: e.target.value === "server_bank" ? "server_bank" : "well_drawer" })
            }
          >
            <option value="well_drawer">That well’s drawer</option>
            <option value="server_bank">Server bank</option>
          </select>
        </Field>
        <Field label="Table transfer — cash">
          <select
            className="h-9 w-full rounded-lg border border-border bg-bg px-2 text-sm"
            disabled={!write}
            value={cfg.cashFollowsOnTransfer}
            onChange={(e) =>
              patch({
                cashFollowsOnTransfer:
                  e.target.value === "accepting_server" ? "accepting_server" : "original_server",
              })
            }
          >
            <option value="original_server">Stays with original server</option>
            <option value="accepting_server">Follows accepting server</option>
          </select>
        </Field>
        <Field label="Over/short warn over ($)">
          <Input
            disabled={!write}
            inputMode="decimal"
            value={(cfg.overShortWarnCents / 100).toFixed(2)}
            onChange={(e) =>
              patch({
                overShortWarnCents: Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100) || 0),
              })
            }
          />
        </Field>
        <Field label="Over/short require note over ($)">
          <Input
            disabled={!write}
            inputMode="decimal"
            value={(cfg.overShortRequireNoteCents / 100).toFixed(2)}
            onChange={(e) =>
              patch({
                overShortRequireNoteCents: Math.max(
                  0,
                  Math.round(parseFloat(e.target.value || "0") * 100) || 0,
                ),
              })
            }
          />
        </Field>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.blindCount}
          onChange={(e) => patch({ blindCount: e.target.checked })}
        />
        <span>
          Blind count
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Hide expected until counted.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.paidInOutRequireManagerPin}
          onChange={(e) => patch({ paidInOutRequireManagerPin: e.target.checked })}
        />
        <span>Manager PIN for paid-in / paid-out</span>
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-border"
          disabled={!write}
          checked={cfg.requireCountToClockOut}
          onChange={(e) => patch({ requireCountToClockOut: e.target.checked })}
        />
        <span>
          Cannot clock out until bank or assigned drawer is counted
        </span>
      </label>

      <Field label="Paid-in / paid-out reasons" hint="One per line">
        <textarea
          className="min-h-24 w-full rounded-lg border border-border bg-bg p-2 text-sm"
          disabled={!write}
          value={cfg.paidInOutReasons.join("\n")}
          onChange={(e) =>
            patch({
              paidInOutReasons: e.target.value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean)
                .slice(0, 20),
            })
          }
        />
      </Field>
      {write && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => save({ ...DEFAULT_CASH_HANDLING, drawers: cfg.drawers })}
        >
          Reset policies (keep drawers)
        </Button>
      )}
    </div>
  );
}
