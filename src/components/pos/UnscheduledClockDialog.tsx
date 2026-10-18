import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NO_SHIFT_CONFIRM } from "@/lib/labor/clock-eval";

/** Staff confirm when the location allows a punch with no shift covering now. */
export function UnscheduledClockDialog({
  open,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-sm" data-unscheduled-clock showClose={false}>
        <DialogHeader>
          <DialogTitle>{NO_SHIFT_CONFIRM}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            data-unscheduled-cancel
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="h-12"
            data-unscheduled-confirm
            onClick={onConfirm}
            disabled={busy}
          >
            Clock in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
