import { useState } from "react";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { usePosStore } from "@/lib/pos/store";
import { parseCashHandling } from "@/lib/pos/cash-handling";
import {
  NO_DRAWER_ON_STATION,
  STATION_NO_SALE_REASONS,
  noSaleNeedsManagerPin,
} from "@/lib/pos/no-sale";
import { cn } from "@/lib/utils";
import {
  currentStationDeviceId,
  stationHasBoundReceiptPrinter,
} from "@/lib/print/receipt-printer";

export function NoSaleControl({
  className,
  size = "lg",
  variant = "outline",
}: {
  className?: string;
  size?: "sm" | "lg";
  variant?: "outline" | "default";
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const cashCfg = parseCashHandling(usePosStore((s) => s.settings.cashHandling));
  const noSale = usePosStore((s) => s.noSale);
  const locationDevices = usePosStore((s) => s.locationDevices);
  const canPayStation = stationHasBoundReceiptPrinter(
    locationDevices,
    currentStationDeviceId(),
  );
  const [open, setOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [reason, setReason] = useState<string>(STATION_NO_SALE_REASONS[0]);
  const [flash, setFlash] = useState<string | null>(null);

  const needsPin = noSaleNeedsManagerPin(emp?.role, cashCfg.noSaleAllowedRoles);
  if (!canPayStation) return null;

  const run = (r: string, override?: { overrideEmployeeId?: string; overrideEmployeeName?: string }) => {
    const res = noSale(r, override);
    if (!res.ok) {
      setFlash(res.error ?? NO_DRAWER_ON_STATION);
      return false;
    }
    setFlash(null);
    setOpen(false);
    return true;
  };

  const begin = () => {
    setFlash(null);
    if (needsPin) setPinOpen(true);
    else setOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={cn("station-touch", className)}
        onClick={begin}
        data-no-sale
      >
        <Banknote className="h-4 w-4" />
        No sale
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>No sale — open drawer</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Opens the cash drawer on this station’s receipt printer. Does not start a check.
            Kitchen tickets never kick.
          </p>
          <label className="block text-xs text-muted-foreground">
            Reason
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {STATION_NO_SALE_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          {flash && <p className="text-sm text-danger">{flash}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => run(reason)}>Open drawer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ManagerPinDialog
        open={pinOpen}
        onOpenChange={setPinOpen}
        title="No sale — manager PIN"
        description="This role needs a manager PIN to open the drawer."
        reasons={STATION_NO_SALE_REASONS}
        requireReason
        skipIfAuthed={false}
        onVerified={(ctx) => {
          const r = ctx?.reason || reason;
          setReason(r);
          const res = noSale(r, {
            overrideEmployeeName: "Manager",
          });
          if (!res.ok) {
            setFlash(res.error ?? NO_DRAWER_ON_STATION);
            setOpen(true);
            return;
          }
          setFlash(null);
        }}
      />
    </>
  );
}
