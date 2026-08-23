import { useMemo, useState } from "react";
import {
  Users,
  ArrowRightLeft,
  Sparkles,
  Plus,
  Combine,
  Split,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { useSaasStore } from "@/lib/pos/saas-store";
import type { Table, TableStatus } from "@/lib/pos/types";
import { cn, formatCurrency, formatTime } from "@/lib/utils";
import { computeTotals } from "@/lib/pos/calculations";
import {
  activeGrantForTable,
  policyOf,
  roleIsLocked,
  sectionColorForTable,
  swatchCss,
} from "@/lib/pos/section-control";
import { SectionAccessDialog } from "./GrantTableDialog";

const STATUS_META: Record<
  TableStatus,
  {
    label: string;
    className: string;
    badge:
      | "secondary"
      | "info"
      | "warn"
      | "success"
      | "danger"
      | "default";
  }
> = {
  available: {
    label: "Open",
    className: "bg-table-available border-border",
    badge: "secondary",
  },
  seated: {
    label: "Seated",
    className: "bg-table-seated border-info/40",
    badge: "info",
  },
  ordering: {
    label: "Ordering",
    className: "bg-table-ordering border-warn/40",
    badge: "warn",
  },
  ordered: {
    label: "Fired",
    className: "bg-table-ordered border-success/40",
    badge: "success",
  },
  check: {
    label: "Check",
    className: "bg-table-check border-warn/50",
    badge: "warn",
  },
  paid: {
    label: "Paid",
    className: "bg-table-paid border-border-strong",
    badge: "default",
  },
  reserved: { label: "Reserved", className: "border-info/40 bg-info/10", badge: "info" },
  dirty: {
    label: "Dirty",
    className: "bg-table-dirty border-danger/40",
    badge: "danger",
  },
};

export function FloorView() {
  const tables = usePosStore((s) => s.tables);
  const orders = usePosStore((s) => s.orders);
  const employees = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const selectTable = usePosStore((s) => s.selectTable);
  const seatTable = usePosStore((s) => s.seatTable);
  const markClean = usePosStore((s) => s.markClean);
  const clearTable = usePosStore((s) => s.clearTable);
  const transferTable = usePosStore((s) => s.transferTable);
  const mergeTables = usePosStore((s) => s.mergeTables);
  const unmergeTable = usePosStore((s) => s.unmergeTable);
  const openBarTab = usePosStore((s) => s.openBarTab);
  const setView = usePosStore((s) => s.setView);
  const tableAccess = usePosStore((s) => s.tableAccess);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const floorSections = usePosStore((s) => s.floorSections);
  const extraTableGrants = usePosStore((s) => s.extraTableGrants);
  const loc = usePlatformStore((s) => s.locations.find((l) => l.id === s.activeLocationId) ?? s.locations[0] ?? null);
  const saasLoc = useSaasStore((s) => {
    const id = s.activeLocationId;
    return s.locations.find((l) => l.id === id) ?? null;
  });
  const foodUpUntil = useNotifyStore((s) => s.foodUpUntil);
  const clock = usePosStore((s) => s.clock);

  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const policy = policyOf(settings.sectionPolicy);
  const locked = emp ? roleIsLocked(emp.role, policy) : false;

  const [seatOpen, setSeatOpen] = useState(false);
  const [seatTarget, setSeatTarget] = useState<Table | null>(null);
  const [guests, setGuests] = useState(2);
  const [transferMode, setTransferMode] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergePrimary, setMergePrimary] = useState<string | null>(null);
  const [tabName, setTabName] = useState("");
  const [tabOpen, setTabOpen] = useState(false);
  const [section, setSection] = useState<string>("All");
  const [blockTable, setBlockTable] = useState<Table | null>(null);
  const [blockReason, setBlockReason] = useState("");

  const sectionTabs = useMemo(() => {
    const defined = [...floorSections].sort((a, b) => a.sort - b.sort);
    const names = new Set(defined.map((s) => s.name));
    for (const t of tables) {
      if (t.section && !names.has(t.section)) {
        defined.push({
          id: `orphan_${t.section}`,
          name: t.section,
          color: "sec-1",
          sort: 99,
        });
        names.add(t.section);
      }
    }
    return defined;
  }, [floorSections, tables]);

  const showMine = locked && (emp?.homeSectionIds?.length ?? 0) > 0;

  const visible = tables.filter((t) => {
    if (t.mergedIntoId) return false;
    if (section !== "All" && section !== "Mine") {
      if (t.section !== section) return false;
    }
    if (section === "Mine" && emp) {
      const acc = tableAccess(t.id, "order");
      if (!(acc.ok && !acc.viewOnly) && acc.code !== "grant") return false;
    }
    if (policy.hideUnassignedSections && locked && emp) {
      const acc = tableAccess(t.id, "order");
      const granted = !!activeGrantForTable(extraTableGrants, emp.id, t.id);
      if (!acc.ok && !granted) return false;
    }
    return true;
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of tables.filter((x) => !x.mergedIntoId))
      c[t.status] = (c[t.status] ?? 0) + 1;
    return c;
  }, [tables]);

  const showBlocked = (t: Table, reason: string) => {
    setBlockTable(t);
    setBlockReason(reason);
  };

  const onTableClick = (t: Table) => {
    if (mergeMode) {
      if (!mergePrimary) {
        setMergePrimary(t.id);
        return;
      }
      if (t.id === mergePrimary) {
        setMergePrimary(null);
        return;
      }
      const res = mergeTables(mergePrimary, t.id);
      if (!res.ok) alert(res.error);
      setMergePrimary(null);
      setMergeMode(false);
      return;
    }
    if (transferMode) {
      if (!transferFrom) {
        if (!t.orderId) {
          alert("Pick a table with an open check first");
          return;
        }
        setTransferFrom(t.id);
        return;
      }
      if (t.id === transferFrom) {
        setTransferFrom(null);
        return;
      }
      const res = transferTable(transferFrom, t.id);
      if (!res.ok) {
        if (res.access) showBlocked(t, res.error ?? "Blocked");
        else alert(res.error);
      }
      setTransferFrom(null);
      setTransferMode(false);
      return;
    }
    if (t.status === "available") {
      const access = tableAccess(t.id, "seat");
      if (!access.ok) {
        showBlocked(t, access.reason ?? "Outside your section");
        return;
      }
      setSeatTarget(t);
      setGuests(Math.min(t.seats, 2));
      setSeatOpen(true);
      return;
    }
    if (t.status === "dirty") {
      markClean(t.id);
      return;
    }
    if (t.status === "paid") {
      clearTable(t.id);
      return;
    }
    const res = selectTable(t.id);
    if (!res.ok) {
      showBlocked(t, res.error ?? "Outside your section");
    }
  };

  const confirmSeat = () => {
    if (!seatTarget) return;
    const res = seatTable(seatTarget.id, guests);
    if (!res.ok) {
      setSeatOpen(false);
      showBlocked(seatTarget, res.error ?? "Cannot seat");
      return;
    }
    setSeatOpen(false);
    setSeatTarget(null);
  };

  if (tables.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-medium">No floor plan</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This location has no tables yet. Onboard a host location in SaaS or
          add tables in the floor editor.
        </p>
        <Button onClick={() => setView("takeout")}>Takeout / pickup</Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="mr-2 text-sm font-semibold">
          Floor · {saasLoc?.code ?? loc?.code ?? settings.name}
        </h2>
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={section === "All" ? "default" : "outline"}
            onClick={() => setSection("All")}
          >
            All
          </Button>
          {showMine && (
            <Button
              size="sm"
              variant={section === "Mine" ? "default" : "outline"}
              onClick={() => setSection("Mine")}
            >
              Mine
            </Button>
          )}
          {sectionTabs.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={section === s.name ? "default" : "outline"}
              onClick={() => setSection(s.name)}
              className="gap-1.5"
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: swatchCss(s.color) }}
              />
              {s.name}
            </Button>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap gap-1.5">
          {(
            [
              "available",
              "seated",
              "ordering",
              "ordered",
              "check",
              "paid",
              "dirty",
            ] as TableStatus[]
          ).map((st) => (
            <Badge key={st} variant={STATUS_META[st].badge} className="tabular">
              {STATUS_META[st].label} {counts[st] ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[280px] flex-1 overflow-auto p-3">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-4xl rounded-2xl border border-border bg-surface">
            <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>Dining room</span>
              <span>Bar →</span>
            </div>
            {visible.map((t) => {
              const order = orders.find((o) => o.id === t.orderId);
              const totals = order ? computeTotals(order, settings) : null;
              const server = employees.find((e) => e.id === t.serverId);
              const meta = STATUS_META[t.status];
              const merged =
                (t.mergedChildIds?.length ?? 0) > 0
                  ? `+${t.mergedChildIds!.length}`
                  : "";
              const foodUp =
                (foodUpUntil[t.label.replace(/^T/i, "").trim().toLowerCase()] ??
                  0) > clock ||
                (foodUpUntil[t.label.trim().toLowerCase()] ?? 0) > clock;
              const secColor = sectionColorForTable(t, floorSections);
              const orderAcc = tableAccess(t.id, "order");
              const seatAcc = tableAccess(t.id, "seat");
              const outOfSection =
                locked &&
                !orderAcc.ok &&
                orderAcc.code !== "view_only" &&
                !seatAcc.ok;
              const grant =
                emp && activeGrantForTable(extraTableGrants, emp.id, t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTableClick(t)}
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.w}%`,
                    height: `${t.h}%`,
                    boxShadow: `inset 0 3px 0 0 ${secColor}`,
                  }}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 p-1 text-center transition hover:brightness-110 active:scale-[0.98]",
                    t.shape === "round" || t.shape === "bar"
                      ? "rounded-full"
                      : "rounded-xl",
                    meta.className,
                    (transferFrom === t.id || mergePrimary === t.id) &&
                      "ring-2 ring-primary",
                    (t.mergedChildIds?.length ?? 0) > 0 && "border-info/60",
                    foodUp && "ring-2 ring-primary animate-pulse",
                    outOfSection && "opacity-55",
                  )}
                >
                  <span className="text-sm font-semibold tabular leading-none">
                    {t.label}
                    {merged}
                  </span>
                  {foodUp && (
                    <span className="mt-0.5 rounded bg-primary px-1 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
                      Up
                    </span>
                  )}
                  {grant && (
                    <span className="mt-0.5 rounded bg-info px-1 text-[9px] font-bold uppercase tracking-wide text-info-foreground">
                      Grant
                    </span>
                  )}
                  {outOfSection && t.status === "available" && (
                    <Lock className="mt-0.5 h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="mt-0.5 text-[10px] text-muted-foreground">
                    {t.seats} top
                  </span>
                  {totals && (
                    <span className="mt-0.5 text-[10px] font-medium tabular">
                      {formatCurrency(totals.balanceCents || totals.totalCents)}
                    </span>
                  )}
                  {server && (
                    <span
                      className="mt-1 h-1.5 w-1.5 rounded-full"
                      style={{ background: server.color }}
                      title={server.name}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {mergeMode
              ? mergePrimary
                ? "Tap second table to merge"
                : "Tap primary table, then secondary"
              : transferMode
                ? transferFrom
                  ? "Tap destination table"
                  : "Tap table with a check to move"
                : locked
                  ? "Color bar = section · locked tables need a grant"
                  : "Seat · bus · transfer · merge/split · floor editor"}
          </p>
        </div>

        <aside className="w-full shrink-0 border-t border-border bg-surface lg:w-72 lg:border-l lg:border-t-0">
          <div className="space-y-3 p-3">
            <Button
              className="w-full"
              size="lg"
              onClick={() => setTabOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Open bar tab
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              onClick={() => setView("takeout")}
            >
              Takeout / pickup
            </Button>
            <Button
              className="w-full"
              variant={transferMode ? "default" : "outline"}
              size="lg"
              onClick={() => {
                setMergeMode(false);
                setMergePrimary(null);
                setTransferMode((m) => !m);
                setTransferFrom(null);
              }}
            >
              <ArrowRightLeft className="h-4 w-4" />
              {transferMode ? "Cancel transfer" : "Transfer table"}
            </Button>
            <Button
              className="w-full"
              variant={mergeMode ? "default" : "outline"}
              size="lg"
              onClick={() => {
                setTransferMode(false);
                setTransferFrom(null);
                setMergeMode((m) => !m);
                setMergePrimary(null);
              }}
            >
              <Combine className="h-4 w-4" />
              {mergeMode ? "Cancel merge" : "Merge tables"}
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              onClick={() => {
                const merged = tables.find(
                  (t) => (t.mergedChildIds?.length ?? 0) > 0,
                );
                if (merged) {
                  const res = unmergeTable(merged.id);
                  if (!res.ok) alert(res.error);
                } else {
                  alert("No merged tables");
                }
              }}
            >
              <Split className="h-4 w-4" />
              Unmerge
            </Button>
            <Button
              className="w-full"
              variant="outline"
              size="sm"
              onClick={() => setView("floor_editor")}
            >
              Floor editor
            </Button>

            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sections
              </p>
              <ul className="space-y-1.5 text-xs">
                {sectionTabs.map((s) => {
                  const assigned = employees.filter(
                    (e) =>
                      e.active &&
                      e.clockedIn &&
                      (e.homeSectionIds ?? []).includes(s.id),
                  );
                  return (
                    <li key={s.id} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: swatchCss(s.color) }}
                      />
                      <span className="font-medium">{s.name}</span>
                      <span className="truncate text-muted-foreground">
                        {assigned.length
                          ? assigned.map((e) => e.name.split(" ")[0]).join(", ")
                          : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {emp && locked && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  You:{" "}
                  {floorSections
                    .filter((s) => (emp.homeSectionIds ?? []).includes(s.id))
                    .map((s) => s.name)
                    .join(", ") || "no section"}
                  {extraTableGrants.some((g) => g.employeeId === emp.id)
                    ? " + extra table"
                    : ""}
                </p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Occupied
              </p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {tables
                  .filter((t) => t.orderId && !t.mergedIntoId)
                  .map((t) => {
                    const o = orders.find((x) => x.id === t.orderId);
                    if (!o) return null;
                    const tot = computeTotals(o, settings);
                    const color = sectionColorForTable(t, floorSections);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => onTableClick(t)}
                        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2 px-2.5 py-2 text-left text-sm hover:border-border-strong"
                      >
                        <span>
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: color }}
                            />
                            T{t.label}
                          </span>
                          {(t.mergedChildIds?.length ?? 0) > 0 && (
                            <span className="ml-1 text-[10px] text-info">
                              merged
                            </span>
                          )}
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {t.guestCount} guests ·{" "}
                            {t.seatedAt ? formatTime(t.seatedAt) : "—"}
                          </span>
                        </span>
                        <span className="tabular text-sm font-medium">
                          {formatCurrency(tot.balanceCents || tot.totalCents)}
                        </span>
                      </button>
                    );
                  })}
                {tables.every((t) => !t.orderId) && (
                  <p className="py-4 text-center text-xs text-muted-foreground">
                    No seated tables
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-border bg-bg p-3 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Happy hour {settings.happyHourStart}:00–
                {settings.happyHourEnd}:00. Auto-grat{" "}
                {Math.round(settings.autoGratPercent * 100)}% for{" "}
                {settings.autoGratPartySize}+.
              </p>
            </div>
          </div>
        </aside>
      </div>

      <Dialog open={seatOpen} onOpenChange={setSeatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Seat table {seatTarget?.label}
              {seatTarget && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  {seatTarget.section}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm text-muted-foreground">
                Party size
              </label>
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  { length: seatTarget?.seats ?? 8 },
                  (_, i) => i + 1,
                ).map((n) => (
                  <Button
                    key={n}
                    size="touch"
                    variant={guests === n ? "default" : "outline"}
                    onClick={() => setGuests(n)}
                    className="tabular"
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeatOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmSeat}>
              <Users className="h-4 w-4" />
              Seat party
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tabOpen} onOpenChange={setTabOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open bar tab</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Guest name"
            value={tabName}
            onChange={(e) => setTabName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTabOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!tabName.trim()}
              onClick={() => {
                openBarTab(tabName.trim());
                setTabName("");
                setTabOpen(false);
              }}
            >
              Open tab
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SectionAccessDialog
        table={blockTable}
        reason={blockReason}
        open={!!blockTable}
        onOpenChange={(o) => {
          if (!o) setBlockTable(null);
        }}
        onResolved={(t) => {
          if (t.status === "available") {
            setSeatTarget(t);
            setGuests(Math.min(t.seats, 2));
            setSeatOpen(true);
          } else {
            selectTable(t.id);
          }
        }}
      />
    </div>
  );
}
