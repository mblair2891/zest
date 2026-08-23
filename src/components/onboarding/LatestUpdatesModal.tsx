import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GuideUpdate } from "@/lib/guide/types";
import { cn } from "@/lib/utils";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function LatestUpdatesModal({
  open,
  entries,
  onClose,
}: {
  open: boolean;
  entries: GuideUpdate[];
  onClose: (silenceUntilNext: boolean) => void;
}) {
  const [silence, setSilence] = useState(true);

  if (!open || entries.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose(silence);
      }}
    >
      <DialogContent
        showClose
        className="z-[90] w-[min(100vw-1.5rem,36rem)]"
        data-onboarding="latest-updates"
      >
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>Latest updates</DialogTitle>
              <DialogDescription>
                Changes that apply to your access level and this location.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ul className="max-h-[min(52vh,28rem)] space-y-3 overflow-y-auto pr-1">
          {entries.map((u) => (
            <li
              key={u.id}
              className="rounded-xl border border-border bg-bg px-3.5 py-3"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {formatDate(u.date)}
              </p>
              <h3 className="mt-0.5 text-sm font-semibold text-foreground">{u.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {u.body ?? u.summary}
              </p>
            </li>
          ))}
        </ul>

        <label
          className={cn(
            "flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-bg px-3 py-2.5 text-sm",
          )}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-primary"
            checked={silence}
            onChange={(e) => setSilence(e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Silence until the next update</span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              Hide this list until a newer change matches your role.
            </span>
          </span>
        </label>

        <DialogFooter>
          <Button type="button" onClick={() => onClose(silence)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
