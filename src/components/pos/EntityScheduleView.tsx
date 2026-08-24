import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOpsStore } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE, canEditSchedule, canViewSchedule, isHostPrivileged } from "@/lib/access/entity-grants";
import { addDays, formatDayLabel, startOfWeek, weekDays, sameDay } from "@/lib/labor/week";
import { formatTime } from "@/lib/utils";
import { isFloorRole } from "@/lib/pos/pin";
import { isProspectDemo } from "@/lib/demo/session";
import { saveShiftsFn } from "@/lib/labor/api";
import { useSaasStore } from "@/lib/pos/saas-store";

export function EntityScheduleView() {
  const employees = usePosStore((s) => s.employees);
  const vendors = usePosStore((s) => s.vendors);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const grants = usePosStore((s) => s.entityPermissions);
  const settings = usePosStore((s) => s.settings);
  const sessionKind = usePosStore((s) => s.sessionKind);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const orgId = useSaasStore((s) => s.org.id);
  const shifts = useOpsStore((s) => s.shifts);
  const upsert = useOpsStore((s) => s.upsertShift);
  const remove = useOpsStore((s) => s.removeShift);
  const publish = useOpsStore((s) => s.publishWeek);
  const seedWeek = useOpsStore((s) => s.seedWeekShifts);
  const hostEdit = Boolean(settings.hostMayEditEntitySchedules);
  const floor = sessionKind === "pin" && isFloorRole(emp?.role);
  const [weekStart, setWeekStart] = useState(() => startOfWeek());
  const [filterOp, setFilterOp] = useState<string>(
    isHostPrivileged(emp) ? "" : emp?.operatorId || HOST_SCOPE,
  );

  useEffect(() => {
    seedWeek(employees.filter((e) => e.active).map((e) => ({ id: e.id, operatorId: e.operatorId })));
  }, [employees, seedWeek]);

  const opName = (id: string) =>
    id === HOST_SCOPE ? settings.name || "Host" : vendors.find((v) => v.id === id)?.shortName ?? id;

  const staff = useMemo(() => {
    return employees.filter((e) => {
      if (!e.active) return false;
      if (floor) return e.id === emp?.id;
      const op = e.operatorId || HOST_SCOPE;
      if (filterOp && op !== filterOp) return false;
      return canViewSchedule(emp, grants, op);
    });
  }, [employees, floor, emp, filterOp, grants]);

  const days = weekDays(weekStart);

  const persist = () => {
    if (isProspectDemo() || !orgId || !locId) return;
    const weekEnd = addDays(weekStart, 7);
    const payload = useOpsStore
      .getState()
      .shifts.filter((s) => s.start >= weekStart && s.start < weekEnd);
    void saveShiftsFn({
      data: { orgId, locationId: locId, shifts: payload },
    }).catch(() => undefined);
  };

  const addOn = (employeeId: string, day: number) => {
    const person = employees.find((e) => e.id === employeeId);
    const op = person?.operatorId || HOST_SCOPE;
    if (!canEditSchedule(emp, grants, op, hostEdit)) return;
    const start = day + 11 * 3600000;
    upsert({
      employeeId,
      operatorId: op,
      start,
      end: start + 8 * 3600000,
      published: false,
      role: person?.role,
      locationId: locId,
    });
    persist();
  };

  return (
    <div className="flex h-full flex-col" data-demo="schedule">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">
          {floor ? "My shifts" : "Schedule"}
        </h2>
        <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground">{formatDayLabel(weekStart)}</span>
        <Button size="icon" variant="outline" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        {!floor && isHostPrivileged(emp) && vendors.length > 0 && (
          <select
            className="h-8 rounded-md border border-border bg-bg px-2 text-xs"
            value={filterOp}
            onChange={(e) => setFilterOp(e.target.value)}
          >
            <option value="">All entities</option>
            <option value={HOST_SCOPE}>{settings.name || "Host"}</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.shortName}
              </option>
            ))}
          </select>
        )}
        {!floor && (
          <Button
            size="sm"
            onClick={() => {
              publish(weekStart, filterOp || null);
              persist();
            }}
          >
            Publish week
          </Button>
        )}
        {isHostPrivileged(emp) && !hostEdit && (
          <Badge variant="secondary">Guest schedules view-only</Badge>
        )}
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
              const op = person.operatorId || HOST_SCOPE;
              const canEdit = !floor && canEditSchedule(emp, grants, op, hostEdit);
              return (
                <tr key={person.id} className="border-t border-border">
                  <td className="sticky left-0 bg-bg px-2 py-2">
                    <p className="font-medium">{person.name}</p>
                    <p className="text-muted-foreground">{opName(op)}</p>
                  </td>
                  {days.map((d) => {
                    const cell = shifts.filter(
                      (s) => s.employeeId === person.id && sameDay(s.start, d),
                    );
                    return (
                      <td key={d} className="px-1 py-1 align-top">
                        {cell.map((s) => (
                          <div
                            key={s.id}
                            className="mb-1 rounded-lg border border-border bg-surface px-1.5 py-1"
                          >
                            <p className="tabular">
                              {formatTime(s.start)}–{formatTime(s.end)}
                            </p>
                            <Badge variant={s.published ? "success" : "warn"}>
                              {s.published ? "Live" : "Draft"}
                            </Badge>
                            {canEdit && (
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
                        {canEdit && (
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
          <p className="p-4 text-sm text-muted-foreground">No staff in this entity.</p>
        )}
      </div>
    </div>
  );
}
