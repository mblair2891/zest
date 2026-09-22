import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TenantInvitesPanel } from "@/components/pos/TenantInvitesPanel";
import { GoLivePanel } from "@/components/pos/GoLiveDialog";
import { listTenantSlotsFn } from "@/lib/saas/tenant-invite-api";
import type { TenantInviteRow } from "@/lib/saas/tenant-invite";
import {
  canMarkCardLive,
  canMarkTrainingReady,
  parseEntityOnboardStatus,
} from "@/lib/saas/venue-entity";
import { deleteSellingEntity, type VenueEntitySnap } from "@/lib/saas/entity-delete";
import { deleteSellingEntityFn } from "@/lib/saas/entity-delete-api";
import {
  CHECK_STATUSES,
  blankEntityChecklist,
  checklistTaskTarget,
  goLiveChecklistBlock,
  locationContactComplete,
  progressLine,
  seedLayeredOnboarding,
  setItemBlocker,
  setItemStatus,
  type CheckItem,
  type CheckItemStatus,
  type LayeredOnboarding,
} from "@/lib/saas/onboarding-checklist";
import { useChecklistLink } from "@/lib/saas/checklist-link";
import { usePosStore } from "@/lib/pos/store";

export function VenueOnboardingPanel({
  orgId,
  locationId,
  write,
  onOpenTask,
}: {
  orgId: string;
  locationId: string;
  write: boolean;
  onOpenTask?: (tab: string) => void;
}) {
  const [rows, setRows] = useState<TenantInviteRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<LayeredOnboarding | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [archivedIds, setArchivedIds] = useState<string[]>([]);
  const peer = usePosStore((s) => Boolean(s.settings.peerVenue || s.settings.operatingModel === "peer_venue"));
  const readerId = usePosStore((s) => s.settings.quantumReaderId);
  const applySerial = useChecklistLink((s) => s.applySerial);
  const applied = useChecklistLink((s) => s.applied);
  const openLink = useChecklistLink((s) => s.open);

  useEffect(() => {
    if (!applied) return;
    setLayer((cur) => {
      if (!cur) return cur;
      if (applied.scope === "location") {
        return {
          ...cur,
          location: {
            ...cur.location,
            items: setItemStatus(cur.location.items, applied.itemId, "done"),
          },
        };
      }
      return {
        ...cur,
        entities: cur.entities.map((e) =>
          e.id === applied.entityId
            ? { ...e, items: setItemStatus(e.items, applied.itemId, "done") }
            : e,
        ),
      };
    });
    useChecklistLink.getState().clearApplied();
  }, [applySerial, applied]);

  const openItem = (scope: "location" | "entity", entityId: string | undefined, item: CheckItem) => {
    const target = checklistTaskTarget(scope, item.id);
    const readOnly = item.status === "blocked";
    openLink({
      scope,
      entityId,
      itemId: item.id,
      label: item.label,
      tab: target.tab,
      focus: target.focus,
      readOnly,
      blocker: item.blocker,
    });
    if (entityId) usePosStore.getState().setDemoOperatingEntity(entityId);
    if (target.tab === "floor") usePosStore.getState().setView("floor");
    onOpenTask?.(target.tab);
  };

  const load = useCallback(() => {
    if (!orgId) return;
    void listTenantSlotsFn({ data: { orgId, locationId: locationId || null } })
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load entities"));
  }, [orgId, locationId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!rows) return;
    setLayer((cur) => {
      if (!cur) {
        return seedLayeredOnboarding({
          peer,
          entities: rows
            .filter((r) => !removed.includes(r.operatorId))
            .map((r) => ({ id: r.operatorId, name: r.displayName || "Selling entity" })),
        });
      }
      const known = new Set(cur.entities.map((e) => e.id));
      const extra = rows.filter((r) => !known.has(r.operatorId) && !removed.includes(r.operatorId));
      return {
        ...cur,
        peer,
        entities: [
          ...cur.entities.filter((e) => !removed.includes(e.id)),
          ...extra.map((r) => blankEntityChecklist(r.operatorId, r.displayName || "Selling entity")),
        ],
      };
    });
  }, [rows, peer, removed]);

  const entities = (rows ?? [])
    .filter((r) => !removed.includes(r.operatorId))
    .map((r) => {
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
  const activeLayer = layer
    ? {
        ...layer,
        entities: layer.entities.filter((e) => !archivedIds.includes(e.id)),
      }
    : null;
  const block = activeLayer ? goLiveChecklistBlock(activeLayer) : "Loading checklist";
  const snap: VenueEntitySnap = {
    archived: false,
    entities: (activeLayer?.entities ?? []).map((e) => ({
      id: e.id,
      name: e.name,
      lifecycle: "training",
      hasCardHistory: false,
      archived: false,
    })),
  };

  const removeLocal = (id: string) => {
    setRemoved((cur) => [...cur, id]);
  };

  const onDelete = async (id: string, name: string) => {
    const typed = window.prompt(`Type the entity name to confirm: ${name}`);
    if (typed == null) return;
    const local = deleteSellingEntity(snap, id, typed);
    if (!local.ok) {
      setError(local.error);
      return;
    }
    let mode = local.mode;
    try {
      const saved = await deleteSellingEntityFn({
        data: { locationId, operatorId: id, confirmName: typed },
      });
      mode = saved.mode;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (/last selling entity|Type the entity name|Already archived/i.test(msg)) {
        setError(msg);
        return;
      }
    }
    if (mode === "archive") {
      setArchivedIds((cur) => (cur.includes(id) ? cur : [...cur, id]));
    } else {
      removeLocal(id);
    }
    setError(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5" data-demo="venue-onboarding">
      <div>
        <h2 className="text-lg font-semibold">Venue onboarding</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {peer
            ? "Two layers. The location contact finishes the building. Each selling entity finishes its own checklist. No host merchant on a peer venue."
            : "The location is finished first. Then each selling entity is invited to finish its own checklist."}
        </p>
        {activeLayer && (
          <p className="mt-2 text-xs font-medium text-muted-foreground" data-checklist-progress>
            {progressLine(activeLayer)}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {layer && (
        <section className="rounded-2xl border border-border bg-surface p-4" data-location-checklist>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Location contact
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              placeholder="Name"
              value={layer.location.contactName}
              disabled={!write}
              onChange={(e) =>
                setLayer({
                  ...layer,
                  location: { ...layer.location, contactName: e.target.value },
                })
              }
            />
            <Input
              placeholder="Email"
              value={layer.location.contactEmail}
              disabled={!write}
              onChange={(e) =>
                setLayer({
                  ...layer,
                  location: { ...layer.location, contactEmail: e.target.value },
                })
              }
            />
            <Input
              placeholder="Phone"
              value={layer.location.contactPhone}
              disabled={!write}
              onChange={(e) =>
                setLayer({
                  ...layer,
                  location: { ...layer.location, contactPhone: e.target.value },
                })
              }
            />
          </div>
          {peer && !locationContactComplete(layer.location) && (
            <p className="mt-2 text-xs text-danger">
              Location contact is required on a peer venue. It is operational only.
            </p>
          )}
          <ChecklistItems
            items={layer.location.items}
            write={write}
            onOpen={(item) => openItem("location", undefined, item)}
            onStatus={(id, status) =>
              setLayer({
                ...layer,
                location: { ...layer.location, items: setItemStatus(layer.location.items, id, status) },
              })
            }
            onBlocker={(id, blocker) =>
              setLayer({
                ...layer,
                location: { ...layer.location, items: setItemBlocker(layer.location.items, id, blocker) },
              })
            }
          />
        </section>
      )}

      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Selling entities
        </p>
        {!rows && <p className="text-sm text-muted-foreground">Loading…</p>}
        {layer &&
          layer.entities.map((e) => (
            <section key={e.id} className="mb-4 rounded-xl border border-border p-3" data-entity-checklist={e.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{e.name} contact</p>
                  <p className="text-xs text-muted-foreground">
                    {archivedIds.includes(e.id)
                      ? "Archived — hidden from the POS, kept for the ledger."
                      : "Own POC, menu, merchant, and station."}
                  </p>
                </div>
                {write && !archivedIds.includes(e.id) && (
                  <Button size="sm" variant="destructive" onClick={() => void onDelete(e.id, e.name)}>
                    Delete
                  </Button>
                )}
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <Input
                  placeholder="Contact name"
                  aria-label={`${e.name} contact name`}
                  value={e.contactName}
                  disabled={!write}
                  onChange={(ev) =>
                    setLayer({
                      ...layer,
                      entities: layer.entities.map((x) =>
                        x.id === e.id ? { ...x, contactName: ev.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  placeholder="Email"
                  value={e.contactEmail}
                  disabled={!write}
                  onChange={(ev) =>
                    setLayer({
                      ...layer,
                      entities: layer.entities.map((x) =>
                        x.id === e.id ? { ...x, contactEmail: ev.target.value } : x,
                      ),
                    })
                  }
                />
                <Input
                  placeholder="Phone"
                  value={e.contactPhone}
                  disabled={!write}
                  onChange={(ev) =>
                    setLayer({
                      ...layer,
                      entities: layer.entities.map((x) =>
                        x.id === e.id ? { ...x, contactPhone: ev.target.value } : x,
                      ),
                    })
                  }
                />
              </div>
              <ChecklistItems
                items={e.items}
                write={write}
                onOpen={(item) => openItem("entity", e.id, item)}
                onStatus={(id, status) =>
                  setLayer({
                    ...layer,
                    entities: layer.entities.map((x) =>
                      x.id === e.id ? { ...x, items: setItemStatus(x.items, id, status) } : x,
                    ),
                  })
                }
                onBlocker={(id, blocker) =>
                  setLayer({
                    ...layer,
                    entities: layer.entities.map((x) =>
                      x.id === e.id ? { ...x, items: setItemBlocker(x.items, id, blocker) } : x,
                    ),
                  })
                }
              />
            </section>
          ))}
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
      {write && <GoLivePanel blockedReason={block} />}
      <Button size="sm" variant="ghost" onClick={load}>
        Refresh checklist
      </Button>
    </div>
  );
}

function ChecklistItems({
  items,
  write,
  onOpen,
  onStatus,
  onBlocker,
}: {
  items: CheckItem[];
  write: boolean;
  onOpen: (item: CheckItem) => void;
  onStatus: (id: string, status: CheckItemStatus) => void;
  onBlocker: (id: string, blocker: string) => void;
}) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm" data-checklist-row={item.id}>
          <button
            type="button"
            className="text-left font-medium text-link underline-offset-2 hover:underline"
            data-checklist-task={item.id}
            onClick={() => onOpen(item)}
          >
            {item.label}
            {item.required ? "" : " (optional)"}
          </button>
          <select
            className="h-9 rounded-md border border-border bg-bg px-2 text-xs"
            value={item.status}
            disabled={!write}
            aria-label={`${item.label} status`}
            onChange={(e) => onStatus(item.id, e.target.value as CheckItemStatus)}
          >
            {CHECK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
          {item.status === "blocked" && (
            <Input
              className="w-full"
              placeholder="Blocker reason"
              aria-label={`${item.label} blocker`}
              value={item.blocker ?? ""}
              disabled={!write}
              onChange={(e) => onBlocker(item.id, e.target.value)}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

