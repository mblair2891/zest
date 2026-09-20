import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE, canEditSchedule, canViewSchedule, isHostPrivileged } from "@/lib/access/entity-grants";
import { addDays, formatDayLabel, startOfWeek, weekDays, sameDay } from "@/lib/labor/week";
import { computePayPeriod, parseLaborRules } from "@/lib/labor/rules";
import {
  canPlaceEmployeeOnEntityBoard,
  defaultScheduleEntity,
  scheduleEntityIds,
} from "@/lib/labor/schedule-entity";
import type { ScheduledShift } from "@/lib/pos/ops-types";
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
  const copyWeek = useOpsStore((s) => s.copyWeek);
  const labor = useOpsStore((s) => s.labor);
  const laborByEntity = useOpsStore((s) => s.laborByEntity);
  const floorSections = usePosStore((s) => s.floorSections);
  const [gridMode, setGridMode] = useState<"week" | "period">("week");
  const [editId, setEditId] = useState<string | null>(null);
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
  const demoScope = usePosStore((s) =>
    s.settings.isDemo || s.settings.demoIsolated ? s.demoOperatingEntityId : null,
  );

  const entityKey = entityIds.join(",");
  useEffect(() => {
    if (demoScope && entityKey.split(",").includes(demoScope)) setBoardEntity(demoScope);
  }, [demoScope, entityKey]);
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
          station: r.station,
          section: r.section,
          breakMinutes: r.breakMinutes,
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

  const period = computePayPeriod(
    weekStart + 3 * 86_400_000,
    parseLaborRules(laborByEntity[boardEntity] ?? labor),
  );
  const days =
    gridMode === "period"
      ? Array.from(
          { length: Math.max(1, Math.ceil((period.end - period.start) / 86_400_000)) },
          (_, i) => period.start + i * 86_400_000,
        ).filter((d) => d < period.end)
      : weekDays(weekStart);
  const canEditBoard = !floor && canEditSchedule(emp, grants, boardEntity, hostEdit, peer);

  const persist = () => {
    if (isProspectDemo() || !orgId || !locId) return;
    const from = days[0] ?? weekStart;
    const to = (days[days.length - 1] ?? weekStart) + 86_400_000;
    const payload = useOpsStore
      .getState()
      .shifts.filter(
        (s) => s.operatorId === boardEntity && s.start >= from && s.start < to,
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
          <>
            <select
              className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
              value={gridMode}
              onChange={(e) => setGridMode(e.target.value as "week" | "period")}
              aria-label="Grid"
            >
              <option value="week">Week</option>
              <option value="period">Pay period</option>
            </select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const n = copyWeek(addDays(weekStart, -7), weekStart, boardEntity);
                persist();
                void n;
              }}
              disabled={!canEditBoard}
            >
              Copy last week
            </Button>
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
          </>
        )}
        <p className="text-[11px] text-muted-foreground">
          Unpublished drafts do not appear on the clock. Publish does not merge the other entity’s calendar.
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
                          <ShiftCard
                            key={s.id}
                            shift={s}
                            canEdit={canEditBoard}
                            editing={editId === s.id}
                            sections={floorSections}
                            onToggle={() => setEditId(editId === s.id ? null : s.id)}
                            onSave={(next) => {
                              upsert({ ...s, ...next, operatorId: boardEntity });
                              setEditId(null);
                              persist();
                            }}
                            onRemove={() => {
                              remove(s.id);
                              persist();
                            }}
                          />
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

function hm(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function applyHm(day: number, value: string): number {
  const [h, m] = value.split(":").map((n) => Number(n));
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return d.getTime();
}

function ShiftCard({
  shift,
  canEdit,
  editing,
  sections,
  onToggle,
  onSave,
  onRemove,
}: {
  shift: ScheduledShift;
  canEdit: boolean;
  editing: boolean;
  sections: Array<{ id: string; name: string }>;
  onToggle: () => void;
  onSave: (next: Partial<ScheduledShift>) => void;
  onRemove: () => void;
}) {
  const day = new Date(shift.start);
  day.setHours(0, 0, 0, 0);
  const dayMs = day.getTime();
  const [start, setStart] = useState(hm(shift.start));
  const [end, setEnd] = useState(hm(shift.end));
  const [station, setStation] = useState(shift.station ?? "");
  const [section, setSection] = useState(shift.section ?? "");
  const [brk, setBrk] = useState(String(shift.breakMinutes ?? 0));
  const [role, setRole] = useState(shift.role ?? "");
  return (
    <div
      className="mb-1 rounded-lg border border-border bg-surface px-1.5 py-1"
      draggable={canEdit && !editing}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/shift", shift.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <button type="button" className="w-full text-left" onClick={onToggle}>
        <p className="tabular">
          {formatTime(shift.start)}–{formatTime(shift.end)}
        </p>
        {(shift.station || shift.section) && (
          <p className="text-[10px] text-muted-foreground">
            {[shift.station, shift.section].filter(Boolean).join(" · ")}
          </p>
        )}
        <Badge variant={shift.published ? "success" : "warn"}>
          {shift.published ? "Live" : "Draft"}
        </Badge>
      </button>
      {editing && canEdit && (
        <div className="mt-1 space-y-1">
          <label className="block text-[10px] text-muted-foreground">
            Start
            <input
              type="time"
              className="mt-0.5 h-7 w-full rounded border border-border bg-bg px-1 text-xs"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="block text-[10px] text-muted-foreground">
            End
            <input
              type="time"
              className="mt-0.5 h-7 w-full rounded border border-border bg-bg px-1 text-xs"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <label className="block text-[10px] text-muted-foreground">
            Role
            <input
              className="mt-0.5 h-7 w-full rounded border border-border bg-bg px-1 text-xs"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
          </label>
          <label className="block text-[10px] text-muted-foreground">
            Station
            <input
              className="mt-0.5 h-7 w-full rounded border border-border bg-bg px-1 text-xs"
              value={station}
              onChange={(e) => setStation(e.target.value)}
              placeholder="optional"
            />
          </label>
          <label className="block text-[10px] text-muted-foreground">
            Section
            <select
              className="mt-0.5 h-7 w-full rounded border border-border bg-bg px-1 text-xs"
              value={section}
              onChange={(e) => setSection(e.target.value)}
            >
              <option value="">None</option>
              {sections.map((sec) => (
                <option key={sec.id} value={sec.name}>
                  {sec.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[10px] text-muted-foreground">
            Break (min)
            <input
              type="number"
              min={0}
              className="mt-0.5 h-7 w-full rounded border border-border bg-bg px-1 text-xs"
              value={brk}
              onChange={(e) => setBrk(e.target.value)}
            />
          </label>
          <div className="flex gap-1">
            <Button
              size="sm"
              onClick={() =>
                onSave({
                  start: applyHm(dayMs, start),
                  end: applyHm(dayMs, end),
                  station: station.trim() || undefined,
                  section: section.trim() || undefined,
                  breakMinutes: parseInt(brk, 10) || 0,
                  role: role.trim() || undefined,
                })
              }
            >
              Save
            </Button>
            <button type="button" className="text-[10px] text-danger" onClick={onRemove}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
