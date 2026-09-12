import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TenantInvitesPanel } from "@/components/pos/TenantInvitesPanel";
import { GoLivePanel } from "@/components/pos/GoLiveDialog";
import { listTenantSlotsFn } from "@/lib/saas/tenant-invite-api";
import type { TenantInviteRow } from "@/lib/saas/tenant-invite";
import {
  canMarkCardLive,
  canMarkTrainingReady,
  ENTITY_STATUS_LABEL,
  parseEntityOnboardStatus,
} from "@/lib/saas/venue-entity";
import { usePosStore } from "@/lib/pos/store";

export function VenueOnboardingPanel({
  orgId,
  locationId,
  write,
}: {
  orgId: string;
  locationId: string;
  write: boolean;
}) {
  const [rows, setRows] = useState<TenantInviteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const peer = usePosStore((s) => Boolean(s.settings.peerVenue || s.settings.operatingModel === "peer_venue"));
  const readerId = usePosStore((s) => s.settings.quantumReaderId);

  const load = useCallback(() => {
    if (!orgId) return;
    void listTenantSlotsFn({ data: { orgId, locationId: locationId || null } })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load entities"));
  }, [orgId, locationId]);

  useEffect(() => {
    load();
  }, [load]);

  const entities = (rows ?? []).map((r) => {
    const finixApproved = r.paymentsStatus === "approved" || r.paymentsStatus === "activated";
    const status = parseEntityOnboardStatus(
      finixApproved ? "ready" : r.status === "complete" ? "finix_pending" : r.status,
    );
    return { ...r, status, finixApproved };
  });
  const trainingOk = canMarkTrainingReady(entities);
  const live = canMarkCardLive({
    entities,
    readerEnrolled: Boolean(readerId),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-demo="venue-onboarding">
      <div>
        <h2 className="text-lg font-semibold">Venue onboarding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {peer
            ? "This building is not a merchant. Each selling entity completes its own legal packet, Quantum Payments application, and menu. You cannot skip that work for them."
            : "Invite each selling entity. They complete their own Quantum Payments application and menu."}
        </p>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Entity checklist
        </p>
        {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
        {rows && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No selling entities yet. Add slots below.</p>
        )}
        <ul className="space-y-2">
          {entities.map((e) => (
            <li
              key={e.operatorId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">{e.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {e.email || e.phone || "No POC yet"}
                </p>
              </div>
              <Badge
                variant={
                  e.status === "ready"
                    ? "success"
                    : e.status === "finix_pending"
                      ? "warn"
                      : e.status === "in_progress"
                        ? "info"
                        : "secondary"
                }
              >
                {ENTITY_STATUS_LABEL[e.status]}
              </Badge>
            </li>
          ))}
        </ul>
        <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
          <li>
            Training-ready: {trainingOk ? "every entity has started" : "waiting — each entity must be at least in progress"}
          </li>
          <li>
            Card-live: {live.ok ? "every entity approved and a reader enrolled" : live.reason}
          </li>
        </ul>
      </div>

      <TenantInvitesPanel write={write} />
      {write && <GoLivePanel />}
      <Button size="sm" variant="ghost" onClick={load}>
        Refresh checklist
      </Button>
    </div>
  );
}
