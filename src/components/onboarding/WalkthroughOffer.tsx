import { Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { walkthroughLabel, type WalkthroughKey } from "@/lib/onboarding/context";

export function WalkthroughOffer({
  open,
  walkthroughKey,
  onStart,
  onSkip,
  onLater,
}: {
  open: boolean;
  walkthroughKey: WalkthroughKey;
  onStart: () => void;
  onSkip: () => void;
  onLater: () => void;
}) {
  if (!open) return null;
  const label = walkthroughLabel(walkthroughKey);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onLater();
      }}
    >
      <DialogContent showClose className="z-[90] w-[min(100vw-1.5rem,28rem)]" data-onboarding="walkthrough-offer">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Route className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{label} walkthrough</DialogTitle>
              <DialogDescription>
                A short tour of the live screens for this access level. Next, Back, or skip any time.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm leading-relaxed text-muted-foreground">
          First time in this role, we walk the job on the real UI — not a slide deck.
          Replay later from Guide.
        </p>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="ghost" onClick={onLater}>
            Replay later
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onSkip}>
              Skip tour
            </Button>
            <Button type="button" onClick={onStart}>
              Start walkthrough
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
