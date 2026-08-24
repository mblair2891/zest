import { useMemo, useState } from "react";
import {
  Users,
  ArrowRightLeft,
  Sparkles,
  Plus,
  Combine,
  Split,
  Lock,
  QrCode,
  Pencil,
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
import type { Table } from "@/lib/pos/types";
import {
  FLOOR_PIPELINE,
  FLOOR_STATUS_LABEL,
  canChangeTableStatus,
  canEditFloorplan,
  canSeatTable,
  contrastInk,
  isEmptyTable,
  normalizeTableStatus,
  parseFloorStatusConfig,
  tableFlash,
  type FloorPipelineStatus,
} from "@/lib/pos/floor-status";
import { QR_MODE_LABEL, parseQrMode, tableGuestPath } from "@/lib/pos/qr-table";
import { getDemoType } from "@/lib/demo/session";
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
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { QrMark } from "./QrMark";
import { canAccessView } from "@/lib/pos/rbac";

function pipelineLabel(status: string): string {
  const n = normalizeTableStatus(status);
  if (n === "reserved") return "Reserved";
  return FLOOR_STATUS_LABEL[n];
}

export function FloorView() {
  const tables = usePosStore((s) => s.tables);
  const orders = usePosStore((s) => s.orders);
  const employees = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const selectTable = usePosStore((s) => s.selectTable);
  const seatTable = usePosStore((s) => s.seatTable);
  const markClean = usePosStore((s) => s.markClean);
  const transferTable = usePosStore((s) => s.transferTable);
  const mergeTables = usePosStore((s) => s.mergeTables);
  const unmergeTable = usePosStore((s) => s.unmergeTable);
  const openBarTab = usePosStore((s) => s.openBarTab);
  const setView = usePosStore((s) => s.setView);
  const setTableStatus = usePosStore((s) => s.setTableStatus);
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
  const floorCfg = parseFloorStatusConfig(settings.floorStatusConfig);
  const qrMode = parseQrMode(settings.qrMode);
  const demoType = getDemoType();
  const canStatus = canChangeTableStatus(emp?.role, floorCfg);
  const canSeat = canSeatTable(emp?.role, floorCfg);
  const canEdit = canEditFloorplan(emp?.role) && canAccessView(emp?.role ?? "server", "floor_editor");
  const isHostStand = emp?.role === "host";

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
  const [detail, setDetail] = useState<Table | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  const detailLive = detail
    ? (tables.find((t) => t.id === detail.id) ?? detail)
    : null;

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
    for (const t of tables.filter((x) => !x.mergedIntoId)) {
      const st = normalizeTableStatus(t.status);
      c[st] = (c[st] ?? 0) + 1;
    }
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
    setDetail(t);
  };

  const confirmSeat = () => {
    if (!seatTarget) return;
    if (!canSeat) {
      setSeatOpen(false);
      showBlocked(seatTarget, "Seating is limited to the host stand / manager");
      return;
    }
    const res = seatTable(seatTarget.id, guests);
    if (!res.ok) {
      setSeatOpen(false);
      showBlocked(seatTarget, res.error ?? "Cannot seat");
      return;
    }
    setSeatOpen(false);
    setSeatTarget(null);
    setDetail(null);
  };

  if (tables.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-lg font-medium">No floor plan</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          This location has no tables yet. Draw rooms in the floor editor, or use takeout until the room is drawn.
        </p>
        {canEdit && (
          <Button onClick={() => setView("floor_editor")}>Floor editor</Button>
        )}
        <Button variant="outline" onClick={() => setView("takeout")}>
          Takeout / pickup
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col" data-demo="floor">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="mr-2 text-sm font-semibold">
          Floor · {saasLoc?.code ?? loc?.code ?? settings.name}
        </h2>
        <GuideLearnLink topicId="floor-tables" compact>
          Learn
        </GuideLearnLink>
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
          {FLOOR_PIPELINE.filter((st) => floorCfg.enabled[st] !== false).map((st) => (
            <Badge
              key={st}
              variant="secondary"
              className="tabular"
              style={{
                background: floorCfg.colors[st],
                color: contrastInk(floorCfg.colors[st]),
              }}
            >
              {FLOOR_STATUS_LABEL[st]} {counts[st] ?? 0}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[280px] flex-1 overflow-auto p-3">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-4xl rounded-2xl border border-border bg-surface">
            <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{section === "All" || section === "Mine" ? "Dining room" : section}</span>
              <span>Bar →</span>
            </div>
            {visible.map((t) => {
              const order = orders.find((o) => o.id === t.orderId);
              const totals = order ? computeTotals(order, settings) : null;
              const server = employees.find((e) => e.id === t.serverId);
              const st = normalizeTableStatus(t.status);
              const fill =
                st === "reserved"
                  ? "#e8e6e1"
                  : floorCfg.colors[st] ?? "#ffffff";
              const ink = contrastInk(fill);
              const merged =
                (t.mergedChildIds?.length ?? 0) > 0
                  ? `+${t.mergedChildIds!.length}`
                  : "";
              const foodUp =
                (foodUpUntil[t.label.replace(/^T/i, "").trim().toLowerCase()] ??
                  0) > clock ||
                (foodUpUntil[t.label.trim().toLowerCase()] ?? 0) > clock;
              const flashing = tableFlash(t, floorCfg, clock || Date.now());
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
              const kind = t.kind ?? (t.shape === "bar" ? "barstool" : t.shape === "booth" ? "booth" : "table");
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
                    background: fill,
                    color: ink,
                    boxShadow: `inset 0 3px 0 0 ${secColor}`,
                  }}
                  className={cn(
                    "absolute flex flex-col items-center justify-center border-2 border-black/10 p-1 text-center transition hover:brightness-110 active:scale-[0.98]",
                    t.shape === "round" || t.shape === "bar" || kind === "barstool"
                      ? "rounded-full"
                      : kind === "booth"
                        ? "rounded-2xl"
                        : "rounded-xl",
                    (transferFrom === t.id || mergePrimary === t.id) &&
                      "ring-2 ring-primary",
                    (t.mergedChildIds?.length ?? 0) > 0 && "border-info/60",
                    foodUp && "ring-2 ring-primary animate-pulse",
                    flashing && "table-sla-flash",
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
                  {flashing && (
                    <span className="mt-0.5 rounded bg-danger px-1 text-[9px] font-bold uppercase tracking-wide text-danger-foreground">
                      SLA
                    </span>
                  )}
                  {grant && (
                    <span className="mt-0.5 rounded bg-info px-1 text-[9px] font-bold uppercase tracking-wide text-info-foreground">
                      Grant
                    </span>
                  )}
                  {outOfSection && isEmptyTable(t.status) && (
                    <Lock className="mt-0.5 h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="mt-0.5 text-[10px] opacity-80">
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
                  ? "Color fill = status · top bar = section · locked tables need a grant"
                  : "Tap a table for check, status, or QR · flashing = SLA"}
          </p>
        </div>

        <aside className="w-full shrink-0 border-t border-border bg-surface lg:w-72 lg:border-l lg:border-t-0">
          <div className="space-y-3 p-3">
            {isHostStand && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => setView("waitlist")}
              >
                <Users className="h-4 w-4" />
                Waitlist / host stand
              </Button>
            )}
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
            {canEdit && (
              <Button
                className="w-full"
                variant="outline"
                size="sm"
                data-demo="floor-editor-open"
                onClick={() => setView("floor_editor")}
              >
                <Pencil className="h-3.5 w-3.5" />
                Floor editor
              </Button>
            )}

            <div className="rounded-xl border border-border bg-bg p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                QR · {qrMode === "full" ? "Full" : qrMode === "hybrid" ? "Hybrid" : "Pay only"}
              </p>
              <p className="text-[11px] text-muted-foreground">{QR_MODE_LABEL[qrMode]}</p>
            </div>

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
                    const flashing = tableFlash(t, floorCfg, clock || Date.now());
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
                            {flashing && (
                              <span className="text-[10px] font-bold uppercase text-danger">
                                SLA
                              </span>
                            )}
                          </span>
                          {(t.mergedChildIds?.length ?? 0) > 0 && (
                            <span className="ml-1 text-[10px] text-info">
                              merged
                            </span>
                          )}
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {pipelineLabel(t.status)} · {t.guestCount} guests ·{" "}
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

      <Dialog
        open={!!detailLive}
        onOpenChange={(o) => {
          if (!o) {
            setDetail(null);
            setQrOpen(false);
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          {detailLive && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Table {detailLive.label}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {detailLive.section} · {detailLive.kind ?? "table"} · {detailLive.seats} top
                  </span>
                </DialogTitle>
              </DialogHeader>
              <TableDetailBody
                table={detailLive}
                order={orders.find((o) => o.id === detailLive.orderId)}
                settingsName={settings.name}
                totals={
                  detailLive.orderId
                    ? (() => {
                        const o = orders.find((x) => x.id === detailLive.orderId);
                        return o ? computeTotals(o, settings) : null;
                      })()
                    : null
                }
                floorCfg={floorCfg}
                canStatus={canStatus}
                canSeat={canSeat}
                qrMode={qrMode}
                demoType={demoType}
                qrOpen={qrOpen}
                clock={clock}
                onSeat={() => {
                  const access = tableAccess(detailLive.id, "seat");
                  if (!access.ok) {
                    showBlocked(detailLive, access.reason ?? "Outside your section");
                    return;
                  }
                  setSeatTarget(detailLive);
                  setGuests(Math.min(detailLive.seats, 2));
                  setSeatOpen(true);
                }}
                onOpenCheck={() => {
                  const res = selectTable(detailLive.id);
                  if (!res.ok) {
                    showBlocked(detailLive, res.error ?? "Outside your section");
                    return;
                  }
                  setDetail(null);
                }}
                onClean={() => {
                  markClean(detailLive.id);
                  setDetail(null);
                }}
                onStatus={(st) => {
                  const res = setTableStatus(detailLive.id, st);
                  if (!res.ok) alert(res.error);
                }}
                onToggleQr={() => setQrOpen((v) => !v)}
                onWaitlist={
                  isHostStand ? () => { setDetail(null); setView("waitlist"); } : undefined
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>

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
          if (isEmptyTable(t.status)) {
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

function TableDetailBody({
  table,
  order,
  totals,
  floorCfg,
  canStatus,
  canSeat,
  qrMode,
  demoType,
  qrOpen,
  clock,
  onSeat,
  onOpenCheck,
  onClean,
  onStatus,
  onToggleQr,
  onWaitlist,
}: {
  table: Table;
  order: { number: number; status: string } | undefined;
  totals: ReturnType<typeof computeTotals> | null;
  settingsName: string;
  floorCfg: ReturnType<typeof parseFloorStatusConfig>;
  canStatus: boolean;
  canSeat: boolean;
  qrMode: ReturnType<typeof parseQrMode>;
  demoType: string | null;
  qrOpen: boolean;
  clock: number;
  onSeat: () => void;
  onOpenCheck: () => void;
  onClean: () => void;
  onStatus: (st: FloorPipelineStatus) => void;
  onToggleQr: () => void;
  onWaitlist?: () => void;
}) {
  const st = normalizeTableStatus(table.status);
  const empty = isEmptyTable(table.status);
  const dirty = st === "closed_not_cleaned";
  const flashing = tableFlash(table, floorCfg, clock || Date.now());
  const guestPath = tableGuestPath(table, { demoType });
  const payPath = tableGuestPath(table, { pay: true, demoType });
  const enabled = FLOOR_PIPELINE.filter((s) => floorCfg.enabled[s] !== false);

  return (
    <div className="space-y-3" data-demo="table-detail">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2">
        <span className="text-sm font-medium">{pipelineLabel(table.status)}</span>
        {flashing && (
          <Badge variant="danger" className="uppercase">
            SLA flash
          </Badge>
        )}
      </div>
      {order && totals && (
        <p className="text-sm text-muted-foreground">
          Check #{order.number}
          {order.status !== "open" ? " · closed" : ""} ·{" "}
          {formatCurrency(totals.balanceCents || totals.totalCents)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {empty && canSeat && (
          <Button onClick={onSeat}>
            <Users className="h-4 w-4" />
            Seat
          </Button>
        )}
        {!empty && table.orderId && (
          <Button onClick={onOpenCheck}>Open check</Button>
        )}
        {dirty && (
          <Button variant="outline" onClick={onClean}>
            Mark cleaned
          </Button>
        )}
        {onWaitlist && (
          <Button variant="outline" onClick={onWaitlist}>
            Waitlist
          </Button>
        )}
        <Button variant="outline" onClick={onToggleQr}>
          <QrCode className="h-4 w-4" />
          {qrOpen ? "Hide QR" : "Table QR"}
        </Button>
      </div>
      {canStatus && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Set status
          </p>
          <div className="flex flex-wrap gap-1.5">
            {enabled.map((s) => (
              <Button
                key={s}
                size="sm"
                variant={st === s ? "default" : "outline"}
                onClick={() => onStatus(s)}
                style={
                  st === s
                    ? undefined
                    : { borderColor: floorCfg.colors[s], background: floorCfg.colors[s], color: contrastInk(floorCfg.colors[s]) }
                }
              >
                {FLOOR_STATUS_LABEL[s]}
              </Button>
            ))}
          </div>
        </div>
      )}
      {qrOpen && (
        <div className="rounded-xl border border-border bg-bg p-3 text-center" data-demo="table-qr">
          <p className="mb-2 text-xs text-muted-foreground">
            {QR_MODE_LABEL[qrMode]}
          </p>
          <QrMark value={typeof window === "undefined" ? guestPath : `${window.location.origin}${guestPath}`} />
          <div className="mt-2 flex flex-col gap-1.5">
            <a href={guestPath} className="text-sm underline">
              Open guest menu
            </a>
            <a href={payPath} className="text-sm underline">
              Open pay QR
            </a>
            <p className="break-all text-[11px] text-muted-foreground">{guestPath}</p>
          </div>
        </div>
      )}
    </div>
  );
}
