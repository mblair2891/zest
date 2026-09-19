import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import {
  UPDATE_NOW_LABEL,
  UPDATE_READY_TITLE,
  REMIND_LATER_LABEL,
  FINISH_CHECK_TOAST,
  applyStationUpdate,
  snoozeStationUpdate,
  useStationRefreshStore,
} from "@/lib/pos/station-refresh";

function runUpdateNow(): void {
  const res = applyStationUpdate();
  if (res.reason === "busy") toast(FINISH_CHECK_TOAST);
}

export function StationUpdateBar() {
  const surface = useStationRefreshStore((s) => s.surface);
  if (surface !== "bar" && surface !== "manager-chip") return null;
  return (
    <div
      data-station-update-bar
      className="flex shrink-0 items-center justify-center gap-3 border-b border-primary/40 bg-primary/10 px-3 py-1.5 text-[11px] font-semibold text-foreground"
      role="status"
    >
      <span>{UPDATE_READY_TITLE}</span>
      <Button
        type="button"
        size="sm"
        className="h-8 px-3"
        data-station-update-now
        onClick={runUpdateNow}
      >
        {UPDATE_NOW_LABEL}
      </Button>
    </div>
  );
}

export function StationUpdateModal() {
  const surface = useStationRefreshStore((s) => s.surface);
  const open = surface === "modal";
  return (
    <Dialog open={open} onOpenChange={() => { /* Update now or Remind me later only */ }}>
      <DialogContent
        className="max-w-sm"
        showClose={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-station-update-modal
      >
        <DialogHeader>
          <DialogTitle>{UPDATE_READY_TITLE}</DialogTitle>
          <DialogDescription>
            Update now loads the new station UI. Remind me later hides this for 10 minutes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="station-touch"
            data-station-remind-later
            onClick={() => snoozeStationUpdate()}
          >
            {REMIND_LATER_LABEL}
          </Button>
          <Button
            type="button"
            size="lg"
            className="station-touch"
            data-station-update-now
            onClick={runUpdateNow}
          >
            {UPDATE_NOW_LABEL}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** PIN pad (no AppShell): modal + bar. Logged-in shell mounts the bar itself. */
export function StationUpdatePrompt() {
  const empId = usePosStore((s) => s.currentEmployeeId);
  return (
    <>
      <StationUpdateModal />
      {!empId ? <StationUpdateBar /> : null}
    </>
  );
}
