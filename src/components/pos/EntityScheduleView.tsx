import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE, canEditSchedule, canViewSchedule, isHostPrivileged } from "@/lib/access/entity-grants";
import { addDays, formatDayLabel, startOfWeek, weekDays, sameDay } from "@/lib/labor/week";
import {
  canPlaceEmployeeOnEntityBoard,
  defaultScheduleEntity,
  scheduleEntityIds,
} from "@/lib/labor/schedule-entity";
import { formatTime } from "@/lib/utils";
import { isFloorRole } from "@/lib/pos/pin";
import { isProspectDemo } from "@/lib/demo/session";
import { listShiftsFn, saveShiftsFn } from "@/lib/labor/api";
import { useSaasStore } from "@/lib/pos/saas-store";
import { GrantEntityShiftDialog } from "./GrantEntityShiftDialog";

export function EntityScheduleView() {
  const employees = usePosStore((s) => s.employees);
  const vendors = usePosStore((s) => s.vendors);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const grants = usePosStore((s) => s.entityPermissions);
  const extraGrants = usePosStore((s) => s.extraEntityShiftGrants ?? []);
  const settings = usePosStore((s) => s.settings);
  const sessionKind = usePosStore((s) => s.sessionKind);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const orgId = useSaasStore((s) => s.org.id);
  const shifts = useOpsStore((s) => s.shifts);
  const upsert = useOpsStore((s) => s.upsertShift);
  const remove = useOpsStore((s) => s.removeShift);
  const publish = useOpsStore((s) => s.publishWeek);
  const hostEdit = Boolean(settings.hostMayEditEntitySchedules);
  const peer = Boolean(settings.peerVenue || settings.operatingModel === "peer_venue");
  const floor = sessionKind === "pin" && isFloorRole(emp?.role);
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const vendorIds = vendors.map((v) => v.id);
  const entityIds = scheduleEntityIds({ peerVenue: peer, vendorIds });
  const [boardEntity, setBoardEntity] = useState(() =>
    defaultScheduleEntity({
      managerOperatorId: emp?.operatorId,
      peerVenue: peer,
      vendorIds,
    }),
  );
  const [grantFor, setGrantFor] = useState<{ employeeId: string; day: number } | null>(null);

  const entityKey = entityIds.join(",");
  useEffect(() => {
    if (entityIds.length && !entityIds.includes(boardEntity)) {
      setBoardEntity(
        defaultScheduleEntity({
          managerOperatorId: emp?.operatorId,
          peerVenue: peer,
          vendorIds,
        }),
      );
    }
    // entityKey stands in for entityIds / vendorIds
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityKey, boardEntity, emp?.operatorId, peer]);

  useEffect(() => {
    if (!orgId || !locId || !boardEntity || isProspectDemo()) return;
    void listShiftsFn({ data: { orgId, locationId: locId, operatorId: boardEntity } })
      .then((rows) => {
        const ops = useOpsStore.getState();
        const keep = ops.shifts.filter((s) => s.operatorId !== boardEntity);
        const incoming = rows.map((r) => ({
          id: r.id,
          employeeId: r.employeeId,
          operatorId: r.operatorId,
          start: r.start,
          end: r.end,
          published: r.published,
          role: r.role,
          locationId: locId,
        }));
        useOpsStore.setState({
          shifts: [...keep, ...incoming],
          todayShifts: [...keep, ...incoming].filter((s) => {
            const d = new Date();
            d.setHours(0, 0, 0, 0);
            return s.start >= d.getTime() && s.start < d.getTime() + 86400000;
          }),
        });
      })
      .catch(() => undefined);
  }, [orgId, locId, boardEntity]);

  const opName = (id: string) =>
    id === HOST_SCOPE
      ? peer
        ? "Venue"
        : settings.name || "Host"
      : vendors.find((v) => v.id === id)?.shortName ?? id;

  const staff = useMemo(() => {
    return employees.filter((e) => {
      if (!e.active) return false;
      if (floor) return e.id === emp?.id;
      const home = e.operatorId || HOST_SCOPE;
      const onBoard = canPlaceEmployeeOnEntityBoard({
        homeOperatorId: home,
        boardOperatorId: boardEntity,
        employeeId: e.id,
        grants: extraGrants,
      });
      if (!onBoard) return false;
      return canViewSchedule(emp, grants, boardEntity);
    });
  }, [employees, floor, emp, boardEntity, grants, extraGrants]);

  const otherStaff = useMemo(() => {
    if (floor) return [];
    return employees.filter((e) => {
      if (!e.active) return false;
      const home = e.operatorId || HOST_SCOPE;
      if (home === boardEntity) return false;
      return !canPlaceEmployeeOnEntityBoard({
        homeOperatorId: home,
        boardOperatorId: boardEntity,
        employeeId: e.id,
        grants: extraGrants,
      });
    });
  }, [employees, floor, boardEntity, extraGrants]);

  const days = weekDays(weekStart);
  const canEditBoard = !floor && canEditSchedule(emp, grants, boardEntity, hostEdit, peer);

  const persist = () => {
    if (isProspectDemo() || !orgId || !locId) return;
    const weekEnd = addDays(weekStart, 7);
    const payload = useOpsStore
      .getState()
      .shifts.filter(
        (s) => s.operatorId === boardEntity && s.start >= weekStart && s.start < weekEnd,
      );
    void saveShiftsFn({
      data: { orgId, locationId: locId, shifts: payload },
    }).catch(() => undefined);
  };

  const addOn = (employeeId: string, day: number) => {
    const person = employees.find((e) => e.id === employeeId);
    if (!person || !canEditBoard) return;
    const home = person.operatorId || HOST_SCOPE;
    const allowed = canPlaceEmployeeOnEntityBoard({
      homeOperatorId: home,
      boardOperatorId: boardEntity,
      employeeId,
      grants: usePosStore.getState().extraEntityShiftGrants ?? [],
    });
    if (!allowed) {
      if (isHostPrivileged(emp)) {
        setGrantFor({ employeeId, day });
      }
      return;
    }
    const start = day + 11 * 3600000;
    upsert({
      employeeId,
      operatorId: boardEntity,
      start,
      end: start + 8 * 3600000,
      published: false,
      role: person.role,
      locationId: locId,
    });
    persist();
  };

  const moveShift = (shiftId: string, day: number) => {
    const s = shifts.find((x) => x.id === shiftId);
    if (!s || !canEditBoard) return;
    const dur = s.end - s.start;
    const start = day + (s.start - new Date(s.start).setHours(0, 0, 0, 0));
    upsert({ ...s, start, end: start + dur, operatorId: boardEntity });
    persist();
  };

  return (
    <div className="flex h-full flex-col" data-demo="schedule">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">
          {floor ? "My shifts" : `${opName(boardEntity)} schedule`}
        </h2>
        <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">{formatDayLabel(weekStart)}</span>
        <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!floor && entityIds.length > 1 && (isHostPrivileged(emp) || emp?.operatorId) && (
          <select
            className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
            value={boardEntity}
            onChange={(e) => setBoardEntity(e.target.value)}
            aria-label="Entity"
          >
            {entityIds.map((id) => (
              <option key={id} value={id}>
                {opName(id)}
              </option>
            ))}
          </select>
        )}
        {!floor && (
          <Button
            size="sm"
            onClick={() => {
              publish(weekStart, boardEntity);
              persist();
            }}
            disabled={!canEditBoard}
          >
            Publish week
          </Button>
        )}
        <p className="text-[11px] text-muted-foreground">
          Publish does not merge the other entity’s calendar.
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">
        <table className="min-w-full border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-bg px-2 py-2">Staff</th>
              {days.map((d) => (
                <th key={d} className="px-2 py-2 font-medium">
                  {formatDayLabel(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staff.map((person) => {
              const home = person.operatorId || HOST_SCOPE;
              return (
                <tr key={person.id} className="border-t border-border">
                  <td
                    className="sticky left-0 bg-bg px-2 py-2"
                    draggable={canEditBoard}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/staff", person.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                  >
                    <p className="font-medium">{person.name}</p>
                    <p className="text-muted-foreground">
                      {opName(home)}
                      {home !== boardEntity ? " · guest this board" : ""}
                    </p>
                  </td>
                  {days.map((d) => {
                    const cell = shifts.filter(
                      (s) =>
                        s.employeeId === person.id &&
                        s.operatorId === boardEntity &&
                        sameDay(s.start, d),
                    );
                    return (
                      <td
                        key={d}
                        className="px-1 py-1 align-top"
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const staffId = e.dataTransfer.getData("text/staff");
                          const shiftId = e.dataTransfer.getData("text/shift");
                          if (shiftId) moveShift(shiftId, d);
                          else if (staffId) addOn(staffId, d);
                        }}
                      >
                        {cell.map((s) => (
                          <div
                            key={s.id}
                            className="mb-1 rounded-lg border border-border bg-surface px-1.5 py-1"
                            draggable={canEditBoard}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/shift", s.id);
                              e.dataTransfer.effectAllowed = "move";
                            }}
                          >
                            <p className="tabular">
                              {formatTime(s.start)}–{formatTime(s.end)}
                            </p>
                            <Badge variant={s.published ? "success" : "warn"}>
                              {s.published ? "Live" : "Draft"}
                            </Badge>
                            {canEditBoard && (
                              <button
                                type="button"
                                className="ml-1 text-[10px] text-danger"
                                onClick={() => {
                                  remove(s.id);
                                  persist();
                                }}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}
                        {canEditBoard && (
                          <Button size="sm" variant="ghost" onClick={() => addOn(person.id, d)}>
                            Add
                          </Button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {staff.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            No staff on this entity’s board yet. Add people in Users, then drop shifts here. Boards
            stay empty until you do.
          </p>
        )}
        {canEditBoard && otherStaff.length > 0 && (
          <div className="mt-4 rounded-xl border border-dashed border-border p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Other entity — needs grant
            </p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Drag onto a day to place them on {opName(boardEntity)}. Without a grant, venue admin
              must opt in (same idea as an extra table).
            </p>
            <ul className="flex flex-wrap gap-2">
              {otherStaff.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/staff", p.id);
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    className="rounded-lg border border-border bg-surface px-2 py-1 text-xs"
                  >
                    {p.name} · {opName(p.operatorId || HOST_SCOPE)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {grantFor && (
        <GrantEntityShiftDialog
          open
          onOpenChange={(o) => {
            if (!o) setGrantFor(null);
          }}
          employeeId={grantFor.employeeId}
          workOperatorId={boardEntity}
          workName={opName(boardEntity)}
          onGranted={() => {
            const day = grantFor.day;
            const id = grantFor.employeeId;
            setGrantFor(null);
            addOn(id, day);
          }}
        />
      )}
    </div>
  );
}
