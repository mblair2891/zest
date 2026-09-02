import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { getCommsUsageFn, type CommsUsageSnapshot } from "@/lib/comms/api";
import { usePosStore } from "@/lib/pos/store";
import { isProspectDemo } from "@/lib/demo/session";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

function money(n: number): string {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function CommsUsageCard() {
  const locId = usePosStore((s) => s.tenantLocationId);
  const [row, setRow] = useState<CommsUsageSnapshot | null>(null);

  useEffect(() => {
    if (!locId || isProspectDemo()) return;
    let cancelled = false;
    void getCommsUsageFn({ data: { locationId: locId } })
      .then((r) => {
        if (!cancelled) setRow(r);
      })
      .catch(() => {
        if (!cancelled) setRow(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locId]);

  if (!row) return null;
  const { sms, ai } = row;
  const overageLabel =
    sms.overageMode === "bill_at_cost"
      ? money(sms.overageUsd)
      : sms.overageMode === "block_when_cap"
        ? "blocked at cap"
        : "warn only";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">SMS this month</h3>
        <GuideLearnLink topicId="feature-waitlist" compact>
          Learn
        </GuideLearnLink>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Used</p>
          <p className="mt-0.5 text-lg font-semibold tabular">{sms.used}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Included / cap</p>
          <p className="mt-0.5 text-lg font-semibold tabular">
            {sms.included}
            {sms.cap !== sms.included ? ` / ${sms.cap}` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Overage $</p>
          <p className="mt-0.5 text-lg font-semibold tabular">{overageLabel}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Email receipts never count. AI today {ai.used} / {ai.cap}
        {sms.smsEnabled === false ? " · SMS off for waitlist and tenant invites" : ""}.
      </p>
    </div>
  );
}
