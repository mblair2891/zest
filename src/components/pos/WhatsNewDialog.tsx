import { useEffect, useMemo, useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { useGuideStore } from "@/lib/guide/store";
import { useGuideAudience } from "@/lib/guide/use-guide-audience";
import { GUIDE_ROLE_LABEL, GUIDE_VERSION } from "@/lib/guide/types";
import { employeeToGuideRoles } from "@/lib/guide/roles";

/**
 * Post-login “What’s New” — last ~10 updates filtered to this access level.
 * Shows every login unless the user silences until the next product update.
 */
export function WhatsNewDialog() {
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const venue = usePosStore((s) => s.activeEntityId);
  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const { roles: sessionRoles } = useGuideAudience();
  const roles = emp
    ? employeeToGuideRoles(emp.role, venue)
    : sessionRoles;

  const shouldShow = useGuideStore((s) => s.shouldShowWhatsNew);
  const updatesFor = useGuideStore((s) => s.updatesFor);
  const dismiss = useGuideStore((s) => s.dismissWhatsNew);
  const openGuide = useGuideStore((s) => s.openGuide);
  const forceWhatsNew = useGuideStore((s) => s.forceWhatsNew);
  const dismissedThisSession = useGuideStore((s) => s.dismissedThisSession);

  const [silence, setSilence] = useState(false);
  const [open, setOpen] = useState(false);

  const audience = roles.length ? roles : ("all" as const);
  const updates = useMemo(
    () => updatesFor(audience, 10),
    [audience, updatesFor, forceWhatsNew, dismissedThisSession],
  );

  useEffect(() => {
    if (!emp && sessionRoles.length === 0) {
      setOpen(false);
      return;
    }
    const t = window.setTimeout(() => {
      setOpen(shouldShow(audience) && updates.length > 0);
    }, 350);
    return () => window.clearTimeout(t);
  }, [emp, sessionRoles.length, shouldShow, updates.length, forceWhatsNew, dismissedThisSession, audience]);

  if (!emp && sessionRoles.length === 0) return null;

  const label =
    roles.length > 0
      ? roles.map((r) => GUIDE_ROLE_LABEL[r]).join(" · ")
      : "all roles";

  const onClose = (alsoOpen?: string) => {
    dismiss({
      role: emp?.role,
      guideRoles: roles,
      silenceUntilNext: silence,
    });
    setOpen(false);
    setSilence(false);
    if (alsoOpen) openGuide(alsoOpen);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent
        className="w-[min(100vw-1.25rem,28rem)] gap-3 sm:w-[min(100vw-1.5rem,32rem)]"
        showClose
      >
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>What’s new in Summex</DialogTitle>
              <DialogDescription>
                For{" "}
                <span className="font-semibold text-foreground">{label}</span> ·
                last {updates.length} updates · guide v{GUIDE_VERSION}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ul className="max-h-[min(50vh,22rem)] space-y-2 overflow-y-auto pr-1">
          {updates.map((u, idx) => (
            <li
              key={u.id}
              className="rounded-xl border border-border bg-bg px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {u.title}
                </p>
                {idx === 0 && (
                  <Badge variant="success" className="shrink-0 text-[10px]">
                    Latest
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {u.date}
                {u.tags?.length ? ` · ${u.tags.join(" · ")}` : ""}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {u.summary}
              </p>
              {u.topicId && (
                <button
                  type="button"
                  className="mt-1.5 text-xs font-medium text-link underline-offset-2 hover:underline"
                  onClick={() => onClose(u.topicId)}
                >
                  Read in guide
                </button>
              )}
            </li>
          ))}
        </ul>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-surface-2/40 px-3 py-2.5 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 accent-primary"
            checked={silence}
            onChange={(e) => setSilence(e.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">
              Don’t show again until the next update
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Hides this popup on future logins until a newer release is added
              for your access level.
            </span>
          </span>
        </label>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onClose("intro")}
          >
            <BookOpen className="mr-1.5 h-4 w-4" />
            Open Operators Guide
          </Button>
          <Button className="w-full sm:w-auto" onClick={() => onClose()}>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
