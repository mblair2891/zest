import { useState } from "react";
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
import { HOST_SCOPE } from "@/lib/access/entity-grants";

export function GrantEntityShiftDialog({
  open,
  onOpenChange,
  employeeId,
  workOperatorId,
  workName,
  onGranted,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId: string;
  workOperatorId: string;
  workName: string;
  onGranted?: () => void;
}) {
  const employees = usePosStore((s) => s.employees);
  const grant = usePosStore((s) => s.grantEntityShiftWork);
  const person = employees.find((e) => e.id === employeeId);
  const [scope, setScope] = useState<"shift" | "standing">("shift");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const res = grant({
      employeeId,
      workOperatorId: workOperatorId || HOST_SCOPE,
      scope,
      reason: reason.trim() || undefined,
    });
    if (!res.ok) {
      setError(res.error ?? "Could not grant");
      return;
    }
    setError(null);
    onOpenChange(false);
    onGranted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Work for other entity this shift</DialogTitle>
          <DialogDescription>
            {person?.name || "This person"} is not on {workName}. Grant them onto that board — same
            idea as an extra table outside section. Shift grants drop at clock-out.
          </DialogDescription>
        </DialogHeader>
        <label className="block text-sm">
          Scope
          <select
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
            value={scope}
            onChange={(e) => setScope(e.target.value as "shift" | "standing")}
          >
            <option value="shift">This shift (drops at clock-out)</option>
            <option value="standing">Standing</option>
          </select>
        </label>
        <label className="block text-sm">
          Reason (optional)
          <input
            className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Cover for the food operator tonight"
          />
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit}>Grant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
