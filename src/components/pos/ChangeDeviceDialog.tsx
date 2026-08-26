import { useMemo, useState } from "react";
import { Columns2, MonitorSmartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { useStationSessionStore } from "@/lib/pos/station-session";
import {
  STATION_GROUPS,
  entitiesAllowedForEmployee,
  stationKindLabel,
  stationsAllowedForEmployee,
} from "@/lib/pos/station-access";
import { applySessionModeView } from "./DeviceModeView";
import type { SessionModeId } from "@/lib/lifecycle/types";
import { cn } from "@/lib/utils";

function entityName(
  id: string,
  hostName: string,
  vendors: { id: string; name: string }[],
): string {
  if (id === HOST_SCOPE) return hostName || "Host";
  return vendors.find((v) => v.id === id)?.name ?? id;
}

export function ThisStationButton({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const kind = useStationSessionStore((s) => s.assignment.kind);
  const operatorId = useStationSessionStore((s) => s.assignment.operatorId);
  const split = useStationSessionStore((s) => s.splitEnabled);
  const vendors = usePosStore((s) => s.vendors);
  const hostName = usePosStore((s) => s.settings.name);
  const label = split
    ? "Split display"
    : `${stationKindLabel(kind)} · ${entityName(operatorId, hostName, vendors)}`;
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="This station — what this screen is showing"
        className="max-w-[14rem] shrink"
      >
        <MonitorSmartphone className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{compact ? "Station" : label}</span>
      </Button>
      <StationSwitcherDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SplitScreenToggle() {
  const split = useStationSessionStore((s) => s.splitEnabled);
  const setSplit = useStationSessionStore((s) => s.setSplit);
  const seed = useStationSessionStore((s) => s.seedSplitDefaults);
  const vendors = usePosStore((s) => s.vendors);
  const assignment = useStationSessionStore((s) => s.assignment);
  const setView = usePosStore((s) => s.setView);
  return (
    <Button
      size="sm"
      variant={split ? "default" : "outline"}
      onClick={() => {
        if (split) {
          setSplit(false);
          applySessionModeView(assignment.kind, (v) => setView(v));
          return;
        }
        const kitchenOp =
          vendors.find((v) => v.stationType === "kitchen")?.id ?? assignment.operatorId;
        const barOp = vendors.find((v) => v.stationType === "bar")?.id ?? assignment.operatorId;
        seed(
          { kind: "kitchen_kds", operatorId: kitchenOp },
          { kind: "bar_kds", operatorId: barOp },
        );
      }}
      title="Split screen — two stations on this display"
    >
      <Columns2 className="h-3.5 w-3.5" />
      Split
    </Button>
  );
}

export function StationSwitcherDialog({
  open,
  onOpenChange,
  pane,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pane?: "a" | "b" | "session";
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const vendors = usePosStore((s) => s.vendors);
  const hostName = usePosStore((s) => s.settings.name);
  const hall = Boolean(usePosStore((s) => s.settings.hostMultiOperator || s.settings.multiTenantHallMode));
  const assignment = useStationSessionStore((s) => s.assignment);
  const paneA = useStationSessionStore((s) => s.paneA);
  const paneB = useStationSessionStore((s) => s.paneB);
  const split = useStationSessionStore((s) => s.splitEnabled);
  const ratio = useStationSessionStore((s) => s.splitRatio);
  const setAssignment = useStationSessionStore((s) => s.setAssignment);
  const setPane = useStationSessionStore((s) => s.setPane);
  const setSplit = useStationSessionStore((s) => s.setSplit);
  const setSplitRatio = useStationSessionStore((s) => s.setSplitRatio);
  const seed = useStationSessionStore((s) => s.seedSplitDefaults);
  const setView = usePosStore((s) => s.setView);
  const setActiveDeviceId = usePosStore((s) => s.setActiveDeviceId);
  const devices = usePosStore((s) => s.locationDevices ?? []);

  const current = pane === "a" ? paneA : pane === "b" ? paneB : assignment;
  const allowedKinds = useMemo(() => stationsAllowedForEmployee(emp ?? null), [emp]);
  const entities = useMemo(
    () => entitiesAllowedForEmployee(emp ?? null, vendors, hostName),
    [emp, vendors, hostName],
  );
  const showEntities = hall && entities.length > 1;

  const apply = (kind: SessionModeId, operatorId: string) => {
    const op =
      entities.some((e) => e.id === operatorId) ? operatorId : (entities[0]?.id ?? HOST_SCOPE);
    if (pane === "a" || pane === "b") {
      setPane(pane, { kind, operatorId: op });
    } else {
      setAssignment({ kind, operatorId: op });
      applySessionModeView(kind, (v) => setView(v));
      const match = devices.find(
        (d) => d.assignment.function === kind && d.assignment.operatorId === op,
      ) ?? devices.find((d) => d.assignment.function === kind);
      setActiveDeviceId(match?.id ?? null);
    }
  };

  const pickKind = (kind: SessionModeId) => {
    apply(kind, current.operatorId);
  };

  const pickEntity = (operatorId: string) => {
    apply(current.kind, operatorId);
  };

  const title =
    pane === "a" ? "Left pane" : pane === "b" ? "Right pane" : "This station";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose className="w-[min(100vw-1.25rem,32rem)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          What this screen is showing — not a new login. PIN still identifies the
          person. Tickets stay on this location.
        </p>

        {pane == null || pane === "session" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Layout
            </span>
            <Button
              size="sm"
              variant={!split ? "default" : "outline"}
              onClick={() => {
                setSplit(false);
                applySessionModeView(current.kind, (v) => setView(v));
              }}
            >
              Single
            </Button>
            <Button
              size="sm"
              variant={split ? "default" : "outline"}
              onClick={() => {
                const kitchenOp =
                  vendors.find((v) => v.stationType === "kitchen")?.id ?? current.operatorId;
                const barOp =
                  vendors.find((v) => v.stationType === "bar")?.id ?? current.operatorId;
                seed(
                  { kind: "kitchen_kds", operatorId: kitchenOp },
                  { kind: "bar_kds", operatorId: barOp },
                );
              }}
            >
              Split
            </Button>
            {split && (
              <>
                <Button
                  size="sm"
                  variant={ratio === "50" ? "default" : "outline"}
                  onClick={() => setSplitRatio("50")}
                >
                  50 / 50
                </Button>
                <Button
                  size="sm"
                  variant={ratio === "70" ? "default" : "outline"}
                  onClick={() => setSplitRatio("70")}
                >
                  70 / 30
                </Button>
              </>
            )}
          </div>
        ) : null}

        {STATION_GROUPS.map((g) => {
          const kinds = g.kinds.filter((k) => allowedKinds.includes(k));
          if (!kinds.length) return null;
          return (
            <div key={g.id}>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </p>
              <ul className="grid gap-1 sm:grid-cols-2">
                {kinds.map((id) => (
                  <li key={id}>
                    <Button
                      variant={current.kind === id ? "default" : "outline"}
                      className="w-full justify-start"
                      size="sm"
                      onClick={() => pickKind(id)}
                    >
                      {stationKindLabel(id)}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {showEntities && (
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Entity
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {entities.map((e) => (
                <li key={e.id}>
                  <Button
                    variant={current.operatorId === e.id ? "default" : "outline"}
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => pickEntity(e.id)}
                  >
                    {e.name}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className={cn("text-[11px] text-muted-foreground")}>
          Any tablet, Android display, or desktop can switch. Hardware is not locked
          to one role.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** @deprecated use ThisStationButton */
export function ChangeDeviceButton() {
  return <ThisStationButton />;
}

/** @deprecated use StationSwitcherDialog */
export function ChangeDeviceDialog({
  open,
  onOpenChange,
  pane,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pane?: "a" | "b" | "session";
}) {
  return <StationSwitcherDialog open={open} onOpenChange={onOpenChange} pane={pane} />;
}

export { viewForDeviceFunction } from "@/lib/pos/location-devices";
