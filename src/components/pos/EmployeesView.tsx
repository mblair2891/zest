import { useMemo, useState } from "react";
import { MapPinned, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatTime } from "@/lib/utils";
import {
  canManageSections,
  policyOf,
  roleIsLocked,
  swatchCss,
} from "@/lib/pos/section-control";
import { staffTitle } from "@/lib/pos/rbac";
import { GrantTableDialog } from "./GrantTableDialog";

export function EmployeesView() {
  const employees = usePosStore((s) => s.employees);
  const clockToggle = usePosStore((s) => s.clockToggle);
  const currentId = usePosStore((s) => s.currentEmployeeId);
  const floorSections = usePosStore((s) => s.floorSections);
  const extraTableGrants = usePosStore((s) => s.extraTableGrants);
  const tables = usePosStore((s) => s.tables);
  const assignEmployeeSections = usePosStore((s) => s.assignEmployeeSections);
  const revokeExtraTable = usePosStore((s) => s.revokeExtraTable);
  const settings = usePosStore((s) => s.settings);
  const current = employees.find((e) => e.id === currentId) ?? null;
  const manage = canManageSections(current?.role);
  const policy = policyOf(settings.sectionPolicy);
  const [grantFor, setGrantFor] = useState<string | null>(null);

  const roster = useMemo(
    () =>
      [...floorSections]
        .sort((a, b) => a.sort - b.sort)
        .map((sec) => ({
          sec,
          staff: employees.filter(
            (e) =>
              e.active && (e.homeSectionIds ?? []).includes(sec.id),
          ),
          tableCount: tables.filter(
            (t) =>
              !t.mergedIntoId &&
              t.section.toLowerCase() === sec.name.toLowerCase(),
          ).length,
        })),
    [floorSections, employees, tables],
  );

  const toggleSection = (employeeId: string, sectionId: string) => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    const cur = emp.homeSectionIds ?? [];
    const next = cur.includes(sectionId)
      ? cur.filter((id) => id !== sectionId)
      : [...cur, sectionId];
    assignEmployeeSections(employeeId, next);
  };

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Staff, clock & sections</h2>
        <Badge variant="secondary" className="tabular">
          {employees.filter((e) => e.clockedIn).length} on clock
        </Badge>
        {manage && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => setGrantFor(currentId ?? "")}
          >
            <Plus className="h-3.5 w-3.5" />
            Grant extra table
          </Button>
        )}
      </div>

      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {roster.map(({ sec, staff, tableCount }) => (
          <div
            key={sec.id}
            className="rounded-2xl border border-border bg-surface p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ background: swatchCss(sec.color) }}
              />
              <p className="text-sm font-medium">{sec.name}</p>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {tableCount} tables
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {staff.length === 0
                ? "Unassigned"
                : staff.map((e) => e.name.split(" ")[0]).join(", ")}
            </p>
          </div>
        ))}
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {policy.serversCannotOrderOutsideSection
          ? "Servers cannot enter orders or seat tables outside their assigned section unless a manager grants a single table for the shift or that seating."
          : "Section colors show on the floor. Order limits are currently off in Settings."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {employees
          .filter((e) => e.active)
          .map((e) => {
            const grants = extraTableGrants.filter((g) => g.employeeId === e.id);
            const locked = roleIsLocked(e.role, policy);
            return (
              <div
                key={e.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className="mt-1 h-3 w-3 shrink-0 rounded-full"
                    style={{ background: e.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {e.name}
                      {e.id === currentId && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {staffTitle(e)} · PIN {e.pin}
                      {locked && " · section-limited"}
                    </p>
                  </div>
                  <Badge variant={e.clockedIn ? "success" : "secondary"}>
                    {e.clockedIn ? "In" : "Out"}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    Clocked
                    <span className="block text-sm text-foreground">
                      {e.clockedIn && e.clockInAt
                        ? formatTime(e.clockInAt)
                        : "—"}
                    </span>
                  </div>
                  <div>
                    Tips today
                    <span className="block text-sm tabular text-foreground">
                      {formatCurrency(e.tipsEarned)}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <MapPinned className="h-3 w-3" />
                    Sections
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {floorSections.length === 0 && (
                      <span className="text-xs text-muted-foreground">
                        No sections defined
                      </span>
                    )}
                    {floorSections.map((sec) => {
                      const on = (e.homeSectionIds ?? []).includes(sec.id);
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          disabled={!manage}
                          onClick={() => toggleSection(e.id, sec.id)}
                          className={
                            on
                              ? "inline-flex h-8 items-center gap-1.5 rounded-full border border-primary bg-primary px-2.5 text-xs text-primary-foreground disabled:opacity-70"
                              : "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-transparent px-2.5 text-xs text-foreground disabled:opacity-70"
                          }
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: swatchCss(sec.color) }}
                          />
                          {sec.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {grants.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {grants.map((g) => {
                      const t = tables.find((x) => x.id === g.tableId);
                      return (
                        <li
                          key={g.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-bg px-2 py-1 text-[11px]"
                        >
                          <span>
                            Extra · {t?.label ?? g.tableId} · {g.scope}
                            {g.reason ? ` · ${g.reason}` : ""}
                          </span>
                          {manage && (
                            <button
                              type="button"
                              className="text-danger"
                              onClick={() => revokeExtraTable(g.id)}
                            >
                              Revoke
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-3 flex gap-2">
                  <Button
                    className="flex-1"
                    variant={e.clockedIn ? "outline" : "default"}
                    onClick={() => clockToggle(e.id)}
                  >
                    {e.clockedIn ? "Clock out" : "Clock in"}
                  </Button>
                  {manage && (
                    <Button
                      variant="outline"
                      onClick={() => setGrantFor(e.id)}
                    >
                      Grant
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      <GrantTableDialog
        key={grantFor ?? "closed"}
        open={grantFor !== null}
        onOpenChange={(o) => {
          if (!o) setGrantFor(null);
        }}
        defaultEmployeeId={grantFor ?? undefined}
      />
    </div>
  );
}
