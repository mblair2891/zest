import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { ackVenueBulletinFn, listVenueBulletinsFn } from "@/lib/saas/reg-bulletins-api";
import type { VenueBulletin } from "@/lib/saas/reg-bulletins";
import { useTaxSuggestionStore } from "@/lib/pos/tax-suggestion";

export function VenueRegBanner({
  onReview,
  onReviewLabor,
}: {
  onReview?: () => void;
  onReviewLabor?: () => void;
}) {
  const locId = usePosStore((s) => s.tenantLocationId);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const saasRole = useSaasStore((s) => s.platformAdminRole);
  const setView = usePosStore((s) => s.setView);
  const [rows, setRows] = useState<VenueBulletin[]>([]);
  const role = emp?.role;
  const canSee =
    role === "owner" ||
    role === "manager" ||
    saasRole === "owner" ||
    saasRole === "manager";

  useEffect(() => {
    if (!locId || !canSee) return;
    let cancelled = false;
    void listVenueBulletinsFn({ data: { locationId: locId } })
      .then((list) => {
        if (!cancelled) setRows(list.filter((b) => b.ack === "pending"));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [locId, canSee]);

  if (!canSee || !locId || !rows.length) return null;
  const top = rows[0]!;

  const reviewTaxes = () => {
    useTaxSuggestionStore.getState().setSuggestion(top.id, top.suggestedTax, top.suggestedLabor);
    onReview?.();
    setView("settings");
  };
  const reviewLabor = () => {
    useTaxSuggestionStore.getState().setSuggestion(top.id, top.suggestedTax, top.suggestedLabor);
    onReviewLabor?.();
    setView("labor");
  };
  const schedule = () => {
    void ackVenueBulletinFn({
      data: {
        locationId: locId,
        bulletinId: top.id,
        status: "scheduled",
        applyOn: top.effectiveOn,
      },
    }).then(() =>
      setRows((cur) =>
        cur.map((b) => (b.id === top.id ? { ...b, ack: "scheduled", applyOn: top.effectiveOn } : b)),
      ),
    );
  };

  const dismiss = () => {
    void ackVenueBulletinFn({
      data: { locationId: locId, bulletinId: top.id, status: "dismissed" },
    }).then(() => setRows((cur) => cur.filter((b) => b.id !== top.id)));
    useTaxSuggestionStore.getState().clear();
  };

  return (
    <div
      data-reg-bulletin-banner
      className="shrink-0 border-b border-primary/40 bg-primary/10 px-3 py-2 text-sm text-foreground"
      role="status"
    >
      <p className="font-semibold">{top.title}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        Effective {top.effectiveOn}
        {top.severity === "action_required" ? " · Action required" : ""}
        {top.ack === "scheduled" ? ` · Scheduled ${top.applyOn || top.effectiveOn}` : ""}
        . Rules do not change until you Save.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {top.kind !== "labor" ? (
          <Button type="button" size="sm" onClick={reviewTaxes}>
            Review taxes
          </Button>
        ) : null}
        {top.kind !== "tax" ? (
          <Button type="button" size="sm" onClick={reviewLabor}>
            Review labor
          </Button>
        ) : null}
        {top.ack !== "scheduled" ? (
          <Button type="button" size="sm" variant="outline" onClick={schedule}>
            Schedule for {top.effectiveOn}
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  );
}
