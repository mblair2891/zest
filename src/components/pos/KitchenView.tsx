import { useMemo, useState } from "react";
import { useStationTicketPolling } from "@/lib/pos/floor-sync";
import { Check, RotateCcw, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import type { TicketStation, TicketStatus } from "@/lib/pos/types";
import { cn } from "@/lib/utils";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { HOST_SCOPE, canViewTickets } from "@/lib/access/entity-grants";
import { stationForDeviceFunction } from "@/lib/pos/location-devices";
import { PinKeypad } from "./PinKeypad";
import { findStaffByPin } from "@/lib/pos/pin";
import { isProspectDemo } from "@/lib/demo/session";
import { isDemoStaffPin } from "@/lib/demo/pin";
import { RecipeLookupButton } from "@/components/recipes/RecipeLookup";

type KitchenRail = TicketStation | "all";

interface Props {
  station: KitchenRail;
  /** Expo rail: ready tickets and mark delivered (bump). */
  expo?: boolean;
  /** Pane-scoped entity. Host scope = all operators this PIN can see. */
  operatorId?: string | null;
}

function elapsedColor(sec: number): string {
  if (sec < 300) return "text-success";
  if (sec < 600) return "text-warn";
  return "text-danger";
}

function fmtElapsed(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function KitchenView({ station, expo, operatorId }: Props) {
  const tickets = usePosStore((s) => s.tickets);
  const orders = usePosStore((s) => s.orders);
  const vendors = usePosStore((s) => s.vendors);
  const bumpTicket = usePosStore((s) => s.bumpTicket);
  const recallTicket = usePosStore((s) => s.recallTicket);
  const startTicket = usePosStore((s) => s.startTicket);
  const readyTicket = usePosStore((s) => s.readyTicket);
  const [showBumped, setShowBumped] = useState(false);
  const [filter, setFilter] = useState<TicketStatus | "all">("all");
  const [bumpPinFor, setBumpPinFor] = useState<string | null>(null);
  const [bumpPinError, setBumpPinError] = useState<string | null>(null);
  const settings = usePosStore((s) => s.settings);
  const employees = usePosStore((s) => s.employees);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const grants = usePosStore((s) => s.entityPermissions);
  const devices = usePosStore((s) => s.locationDevices ?? []);
  const activeDeviceId = usePosStore((s) => s.activeDeviceId);
  const device = devices.find((d) => d.id === activeDeviceId);
  const paneOverride = operatorId !== undefined;
  const assignedOp =
    !paneOverride && device?.assignment.operatorId && device.assignment.operatorId !== HOST_SCOPE
      ? device.assignment.operatorId
      : null;
  const assignedStation = paneOverride
    ? null
    : device
      ? stationForDeviceFunction(device.assignment.function)
      : null;
  const roleOp = emp?.operatorId ?? null;
  const hostWide = emp?.role === "owner" || emp?.role === "manager";
  const paneOp =
    operatorId && operatorId !== HOST_SCOPE ? operatorId : null;
  const lockedVendor = paneOverride
    ? paneOp
    : assignedOp ?? (!hostWide && roleOp ? roleOp : null);
  const [vendorFilter, setVendorFilter] = useState<string | null>(lockedVendor);
  const [railPick, setRailPick] = useState<"all" | "kitchen" | "bar">("all");
  const railStation: KitchenRail = assignedStation || station;
  const showAllRails = railStation === "all";
  const activeRail: KitchenRail =
    showAllRails ? railPick : railStation === "bar" ? "bar" : railStation === "kitchen" ? "kitchen" : railStation;
  useStationTicketPolling(
    locId || null,
    activeRail === "bar" ? "bar" : "kitchen",
    lockedVendor,
  );
  useStationTicketPolling(showAllRails ? locId || null : null, "bar", lockedVendor);

  const visibleVendorIds = vendors
    .filter(
      (v) =>
        v.active &&
        (!lockedVendor || v.id === lockedVendor || canViewTickets(emp, grants, v.id)),
    )
    .map((v) => v.id);
  const list = useMemo(() => {
    const st = activeRail;
    let t =
      st === "all"
        ? tickets.filter((x) => x.station === "kitchen" || x.station === "bar")
        : tickets.filter((x) => x.station === st);
    if (expo) t = t.filter((x) => x.status === "ready" || (showBumped && x.status === "bumped"));
    else if (!showBumped) t = t.filter((x) => x.status !== "bumped");
    if (filter !== "all") t = t.filter((x) => x.status === filter);
    if (vendorFilter) t = t.filter((x) => x.vendorId === vendorFilter);
    else if (lockedVendor && visibleVendorIds.length <= 1)
      t = t.filter((x) => x.vendorId === lockedVendor);
    else if (visibleVendorIds.length && visibleVendorIds.length < vendors.length)
      t = t.filter((x) => x.vendorId && visibleVendorIds.includes(x.vendorId));
    return t.sort((a, b) => a.createdAt - b.createdAt);
  }, [
    tickets,
    station,
    showBumped,
    filter,
    vendorFilter,
    lockedVendor,
    railStation,
    activeRail,
    visibleVendorIds,
    vendors.length,
    expo,
  ]);

  const active = tickets.filter(
    (t) =>
      (activeRail === "all"
        ? t.station === "kitchen" || t.station === "bar"
        : t.station === activeRail) &&
      t.status !== "bumped" &&
      (!(lockedVendor || vendorFilter) || t.vendorId === (lockedVendor || vendorFilter)),
  ).length;

  return (
    <div className="kds-large-touch relative flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold capitalize">
          {expo
            ? "Expo"
            : railStation === "bar"
              ? "Bar order display"
              : railStation === "all"
                ? "Order display"
                : "Kitchen order display"}
        </h2>
        <GuideLearnLink topicId="kds" compact>
          Learn
        </GuideLearnLink>
        <Badge variant="info" className="tabular">
          {active} active
        </Badge>
        <div className="flex flex-wrap gap-1">
          {showAllRails && (
            <>
              {(["all", "kitchen", "bar"] as const).map((id) => (
                <Button
                  key={id}
                  size="sm"
                  variant={railPick === id ? "default" : "outline"}
                  onClick={() => setRailPick(id)}
                  className="capitalize"
                >
                  {id === "all" ? "All tickets" : id}
                </Button>
              ))}
            </>
          )}
          {(!lockedVendor ||
            vendors.some((v) => v.id !== lockedVendor && canViewTickets(emp, grants, v.id))) && (
            <Button
              size="sm"
              variant={vendorFilter === null ? "default" : "outline"}
              onClick={() => setVendorFilter(null)}
            >
              All operators
            </Button>
          )}
          {vendors
            .filter((v) => {
              if (!v.active) return false;
              if (!lockedVendor) return true;
              if (v.id === lockedVendor) return true;
              return canViewTickets(emp, grants, v.id);
            })
            .map((v) => (
              <Button
                key={v.id}
                size="sm"
                variant={(lockedVendor || vendorFilter) === v.id ? "default" : "outline"}
                onClick={() => {
                  if (v.id === lockedVendor) {
                    setVendorFilter(v.id);
                    return;
                  }
                  if (!lockedVendor || canViewTickets(emp, grants, v.id)) setVendorFilter(v.id);
                }}
              >
                {v.shortName}
              </Button>
            ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1">
          {(["all", "new", "in_progress", "ready"] as const).map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
              className="capitalize"
            >
              {f === "in_progress" ? "Preparing" : f === "new" ? "Sent" : f}
            </Button>
          ))}
          <Button
            size="sm"
            variant={showBumped ? "default" : "outline"}
            onClick={() => setShowBumped((v) => !v)}
          >
            Recall queue
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center text-muted-foreground">
          <p className="text-lg font-medium">All clear</p>
          <p className="text-sm">
            Tickets appear when the floor sends. Start to prepare, Bump when ready.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {list.map((t) => (
              <article
                key={t.id}
                className={cn(
                  "flex flex-col rounded-2xl border bg-surface shadow-sm",
                  t.status === "new" && "border-info/50",
                  t.status === "in_progress" && "border-warn/50",
                  t.status === "ready" && "border-success/50",
                  t.status === "bumped" && "border-border opacity-70",
                )}
              >
                <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
                  <div>
                    <p className="text-lg font-semibold">
                      {t.tableLabel}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        #{t.orderNumber}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.serverName} ·{" "}
                      <span className="capitalize">{t.course}</span>
                      {t.vendorName && (
                        <Badge variant="secondary" className="ml-1.5">
                          {t.vendorName}
                        </Badge>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "text-xl font-semibold tabular",
                        elapsedColor(t.elapsedSec),
                      )}
                    >
                      {fmtElapsed(t.elapsedSec)}
                    </p>
                    <Badge
                      variant={
                        t.status === "ready"
                          ? "success"
                          : t.status === "in_progress"
                            ? "warn"
                            : "info"
                      }
                      className="mt-1 capitalize"
                    >
                      {t.status === "in_progress"
                        ? "Preparing"
                        : t.status === "new"
                          ? "Sent"
                          : t.status === "bumped"
                            ? "Delivered"
                            : t.status.replace("_", " ")}
                    </Badge>
                  </div>
                </header>
                <ul className="flex-1 space-y-1.5 px-3 py-2">
                  {t.items.map((it) => (
                    <li key={it.lineId} className="text-sm">
                      <span className="font-semibold tabular">{it.quantity}×</span>{" "}
                      {it.name}
                      {(() => {
                        const mid = orders
                          .find((o) => o.id === t.orderId)
                          ?.lines.find((l) => l.id === it.lineId)?.menuItemId;
                        return mid ? (
                          <span className="ml-1 inline-block align-middle">
                            <RecipeLookupButton menuItemId={mid} />
                          </span>
                        ) : null;
                      })()}
                      {it.modifiers.length > 0 && (
                        <span className="block text-xs text-muted-foreground">
                          {it.modifiers.join(", ")}
                        </span>
                      )}
                      {it.note && (
                        <span className="block text-xs text-warn">
                          ** {it.note}
                        </span>
                      )}
                      {it.seat != null && (
                        <span className="text-[10px] text-muted-foreground">
                          {" "}
                          seat {it.seat}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <footer className="flex gap-1.5 border-t border-border p-2">
                  {t.status === "new" && !expo && (
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="outline"
                      onClick={() => startTicket(t.id)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      Start
                    </Button>
                  )}
                  {(t.status === "new" || t.status === "in_progress") && !expo && (
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => {
                        if (settings.requirePinToBump && !isProspectDemo()) {
                          setBumpPinFor(t.id);
                          setBumpPinError(null);
                          return;
                        }
                        readyTicket(t.id);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Bump
                    </Button>
                  )}
                  {(expo || t.status === "ready") && t.status !== "bumped" && (
                    <Button
                      className="flex-1"
                      size="sm"
                      onClick={() => {
                        if (settings.requirePinToBump && !isProspectDemo()) {
                          setBumpPinFor(t.id);
                          setBumpPinError(null);
                          return;
                        }
                        bumpTicket(t.id);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Delivered
                    </Button>
                  )}
                  {t.status === "bumped" && (
                    <Button
                      className="flex-1"
                      size="sm"
                      variant="outline"
                      onClick={() => recallTicket(t.id)}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Recall
                    </Button>
                  )}
                </footer>
              </article>
            ))}
          </div>
        </div>
      )}
      {bumpPinFor && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg/90 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-4">
            <PinKeypad
              title={expo ? "Confirm delivered" : "Confirm bump"}
              hint="Enter this station’s PIN"
              error={bumpPinError}
              onClearError={() => setBumpPinError(null)}
              onComplete={(pin) => {
                const match =
                  findStaffByPin(employees, pin, locId, lockedVendor) ||
                  (isDemoStaffPin(pin) ? emp : null);
                if (!match) {
                  setBumpPinError("Invalid PIN");
                  return;
                }
                const ticket = tickets.find((x) => x.id === bumpPinFor);
                if (ticket && (ticket.status === "new" || ticket.status === "in_progress") && !expo) {
                  readyTicket(bumpPinFor);
                } else {
                  bumpTicket(bumpPinFor);
                }
                setBumpPinFor(null);
              }}
            />
            <Button
              className="mt-3 w-full"
              variant="outline"
              onClick={() => setBumpPinFor(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
