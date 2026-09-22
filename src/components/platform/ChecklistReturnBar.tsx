import { Button } from "@/components/ui/button";
import { useChecklistLink } from "@/lib/saas/checklist-link";

/** Back and Done both return to the checklist. Done marks the row only after a save. */
export function ChecklistReturnBar({ onReturn }: { onReturn: (tab: "onboarding") => void }) {
  const link = useChecklistLink((s) => s.link);
  const back = useChecklistLink((s) => s.back);
  const done = useChecklistLink((s) => s.done);
  if (!link) return null;

  const leave = (which: "back" | "done") => {
    if (which === "done") done();
    else back();
    onReturn("onboarding");
  };

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2"
      data-checklist-return
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{link.label}</p>
        {link.readOnly ? (
          <p className="text-xs text-danger" data-checklist-blocker>
            Blocked. {link.blocker?.trim() || "No reason entered."} This screen is read-only.
          </p>
        ) : link.saved ? (
          <p className="text-xs text-muted-foreground">Saved. Done marks this task done.</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Status stays until this screen saves. You can still set it on the checklist.
          </p>
        )}
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => leave("back")}>
        Back
      </Button>
      <Button type="button" size="sm" onClick={() => leave("done")} data-checklist-done>
        Done
      </Button>
    </div>
  );
}
