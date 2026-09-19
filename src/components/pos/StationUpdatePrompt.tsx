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
  UPDATE_REQUIRED_TITLE,
  REMIND_LATER_LABEL,
  FINISH_CHECK_TOAST,
  applyStationUpdate,
  snoozeStationUpdate,
  readVenueUpdatePolicy,
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
  const forced = surface === "forced";
  const open = surface === "modal" || forced;
  const bullets = open ? readVenueUpdatePolicy().bullets : [];
  return (
    <Dialog open={open} onOpenChange={() => { /* Update now or Remind me later only */ }}>
      <DialogContent
        className="max-w-sm"
        showClose={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        data-station-update-modal
        data-station-update-required={forced ? "1" : undefined}
      >
        <DialogHeader>
          <DialogTitle>{forced ? UPDATE_REQUIRED_TITLE : UPDATE_READY_TITLE}</DialogTitle>
          <DialogDescription>
            {forced
              ? "This station must update now. Idle tablets apply after 60 seconds."
              : "Update now loads the new station UI. Remind me later hides this for 10 minutes."}
          </DialogDescription>
        </DialogHeader>
        {bullets.length > 0 ? (
          <ul data-station-change-list className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <DialogFooter>
          {forced ? null : (
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
          )}
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
