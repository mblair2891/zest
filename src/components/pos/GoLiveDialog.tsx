import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLifecycleStore } from "@/lib/lifecycle/store";
import { saveLifecycleFn } from "@/lib/lifecycle/api";
import {
  DEFAULT_GO_LIVE_CHOICES,
  KEEP_ERASE_KEYS,
  KEEP_ERASE_LABEL,
  type KeepEraseChoice,
  type KeepEraseKey,
  type KeepEraseMap,
} from "@/lib/lifecycle/types";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { isProspectDemo } from "@/lib/demo/session";
import { formatDateTime } from "@/lib/utils";

export function GoLivePanel() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const status = useLifecycleStore((s) => s.status);
  const schedule = useLifecycleStore((s) => s.schedule);
  const cancel = useLifecycleStore((s) => s.cancelSchedule);
  const fire = useLifecycleStore((s) => s.fireScheduleIfDue);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  if (emp?.role !== "owner") return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="text-sm font-semibold">Go live</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Status: <strong className="capitalize">{status.replace("_", " ")}</strong>
        {schedule ? ` · scheduled ${formatDateTime(schedule.at)}` : ""}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Training uses Quantum Payments sandbox. Live cards only after go-live.
        Menus, recipes, floorplan, staff, devices, and SKU catalog always stay.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            setMode("now");
            setOpen(true);
          }}
        >
          Go live now
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setMode("schedule");
            setOpen(true);
          }}
        >
          Schedule go live
        </Button>
        {status === "scheduled_live" && (
          <>
            <Button size="sm" variant="outline" onClick={() => cancel()}>
              Cancel schedule
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fire(Date.now() + 1)}>
              Run scheduled job now
            </Button>
          </>
        )}
      </div>
      <GoLiveDialog open={open} onOpenChange={setOpen} mode={mode} />
    </section>
  );
}

function GoLiveDialog({
  open,
  onOpenChange,
  mode,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "now" | "schedule";
}) {
  const goLiveNow = useLifecycleStore((s) => s.goLiveNow);
  const scheduleGoLive = useLifecycleStore((s) => s.scheduleGoLive);
  const [choices, setChoices] = useState<KeepEraseMap>({ ...DEFAULT_GO_LIVE_CHOICES });
  const [confirm, setConfirm] = useState("");
  const [when, setWhen] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";

  const persist = (status: string, extra?: { goLiveAt?: string | null }) => {
    if (isProspectDemo() || !orgId || !locId) return;
    void saveLifecycleFn({
      data: {
        orgId,
        locationId: locId,
        lifecycleStatus: status,
        goLiveChoices: choices,
        goLiveAt: extra?.goLiveAt ?? null,
      },
    }).catch(() => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="w-[min(100vw-1.25rem,32rem)]">
        <DialogHeader>
          <DialogTitle>{mode === "now" ? "Go live now" : "Schedule go live"}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Practice data can be erased. Configuration (menu, recipes, floor, staff, devices,
          SKUs, suppliers, settings) is always kept.
        </p>
        <ul className="space-y-2">
          {KEEP_ERASE_KEYS.map((k: KeepEraseKey) => (
            <li key={k} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 text-xs">{KEEP_ERASE_LABEL[k]}</span>
              <select
                className="h-9 rounded-lg border border-border bg-bg px-2 text-xs"
                value={choices[k]}
                onChange={(e) =>
                  setChoices((c) => ({
                    ...c,
                    [k]: e.target.value as KeepEraseChoice,
                  }))
                }
              >
                <option value="erase">Erase</option>
                <option value="keep">Keep</option>
              </select>
            </li>
          ))}
        </ul>
        {mode === "schedule" && (
          <label className="text-xs text-muted-foreground">
            Date and time (this location)
            <Input
              type="datetime-local"
              className="mt-1"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
        )}
        {mode === "now" && (
          <label className="text-xs text-muted-foreground">
            Type GO LIVE NOW
            <Input
              className="mt-1"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="GO LIVE NOW"
            />
          </label>
        )}
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button
          onClick={() => {
            setErr(null);
            if (mode === "now") {
              const r = goLiveNow({ confirm, choices });
              if (!r.ok) {
                setErr(r.error ?? "Failed");
                return;
              }
              persist("live");
              onOpenChange(false);
              return;
            }
            const at = when ? Date.parse(when) : NaN;
            const r = scheduleGoLive(at, choices);
            if (!r.ok) {
              setErr(r.error ?? "Failed");
              return;
            }
            persist("scheduled_live", { goLiveAt: new Date(at).toISOString() });
            onOpenChange(false);
          }}
        >
          {mode === "now" ? "Confirm go live" : "Save schedule"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
