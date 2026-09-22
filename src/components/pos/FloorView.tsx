import { useEffect, useMemo, useRef, useState } from "react";
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
  Handshake,
  UserCheck,
  Printer,
  LogOut,
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
import { usePosStore } from "@/lib/pos/store";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { useSaasStore } from "@/lib/pos/saas-store";
import type { Employee, Order, RestaurantSettings, Table } from "@/lib/pos/types";
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
import { parseQrMode, tableGuestUrl } from "@/lib/pos/qr-table";
import { parseQrPolicy, qrPolicySummary, qrTableTents } from "@/lib/pos/qr-policy";
import { printTableTents } from "@/lib/print/from-store";
import { getDemoType } from "@/lib/demo/session";
import { toast } from "sonner";
import { cn, formatCurrency, formatTime } from "@/lib/utils";
import { NO_SECTION_RECEIPT } from "@/lib/print/from-store";
import { clusterNumbers, partyHeader, tableToken } from "@/lib/pos/table-combine";
import { displayLabel, groupMembers } from "@/lib/pos/table-groups";
import { computeDualTotals, computeTotals } from "@/lib/pos/calculations";
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
import { useStationLayout } from "@/lib/ui/station-layout";
import { barTabVisibleTables, isBarRailSeat, locationAllowsBarTabs } from "@/lib/pos/bar-tab";
import { FloorFixtureArt } from "@/components/pos/FloorFixtureArt";
import { FloorArchitectureMark } from "@/components/pos/FloorArchitectureMark";
import { FloorMapCanvas, type FloorMapItem } from "@/components/pos/FloorMapCanvas";
import { isArchitectureKind, wallEndExtensions } from "@/lib/pos/floor-architecture";
import { floorDraftBannerOn, FLOOR_DRAFT_BANNER, readFloorDraft, setFloorDraftBanner } from "@/lib/pos/live-floor";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { NotificationBell } from "@/components/pos/NotificationCenter";
import { stationCan } from "@/lib/pos/station-pin-gate";
import { NoSaleControl } from "./NoSaleControl";
import { ClockedInChip } from "./ClockedInChip";
import {
  CHECK_HOLD_LABEL,
  CHECK_HOLD_REASONS,
  CHECK_HOLDS,
  effectiveTablePipeline,
  openChecksOnTable,
  tableEmptyWithOpenCheck,
  tableIsVacant,
  type CheckHoldKind,
} from "@/lib/pos/check-integrity";

function pipelineLabel(status: string): string {
  const n = normalizeTableStatus(status);
  if (n === "reserved") return "Reserved";
  return FLOOR_STATUS_LABEL[n];
}

export function FloorView({
  hostStand = false,
  chromeActions = false,
  mapOnly = false,
  preferMine,
  onBusyNav,
}: {
  hostStand?: boolean;
  chromeActions?: boolean;
  /** Map + status only. Extra tools live on the station menu. */
  mapOnly?: boolean;
  /** My tables starts on Mine; New table / host floor starts on All. */
  preferMine?: boolean;
  /** Busy-night bar: Send returns to Floor; Add opens Menu; Pay opens Pay. */
  onBusyNav?: (dest: "floor" | "menu" | "pay") => void;
}) {
  const tables = usePosStore((s) => s.tables);
  const orders = usePosStore((s) => s.orders);
  const tickets = usePosStore((s) => s.tickets);
  const newCheckOnTable = usePosStore((s) => s.newCheckOnTable);
  const employees = usePosStore((s) => s.employees);
  const settings = usePosStore((s) => s.settings);
  const selectTable = usePosStore((s) => s.selectTable);
  const seatTable = usePosStore((s) => s.seatTable);
  const releaseTable = usePosStore((s) => s.releaseTable);
  const acceptTable = usePosStore((s) => s.acceptTable);
  const reassignTable = usePosStore((s) => s.reassignTable);
  const markClean = usePosStore((s) => s.markClean);
  const transferTable = usePosStore((s) => s.transferTable);
  const mergeTables = usePosStore((s) => s.mergeTables);
  const combineTables = usePosStore((s) => s.combineTables);
  const unmergeTable = usePosStore((s) => s.unmergeTable);
  const joinParty = usePosStore((s) => s.joinParty);
  const separateJoined = usePosStore((s) => s.separateJoined);
  const separateAllJoined = usePosStore((s) => s.separateAllJoined);
  const moveClusterChecksToPrimary = usePosStore((s) => s.moveClusterChecksToPrimary);
  const [separateOpen, setSeparateOpen] = useState(false);
  const [transferPick, setTransferPick] = useState<Record<string, string>>({});
  const setView = usePosStore((s) => s.setView);
  const floorIntent = usePosStore((s) => s.floorIntent);
  const beginBarTabPick = usePosStore((s) => s.beginBarTabPick);
  const clearFloorIntent = usePosStore((s) => s.clearFloorIntent);
  const openBarTabOnTable = usePosStore((s) => s.openBarTabOnTable);
  const setTableStatus = usePosStore((s) => s.setTableStatus);
  const deliverReadyTicketsForTable = usePosStore((s) => s.deliverReadyTicketsForTable);
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
  const locId = usePosStore((s) => s.tenantLocationId);
  const logout = usePosStore((s) => s.logout);
  const [draftBanner, setDraftBanner] = useState(false);
  const [ticketQuery, setTicketQuery] = useState("");
  useEffect(() => {
    if (tables.length > 0) {
      setDraftBanner(floorDraftBannerOn());
      return;
    }
    const draft = readFloorDraft(locId || "");
    if (!draft?.tables.length) return;
    usePosStore.setState({
      tables: draft.tables,
      floorSections: draft.sections.length ? draft.sections : usePosStore.getState().floorSections,
    });
    setFloorDraftBanner(true);
    setDraftBanner(true);
  }, [tables.length, locId]);

  const emp = employees.find((e) => e.id === currentEmployeeId) ?? null;
  const policy = policyOf(settings.sectionPolicy);
  const locked = emp ? roleIsLocked(emp.role, policy) : false;
  const floorCfg = parseFloorStatusConfig(settings.floorStatusConfig);
  const qrMode = parseQrMode(settings.qrMode);
  const qrPolicy = parseQrPolicy(settings.qrPolicy, settings.qrMode);
  const demoType = getDemoType();
  const canStatus = canChangeTableStatus(emp?.role, floorCfg);
  const cap = {
    deviceRole: (hostStand ? "host" : "order") as "host" | "order",
    employeeRole: emp?.role,
    settings,
  };
  const canSeat =
    stationCan(cap, "seat") &&
    (canSeatTable(emp?.role, floorCfg) ||
      (hostStand && Boolean(settings.serversAtHostStand) && emp?.role === "server"));
  const canEdit = canEditFloorplan(emp?.role) && canAccessView(emp?.role ?? "server", "floor_editor");
  const isHostStand = hostStand || emp?.role === "host";
  const showHostBarTab = stationCan(cap, "bar_tab") && locationAllowsBarTabs(tables);
  const canTogoAction = stationCan(cap, "togo");
  const canOrderEntry = stationCan(cap, "order_entry") || stationCan(cap, "pay");
  const canBusClean = stationCan(cap, "bus_clean") || canStatus;

  const layout = useStationLayout();
  const [seatOpen, setSeatOpen] = useState(false);
  const [seatTarget, setSeatTarget] = useState<Table | null>(null);
  const [guests, setGuests] = useState(2);
  const [transferMode, setTransferMode] = useState(false);
  const [transferFrom, setTransferFrom] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState(false);
  const [mergePrimary, setMergePrimary] = useState<string | null>(null);
  const [section, setSection] = useState<string>("__init");
  const [seatServerId, setSeatServerId] = useState<string>("");
  const [reassignId, setReassignId] = useState<string>("");
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerTo, setOfferTo] = useState("");
  const [offerHold, setOfferHold] = useState<CheckHoldKind>("left_to_close");
  const [offerReason, setOfferReason] = useState(CHECK_HOLD_REASONS.left_to_close[0]);
  const [offerMode, setOfferMode] = useState<"staff" | "hold">("staff");
  const [offerErr, setOfferErr] = useState<string | null>(null);
  const [blockTable, setBlockTable] = useState<Table | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [detail, setDetail] = useState<Table | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [floorScope, setFloorScope] = useState<"entire" | "section">("entire");
  const [selectMode, setSelectMode] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);
  const [dropId, setDropId] = useState<string | null>(null);

  const detailLive = detail
    ? (tables.find((t) => t.id === detail.id) ?? detail)
    : null;

  useEffect(() => {
    void import("@/lib/pos/station-busy").then((m) => m.setStationFloorSheetOpen(Boolean(detailLive)));
    if (!detailLive) {
      void import("@/lib/pos/station-refresh").then((m) => m.tickStationUpdatePrompt());
    }
    return () => {
      void import("@/lib/pos/station-busy").then((m) => m.setStationFloorSheetOpen(false));
    };
  }, [detailLive]);

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

  const showMine =
    (emp?.role === "server" || locked) && (emp?.homeSectionIds?.length ?? 0) > 0;
  const mineDefault = preferMine ?? showMine;
  const defaultSection =
    floorScope === "section"
      ? (sectionTabs[0]?.name ?? "All")
      : mineDefault && showMine
        ? "Mine"
        : "All";
  const effectiveSection = section === "__init" ? defaultSection : section;
  const floorServers = employees.filter(
    (e) => e.active && (e.role === "server" || e.role === "bartender"),
  );
  const canAssignServer = emp?.role === "owner" || emp?.role === "manager" || emp?.role === "host";
  const canForceReassign = emp?.role === "owner" || emp?.role === "manager";
  const releasedPool = tables.filter((t) => t.releasedAt && !t.mergedIntoId);

  const barPick = floorIntent === "bar_tab";
  const visible = barPick
    ? barTabVisibleTables({ tables, emp, sections: floorSections })
    : tables.filter((t) => {
        if (t.mergedIntoId) return false;
        if (effectiveSection !== "All" && effectiveSection !== "Mine") {
          if (t.section !== effectiveSection) return false;
        }
        if (effectiveSection === "Mine" && emp) {
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
  const ticketQ = ticketQuery.trim().toLowerCase();
  const shown = ticketQ
    ? visible.filter((t) => {
        if (t.label.toLowerCase().includes(ticketQ)) return true;
        return orders.some(
          (o) => o.tableId === t.id && o.status === "open" && String(o.number).toLowerCase().includes(ticketQ),
        );
      })
    : visible;
  /** House floor stays on the map. A section filter or Operating as that matches nothing still draws the venue tables. */
  const houseTables = tables.filter((t) => !t.mergedIntoId);
  const painted = shown.length > 0 ? shown : houseTables;

  const counts = useMemo(() => {
    const c: Record<string, number> = { check_open: 0 };
    for (const t of tables.filter((x) => !x.mergedIntoId)) {
      const st = effectiveTablePipeline(t, orders, tickets, floorCfg);
      c[st] = (c[st] ?? 0) + 1;
      if (openChecksOnTable(t, orders).length) c.check_open = (c.check_open ?? 0) + 1;
    }
    return c;
  }, [tables, orders, tickets, floorCfg]);

  const showBlocked = (t: Table, reason: string) => {
    setBlockTable(t);
    setBlockReason(reason);
  };

  const onTableClick = (t: Table) => {
    if (t.kind === "wall" || t.kind === "door" || t.kind === "window" || t.kind === "host_stand" || t.kind === "bar_top") {
      return;
    }
    if (barPick) {
      const res = openBarTabOnTable(t.id);
      if (!res.ok) {
        if (res.access) showBlocked(t, res.error ?? "Blocked");
        else alert(res.error);
      }
      return;
    }
    if (selectMode) {
      setPicked((cur) =>
        cur.includes(t.id) ? cur.filter((id) => id !== t.id) : [...cur, t.id],
      );
      return;
    }
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
        if (openChecksOnTable(t, orders).length === 0) {
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
    const res = seatTable(
      seatTarget.id,
      guests,
      seatServerId && canAssignServer ? { serverId: seatServerId } : undefined,
    );
    if (!res.ok) {
      setSeatOpen(false);
      showBlocked(seatTarget, res.error ?? "Cannot seat");
      return;
    }
    setSeatOpen(false);
    setSeatTarget(null);
    setDetail(null);
    if (mapOnly) onBusyNav?.("menu");
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

  const withManager = (run: (pin?: string) => { ok: boolean; error?: string }) => {
    let res = run();
    if (!res.ok && /manager pin/i.test(res.error || "")) {
      const pin = window.prompt("Manager PIN");
      if (!pin) return res;
      res = run(pin);
    }
    if (!res.ok && res.error) alert(res.error);
    return res;
  };

  const mapItems: FloorMapItem[] = mapOnly
    ? painted.map((t) => {
        const st = effectiveTablePipeline(t, orders, tickets, floorCfg);
        const fill = st === "reserved" ? "#e8e6e1" : (floorCfg.colors[st] ?? "#ffffff");
        const orderAcc = tableAccess(t.id, "order");
        const seatAcc = tableAccess(t.id, "seat");
        const dim =
          locked && !orderAcc.ok && orderAcc.code !== "view_only" && !seatAcc.ok;
        return {
          table: t,
          fill,
          ink: contrastInk(fill),
          hollow: st === "empty",
          flashing: tableFlash(t, floorCfg, clock || Date.now()),
          dim,
          joined: clusterNumbers(tables, t.id).joined,
        };
      })
    : [];

  return (
    <div className="flex h-full flex-col" data-demo="floor" data-checklist-focus="floor" tabIndex={-1}>
      {!mapOnly && (
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="mr-2 text-sm font-semibold">
          Floor · {saasLoc?.code ?? loc?.code ?? settings.name}
        </h2>
        <ClockedInChip />
        <NoSaleControl size={mapOnly ? "lg" : "sm"} className={mapOnly ? "h-12" : undefined} />
        {!mapOnly && (
        <GuideLearnLink topicId="floor-tables" compact>
          Learn
        </GuideLearnLink>
        )}
        {!barPick && (
        <div className="flex flex-wrap gap-1">
          <Button
            size={mapOnly ? "lg" : "sm"}
            className={mapOnly ? "station-touch h-12" : undefined}
            variant={floorScope === "entire" ? "default" : "outline"}
            onClick={() => {
              setFloorScope("entire");
              setSection("All");
            }}
          >
            Entire location
          </Button>
          <Button
            size={mapOnly ? "lg" : "sm"}
            className={mapOnly ? "station-touch h-12" : undefined}
            variant={floorScope === "section" ? "default" : "outline"}
            onClick={() => {
              setFloorScope("section");
              setSection(sectionTabs[0]?.name ?? "All");
            }}
          >
            By section
          </Button>
        </div>
        )}
        <div className="flex flex-wrap gap-1">
          {floorScope === "entire" && (
            <Button
              size={mapOnly ? "lg" : "sm"}
              className={mapOnly ? "station-touch h-12" : undefined}
              variant={effectiveSection === "All" ? "default" : "outline"}
              onClick={() => setSection("All")}
            >
              All
            </Button>
          )}
          {floorScope === "entire" && showMine && (
            <Button
              size={mapOnly ? "lg" : "sm"}
              className={mapOnly ? "station-touch h-12" : undefined}
              variant={effectiveSection === "Mine" ? "default" : "outline"}
              onClick={() => setSection("Mine")}
            >
              Mine
            </Button>
          )}
          {sectionTabs.map((s) => (
            <Button
              key={s.id}
              size={mapOnly ? "lg" : "sm"}
              variant={effectiveSection === s.name ? "default" : "outline"}
              onClick={() => setSection(s.name)}
              className={mapOnly ? "station-touch h-12 gap-1.5" : "gap-1.5"}
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
          {(counts.check_open ?? 0) > 0 && (
            <Badge variant="secondary" className="tabular bg-amber-700 text-white">
              CHECK OPEN {counts.check_open}
            </Badge>
          )}
        </div>
      </div>
      )}

      {barPick && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-2 px-3 py-2">
          <p className="min-w-0 flex-1 text-sm">
            Tap a stool in your section to open or attach the tab. Status colors are unchanged.
          </p>
          <Button
            size="lg"
            variant="outline"
            className="station-touch"
            onClick={() => clearFloorIntent()}
          >
            Cancel
          </Button>
        </div>
      )}

      {releasedPool.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-2 border-b border-amber-700/30 bg-amber-50 px-3 py-2"
          data-demo="released-pool"
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            Pending accept
          </span>
          {releasedPool.map((t) => (
            <Button
              key={t.id}
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setDetail(t)}
            >
              Table {t.label}
              {t.pendingAcceptName ? ` → ${t.pendingAcceptName}` : ""}
              {t.releasedByName ? ` · from ${t.releasedByName}` : ""}
            </Button>
          ))}
        </div>
      )}

      <div
        className={cn(
          "flex min-h-0 flex-1",
          layout.twoCol ? "flex-row" : "flex-col",
        )}
      >
        {mapOnly ? (
          <div className="relative min-h-0 flex-1" data-floor-house="venue" data-floor-paint={painted.length}>
            <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-2">
              <div className="pointer-events-auto min-w-0 rounded-xl bg-black/35 px-2 py-1 text-white">
                <p className="truncate text-sm font-semibold leading-tight">{emp?.name ?? "Station"}</p>
                <p className="text-[11px] tabular leading-tight">{formatTime(clock || Date.now(), settings.timezone)}</p>
                <ClockedInChip className="text-[10px] text-white/80" />
              </div>
              <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-black/35 p-1 text-white">
                <NotificationBell />
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  aria-label="Print"
                  onClick={() => {
                    const btn = document.querySelector<HTMLButtonElement>("[data-print-check]");
                    btn?.click();
                  }}
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
                  aria-label="Switch user"
                  onClick={() => logout()}
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </div>
            {draftBanner && (
              <p
                className="pointer-events-none absolute left-1/2 top-16 z-20 -translate-x-1/2 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white"
                data-floor-draft-banner
              >
                {FLOOR_DRAFT_BANNER}
              </p>
            )}
            <FloorMapCanvas
              items={mapItems}
              onTableClick={onTableClick}
              onCombine={(draggedId, ontoId) => {
                withManager((pin) => joinParty(draggedId, ontoId, pin));
              }}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-2 p-2">
              <div className="pointer-events-auto flex overflow-hidden rounded-xl bg-black/45 text-sm font-semibold text-white">
                <button type="button" className="px-3 py-2" onClick={() => { setTicketQuery(""); clearFloorIntent(); }}>
                  Dine in
                </button>
                <button
                  type="button"
                  className="border-l border-white/20 px-3 py-2"
                  onClick={() => useStationSessionStore.getState().setStationJob("togo")}
                >
                  To go
                </button>
              </div>
              <label className="pointer-events-auto flex items-center gap-1 rounded-xl bg-black/45 px-2 py-1 text-white">
                <span className="text-[11px] font-medium">Tickets</span>
                <input
                  value={ticketQuery}
                  onChange={(e) => setTicketQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Tickets search"
                  className="h-8 w-24 bg-transparent text-sm outline-none placeholder:text-white/60"
                  data-floor-ticket-search
                />
              </label>
            </div>
          </div>
        ) : (
        <div
          className={cn(
            "relative min-h-0 flex-1 overflow-auto p-3",
            (!layout.twoCol || layout.handheld) && "min-h-[45vh]",
          )}
        >
          <div
            className={cn(
              "relative mx-auto aspect-[4/3] w-full max-w-4xl rounded-2xl border border-border bg-white",
              layout.handheld && "min-h-[22rem]",
            )}
            data-floor-map="white"
            data-floor-canvas="white"
            data-floor-chairs="0"
          >
            <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>{effectiveSection === "All" || effectiveSection === "Mine" ? "Dining room" : effectiveSection}</span>
              <span>Bar →</span>
            </div>
            {visible.map((t) => {
              const checks = openChecksOnTable(t, orders);
              const order = checks[0] ?? orders.find((o) => o.id === t.orderId);
              const totals = order ? computeTotals(order, settings) : null;
              const server = employees.find((e) => e.id === t.serverId);
              const st = effectiveTablePipeline(t, orders, tickets, floorCfg);
              const checkOpen = checks.length > 0;
              const integrityWarn = tableEmptyWithOpenCheck(t, orders);
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
              if (isArchitectureKind(t.kind)) {
                return (
                  <div
                    key={t.id}
                    data-floor-arch={t.kind}
                    data-floor-rotation={((Number(t.rotation) || 0) % 360 + 360) % 360}
                    className="pointer-events-none absolute overflow-visible"
                    style={{
                      left: `${t.x}%`,
                      top: `${t.y}%`,
                      width: `${t.w}%`,
                      height: `${t.h}%`,
                    }}
                  >
                    <FloorArchitectureMark
                      table={t}
                      variant="live"
                      extend={
                        t.kind === "wall"
                          ? wallEndExtensions(
                              t,
                              visible.filter((w) => w.kind === "wall" && w.id !== t.id),
                            )
                          : undefined
                      }
                    />
                  </div>
                );
              }
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTableClick(t)}
                  onPointerDown={(e) => {
                    if (mapOnly || mergeMode || transferMode || selectMode) return;
                    drag.current = { id: t.id, x: e.clientX, y: e.clientY };
                  }}
                  onPointerUp={(e) => {
                    const d = drag.current;
                    drag.current = null;
                    setDropId(null);
                    if (!d) return;
                    const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
                    if (dist < 24) return;
                    const el = document.elementFromPoint(e.clientX, e.clientY);
                    const btn = el?.closest("[data-table-id]") as HTMLElement | null;
                    const dest = btn?.dataset.tableId;
                    if (dest && dest !== d.id) {
                      withManager((pin) => mergeTables(dest, d.id, pin));
                    }
                  }}
                  data-table-id={t.id}
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.w}%`,
                    height: `${t.h}%`,
                    color: ink,
                  }}
                  className={cn(
                    "absolute border-0 bg-transparent p-0 text-center transition hover:brightness-110 active:scale-[0.98]",
                    (transferFrom === t.id ||
                      mergePrimary === t.id ||
                      picked.includes(t.id) ||
                      dropId === t.id) &&
                      "ring-2 ring-primary",
                    (t.mergedChildIds?.length ?? 0) > 0 && "ring-1 ring-info/60",
                    foodUp && "ring-2 ring-primary animate-pulse",
                    flashing && "table-sla-flash",
                    integrityWarn && "ring-2 ring-amber-600",
                    outOfSection && "opacity-55",
                    (barPick || layout.handheld) &&
                      isBarRailSeat(t) &&
                      "min-h-12 min-w-12",
                  )}
                >
                  <FloorFixtureArt
                    table={t}
                    tableFill={fill}
                    outline={fill}
                    sectionColor={secColor}
                    label={`${t.label}${merged}`}
                    rotation={t.rotation ?? 0}
                    mode="status"
                    hollow={st === "empty"}
                    ink={ink}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0.5 z-10 flex flex-col items-center">
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
                  {checkOpen && (
                    <span className="mt-0.5 rounded bg-amber-700 px-1 text-[9px] font-bold uppercase tracking-wide text-white">
                      CHECK OPEN
                    </span>
                  )}
                  {grant && (
                    <span className="mt-0.5 rounded bg-info px-1 text-[9px] font-bold uppercase tracking-wide text-info-foreground">
                      Grant
                    </span>
                  )}
                  {t.releasedAt && (
                    <span className="mt-0.5 rounded bg-amber-600 px-1 text-[9px] font-bold uppercase tracking-wide text-white">
                      Open
                    </span>
                  )}
                  {outOfSection && tableIsVacant(t, orders) && (
                    <Lock className="mt-0.5 h-3 w-3 text-muted-foreground" />
                  )}
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
                  </div>
                </button>
              );
            })}
            {barPick && visible.length === 0 && (
              <p className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
                No stools in your section. Ask a manager to assign a bar section, or add barstools in the floor editor.
              </p>
            )}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            {selectMode
              ? "Tap the party table first, then the tables that join it."
              : mergeMode
              ? mergePrimary
                ? "Tap the table that joins this party"
                : "Tap the party table, then the table that joins it"
              : transferMode
                ? transferFrom
                  ? "Tap destination table"
                  : "Tap table with a check to move"
                : barPick
                  ? "Tap a stool — empty opens a tab, occupied attaches the check"
                : mapOnly
                  ? "Tap a table · color fill = status"
                : locked
                  ? "Color fill = status · top bar = section · locked tables need a grant"
                  : "Tap a table · drag one table onto another to join its party"}
          </p>
        </div>
        )}

        {!mapOnly && (
        <aside
          className={cn(
            "w-full shrink-0 overflow-y-auto border-border bg-surface",
            layout.twoCol
              ? "w-72 border-l"
              : "max-h-[42vh] border-t",
          )}
        >
          <div className="space-y-3 p-3">
            {isHostStand && !hostStand && (
              <Button
                className="w-full"
                size="lg"
                onClick={() => setView("waitlist")}
              >
                <Users className="h-4 w-4" />
                Waitlist / host stand
              </Button>
            )}
            {!chromeActions && !barPick && showHostBarTab && (
            <Button
              className="w-full"
              size="lg"
              onClick={() => beginBarTabPick()}
            >
              <Plus className="h-4 w-4" />
              Bar tab
            </Button>
            )}
            {!chromeActions && !hostStand && canTogoAction && (
            <Button
              className="w-full"
              variant="outline"
              size="lg"
              onClick={() => {
                clearFloorIntent();
                setView("takeout");
              }}
            >
              To-go
            </Button>
            )}
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
              variant={mergeMode || selectMode ? "default" : "outline"}
              size="lg"
              onClick={() => {
                setTransferMode(false);
                setTransferFrom(null);
                setSelectMode((m) => !m);
                setPicked([]);
                setMergeMode(false);
                setMergePrimary(null);
              }}
            >
              <Combine className="h-4 w-4" />
              {selectMode ? "Cancel select" : "Select to combine"}
            </Button>
            {selectMode && (
              <Button
                className="w-full"
                disabled={picked.length < 2}
                onClick={() => {
                  const res = combineTables(picked);
                  if (!res.ok) alert(res.error);
                  else {
                    setPicked([]);
                    setSelectMode(false);
                  }
                }}
              >
                Combine {picked.length} tables
              </Button>
            )}
            <Button
              className="w-full"
              variant={mergeMode ? "default" : "outline"}
              size="lg"
              onClick={() => {
                setTransferMode(false);
                setTransferFrom(null);
                setSelectMode(false);
                setMergeMode((m) => !m);
                setMergePrimary(null);
              }}
            >
              <Combine className="h-4 w-4" />
              {mergeMode ? "Cancel combine" : "Combine (tap two)"}
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
                  alert("No combined group");
                }
              }}
            >
              <Split className="h-4 w-4" />
              Split group
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
                QR · {qrPolicySummary(qrPolicy)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Table QR is scoped to this table’s open check. Ticket QR is on the printed check.
              </p>
              {qrTableTents(qrPolicy) && (
                <Button
                  className="mt-2 w-full"
                  size="sm"
                  variant="outline"
                  onClick={() => void printTableTents()}
                >
                  Print table tents
                </Button>
              )}
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
                  .filter((t) => !t.mergedIntoId && openChecksOnTable(t, orders).length > 0)
                  .map((t) => {
                    const o = openChecksOnTable(t, orders)[0] ?? orders.find((x) => x.id === t.orderId);
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
                {tables.every((t) => openChecksOnTable(t, orders).length === 0) && (
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
        )}
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
        <DialogContent
          className={
            mapOnly
              ? "bottom-0 left-0 top-auto max-h-[85dvh] w-full max-w-none translate-x-0 translate-y-0 rounded-b-none rounded-t-3xl"
              : "max-h-[90dvh] overflow-y-auto"
          }
        >
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
                openChecks={groupMembers(tables, detailLive.id).flatMap((t) => openChecksOnTable(t, orders))}
                settings={settings}
                employees={employees}
                floorCfg={floorCfg}
                canStatus={canStatus}
                canSeat={canSeat}
                canOrder={canOrderEntry}
                canClean={canBusClean}
                qrMode={qrMode}
                demoType={demoType}
                qrOpen={qrOpen}
                clock={clock}
                onOpenCheck={(orderId) => {
                  if (!canOrderEntry) {
                    showBlocked(detailLive, "This PIN cannot open a table order.");
                    return;
                  }
                  const res = selectTable(detailLive.id, orderId);
                  if (!res.ok) {
                    showBlocked(detailLive, res.error ?? "Outside your section");
                    return;
                  }
                  setDetail(null);
                }}
                onNewCheck={() => {
                  if (!canOrderEntry) {
                    showBlocked(detailLive, "This PIN cannot open a table order.");
                    return;
                  }
                  const res = newCheckOnTable(detailLive.id);
                  if (!res.ok) {
                    showBlocked(detailLive, res.error ?? "Could not open a check");
                    return;
                  }
                  setDetail(null);
                }}
                onPrintCheck={(orderId) => {
                  const section = detailLive.section?.trim() || "this section";
                  void import("@/lib/print/from-store").then(async (m) => {
                    const r = await m.printGuestCheck(orderId);
                    if (r.ok) {
                      toast.success(`Sending to ${r.sentTo || `${section} receipt printer`}`);
                    } else {
                      toast.error(r.error || NO_SECTION_RECEIPT);
                    }
                  });
                }}
                onPrintAll={() => {
                  const checks = openChecksOnTable(detailLive, orders);
                  const section = detailLive.section?.trim() || "this section";
                  void import("@/lib/print/from-store").then(async (m) => {
                    let ok = 0;
                    let err = "";
                    for (const c of checks) {
                      const r = await m.printGuestCheck(c.id);
                      if (r.ok) ok += 1;
                      else err = r.error || NO_SECTION_RECEIPT;
                    }
                    if (ok) {
                      toast.success(`Sending to ${section} receipt printer`);
                    }
                    if (err) toast.error(err);
                    if (!ok && !err) toast.error(NO_SECTION_RECEIPT);
                  });
                }}
                busy={mapOnly}
                onAdd={(orderId) => {
                  if (!canOrderEntry) {
                    showBlocked(detailLive, "This PIN cannot open a table order.");
                    return;
                  }
                  const res = selectTable(detailLive.id, orderId);
                  if (!res.ok) {
                    showBlocked(detailLive, res.error ?? "Outside your section");
                    return;
                  }
                  setDetail(null);
                  onBusyNav?.("menu");
                }}
                onSend={(orderId) => {
                  if (!canOrderEntry) {
                    showBlocked(detailLive, "This PIN cannot send.");
                    return;
                  }
                  const res = selectTable(detailLive.id, orderId);
                  if (!res.ok) {
                    showBlocked(detailLive, res.error ?? "Outside your section");
                    return;
                  }
                  const sent = usePosStore.getState().sendOrder();
                  if (!sent?.ok) {
                    toast.error(sent?.error || "Nothing to send");
                    return;
                  }
                  setDetail(null);
                  if (onBusyNav) onBusyNav("floor");
                  else usePosStore.getState().setActiveOrder(null);
                }}
                onPay={(orderId) => {
                  if (!canOrderEntry) {
                    showBlocked(detailLive, "This PIN cannot take pay.");
                    return;
                  }
                  const res = selectTable(detailLive.id, orderId);
                  if (!res.ok) {
                    showBlocked(detailLive, res.error ?? "Outside your section");
                    return;
                  }
                  setDetail(null);
                  if (onBusyNav) onBusyNav("pay");
                }}
                onSeat={() => {
                  const access = tableAccess(detailLive.id, "seat");
                  if (!access.ok) {
                    showBlocked(detailLive, access.reason ?? "Outside your section");
                    return;
                  }
                  if (mapOnly) {
                    const covers = Math.max(1, Math.min(2, detailLive.seats || 2));
                    const res = seatTable(detailLive.id, covers);
                    if (!res.ok) {
                      showBlocked(detailLive, res.error ?? "Cannot seat");
                      return;
                    }
                    setDetail(null);
                    onBusyNav?.("menu");
                    return;
                  }
                  setSeatTarget(detailLive);
                  setGuests(Math.min(detailLive.seats, 2));
                  const sec = floorSections.find((s) => s.name === detailLive.section);
                  const preferred =
                    floorServers.find(
                      (e) => sec && (e.homeSectionIds ?? []).includes(sec.id),
                    ) ?? floorServers[0];
                  setSeatServerId(preferred?.id ?? "");
                  setSeatOpen(true);
                }}
                onPartySize={() => {
                  const access = tableAccess(detailLive.id, "seat");
                  if (!access.ok) {
                    showBlocked(detailLive, access.reason ?? "Outside your section");
                    return;
                  }
                  setSeatTarget(detailLive);
                  setGuests(Math.min(detailLive.seats, 2));
                  const sec = floorSections.find((s) => s.name === detailLive.section);
                  const preferred =
                    floorServers.find(
                      (e) => sec && (e.homeSectionIds ?? []).includes(sec.id),
                    ) ?? floorServers[0];
                  setSeatServerId(preferred?.id ?? "");
                  setSeatOpen(true);
                }}
                onClean={() => {
                  const res = markClean(detailLive.id);
                  if (res && res.ok === false) alert(res.error);
                  else setDetail(null);
                }}
                onStatus={(st) => {
                  const res = setTableStatus(detailLive.id, st);
                  if (!res.ok) alert(res.error);
                  if (st === "food_delivered") deliverReadyTicketsForTable(detailLive.id);
                }}
                onToggleQr={() => setQrOpen((v) => !v)}
                onWaitlist={
                  isHostStand ? () => { setDetail(null); setView("waitlist"); } : undefined
                }
                onRelease={() => {
                  setOfferTo(floorServers.find((e) => e.id !== emp?.id)?.id ?? "");
                  setOfferMode("staff");
                  setOfferHold("left_to_close");
                  setOfferReason(CHECK_HOLD_REASONS.left_to_close[0] ?? "Table needed");
                  setOfferErr(null);
                  setOfferOpen(true);
                }}
                onAccept={() => {
                  const res = acceptTable(detailLive.id);
                  if (!res.ok) alert(res.error);
                }}
                canRelease={
                  openChecksOnTable(detailLive, orders).length > 0 &&
                  !detailLive.releasedAt &&
                  (emp?.role === "server" ||
                    emp?.role === "bartender" ||
                    emp?.role === "owner" ||
                    emp?.role === "manager" ||
                    emp?.role === "host") &&
                  (canForceReassign ||
                    emp?.role === "host" ||
                    detailLive.serverId === emp?.id)
                }
                canAccept={!!detailLive.releasedAt && (emp?.role === "server" || emp?.role === "bartender" || canAssignServer)}
                releasedByName={detailLive.releasedByName}
                serverName={employees.find((e) => e.id === detailLive.serverId)?.name}
                reassignOptions={canForceReassign ? floorServers : []}
                reassignId={reassignId}
                onReassignId={setReassignId}
                onReassign={() => {
                  if (!reassignId) return;
                  const res = reassignTable(detailLive.id, reassignId);
                  if (!res.ok) alert(res.error);
                  else setReassignId("");
                }}
                partyLabel={partyHeader(tables, detailLive.id)}
                onMoveChecks={
                  (detailLive.mergedChildIds?.length ?? 0) > 0
                    ? () => {
                        withManager((pin) => moveClusterChecksToPrimary(detailLive.id, pin));
                      }
                    : undefined
                }
                onSplitGroup={
                  (detailLive.mergedChildIds?.length ?? 0) > 0
                    ? () => setSeparateOpen(true)
                    : undefined
                }
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={separateOpen} onOpenChange={setSeparateOpen}>
        <DialogContent data-separate-sheet>
          <DialogHeader>
            <DialogTitle>Separate</DialogTitle>
          </DialogHeader>
          {detailLive && (detailLive.mergedChildIds?.length ?? 0) > 0 ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Joined tables leave this party. Items stay on their checks. A table with an open
                check has to move that check onto another table in the party, or the check has to be closed.
              </p>
              {groupMembers(tables, detailLive.id)
                .filter((t) => t.id !== detailLive.id)
                .map((t) => {
                  const token = tableToken(displayLabel(t));
                  const checks = openChecksOnTable(t, orders);
                  const others = groupMembers(tables, detailLive.id).filter((x) => x.id !== t.id);
                  return (
                    <div key={t.id} className="rounded-xl border border-border p-3" data-separate-row={token}>
                      <p className="text-sm font-medium">Remove {token}</p>
                      {checks.length > 0 ? (
                        <label className="mt-2 block text-xs text-muted-foreground">
                          Move open check to
                          <select
                            className="mt-1 h-9 w-full rounded-md border border-border bg-bg px-2 text-sm"
                            value={transferPick[t.id] ?? ""}
                            onChange={(e) => setTransferPick((cur) => ({ ...cur, [t.id]: e.target.value }))}
                          >
                            <option value="">Choose a table</option>
                            {others.map((o) => (
                              <option key={o.id} value={o.id}>
                                {tableToken(displayLabel(o))}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">Goes back to empty.</p>
                      )}
                      <Button
                        className="mt-2"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const res = withManager((pin) =>
                            separateJoined(detailLive.id, t.id, transferPick[t.id] || undefined, pin),
                          );
                          if (res.ok) setSeparateOpen(false);
                        }}
                      >
                        Remove {token}
                      </Button>
                    </div>
                  );
                })}
              <Button
                variant="outline"
                onClick={() => {
                  const res = withManager((pin) => separateAllJoined(detailLive.id, false, pin));
                  if (res.ok) {
                    setSeparateOpen(false);
                    setDetail(null);
                  }
                }}
              >
                Separate all
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">This table is not a combined party.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer or named hold</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Checks cannot go to a nameless unassigned pool. Offer to a server (they must accept) or
            park in a named hold still owned by that server or the house.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant={offerMode === "staff" ? "default" : "outline"} onClick={() => setOfferMode("staff")}>
              To staff
            </Button>
            <Button size="sm" variant={offerMode === "hold" ? "default" : "outline"} onClick={() => setOfferMode("hold")}>
              Named hold
            </Button>
          </div>
          {offerMode === "staff" ? (
            <label className="block text-xs text-muted-foreground">
              Server who must accept
              <select
                className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
                value={offerTo}
                onChange={(e) => setOfferTo(e.target.value)}
              >
                <option value="">Choose</option>
                {floorServers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className="block text-xs text-muted-foreground">
                Hold
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
                  value={offerHold}
                  onChange={(e) => {
                    const k = e.target.value as CheckHoldKind;
                    setOfferHold(k);
                    setOfferReason(CHECK_HOLD_REASONS[k][0] ?? "");
                  }}
                >
                  {CHECK_HOLDS.map((k) => (
                    <option key={k} value={k}>
                      {CHECK_HOLD_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Reason
                <select
                  className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
                  value={offerReason}
                  onChange={(e) => setOfferReason(e.target.value)}
                >
                  {CHECK_HOLD_REASONS[offerHold].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {offerErr && <p className="text-xs text-danger">{offerErr}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!detailLive) return;
                const res =
                  offerMode === "staff"
                    ? releaseTable(detailLive.id, { toEmployeeId: offerTo })
                    : releaseTable(detailLive.id, { hold: offerHold, reason: offerReason, house: offerHold !== "bar_tab" });
                if (!res.ok) {
                  setOfferErr(res.error ?? "Failed");
                  return;
                }
                setOfferOpen(false);
                setDetail(null);
              }}
            >
              {offerMode === "staff" ? "Offer for accept" : "Park in hold"}
            </Button>
          </DialogFooter>
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
            {canAssignServer && floorServers.length > 0 && (
              <label className="block text-sm text-muted-foreground">
                Assign server
                <select
                  className="mt-1 flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-foreground"
                  value={seatServerId}
                  onChange={(e) => setSeatServerId(e.target.value)}
                >
                  <option value="">Me ({emp?.name})</option>
                  {floorServers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.homeSectionIds?.length
                        ? ` · ${floorSections
                            .filter((sec) => s.homeSectionIds!.includes(sec.id))
                            .map((sec) => sec.name)
                            .join(", ")}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
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

      <SectionAccessDialog
        table={blockTable}
        reason={blockReason}
        open={!!blockTable}
        onOpenChange={(o) => {
          if (!o) setBlockTable(null);
        }}
        onResolved={(t) => {
          if (openChecksOnTable(t, orders).length) {
            if (canOrderEntry) selectTable(t.id);
            else setDetail(t);
          } else if (tableIsVacant(t, orders)) {
            setSeatTarget(t);
            setGuests(Math.min(t.seats, 2));
            setSeatOpen(true);
          } else if (canOrderEntry) {
            selectTable(t.id);
          } else {
            setDetail(t);
          }
        }}
      />
    </div>
  );
}

function TableDetailBody({
  table,
  openChecks,
  settings,
  employees,
  floorCfg,
  canStatus,
  canSeat,
  canOrder = true,
  canClean = true,
  qrMode,
  demoType,
  qrOpen,
  clock,
  onSeat,
  onOpenCheck,
  onNewCheck,
  onPrintCheck,
  onPrintAll,
  onClean,
  onStatus,
  onToggleQr,
  onWaitlist,
  onRelease,
  onAccept,
  canRelease,
  canAccept,
  releasedByName,
  serverName,
  reassignOptions,
  reassignId,
  onReassignId,
  onReassign,
  onSplitGroup,
  partyLabel,
  onMoveChecks,
  busy = false,
  onAdd,
  onSend,
  onPay,
  onPartySize,
}: {
  table: Table;
  openChecks: Order[];
  settings: RestaurantSettings;
  employees: Employee[];
  floorCfg: ReturnType<typeof parseFloorStatusConfig>;
  canStatus: boolean;
  canSeat: boolean;
  canOrder?: boolean;
  canClean?: boolean;
  qrMode: ReturnType<typeof parseQrMode>;
  demoType: string | null;
  qrOpen: boolean;
  clock: number;
  onSeat: () => void;
  onOpenCheck: (orderId: string) => void;
  onNewCheck: () => void;
  onPrintCheck: (orderId: string) => void;
  onPrintAll: () => void;
  onClean: () => void;
  onStatus: (st: FloorPipelineStatus) => void;
  onToggleQr: () => void;
  onWaitlist?: () => void;
  onRelease?: () => void;
  onAccept?: () => void;
  canRelease?: boolean;
  canAccept?: boolean;
  releasedByName?: string;
  serverName?: string;
  reassignOptions?: { id: string; name: string }[];
  reassignId?: string;
  onReassignId?: (id: string) => void;
  onReassign?: () => void;
  onSplitGroup?: () => void;
  partyLabel?: string;
  onMoveChecks?: () => void;
  busy?: boolean;
  onAdd?: (orderId: string) => void;
  onSend?: (orderId: string) => void;
  onPay?: (orderId: string) => void;
  onPartySize?: () => void;
}) {
  const [pickedId, setPickedId] = useState(openChecks[0]?.id ?? "");
  const picked = openChecks.find((c) => c.id === pickedId) ?? openChecks[0] ?? null;
  useEffect(() => {
    if (picked && picked.id !== pickedId) setPickedId(picked.id);
  }, [picked, pickedId]);
  const stored = normalizeTableStatus(table.status);
  const hasOpen = openChecks.length > 0;
  const empty = !hasOpen && isEmptyTable(table.status);
  const dirty = !hasOpen && stored === "closed_not_cleaned";
  const occupiedNoCheck =
    !hasOpen && !empty && stored !== "reserved" && stored !== "closed_not_cleaned";
  const flashing = tableFlash(table, floorCfg, clock || Date.now());
  const enabled = FLOOR_PIPELINE.filter((s) => floorCfg.enabled[s] !== false);
  const headerServer =
    serverName ||
    employees.find((e) => e.id === table.serverId)?.name ||
    openChecks[0]?.serverName;

  return (
    <div className="space-y-3" data-demo="table-detail">
      <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2">
        <span className="text-sm font-medium">
          {hasOpen ? "CHECK OPEN" : pipelineLabel(table.status)}
        </span>
        {!busy && flashing && (
          <Badge variant="danger" className="uppercase">
            SLA flash
          </Badge>
        )}
      </div>
      {busy && (
        <div className="grid grid-cols-2 gap-2" data-busy-actions>
          {empty && canSeat && (
            <Button
              className="station-touch col-span-2 h-16 text-xl font-semibold"
              onClick={onSeat}
              data-seat-now
            >
              Seat
            </Button>
          )}
          {occupiedNoCheck && canOrder && (
            <Button className="station-touch col-span-2 h-16 text-xl font-semibold" onClick={onNewCheck}>
              Resume
            </Button>
          )}
          {dirty && canClean && (
            <Button className="station-touch col-span-2 h-16 text-xl font-semibold" onClick={onClean}>
              Mark cleaned
            </Button>
          )}
          {hasOpen && picked && (
            <>
              <Button
                className="station-touch h-16 text-lg font-semibold"
                onClick={() => onAdd?.(picked.id)}
                data-add
              >
                Add
              </Button>
              <Button
                className="station-touch h-16 text-lg font-semibold"
                disabled={!picked.lines.some((l) => !l.sent && !l.voided && !l.held)}
                onClick={() => onSend?.(picked.id)}
                data-send
              >
                Send
              </Button>
              <Button
                className="station-touch h-16 text-lg font-semibold"
                onClick={() => onPrintCheck(picked.id)}
                data-print-check={picked.id}
              >
                Print check
              </Button>
              <Button
                className="station-touch h-16 text-lg font-semibold"
                onClick={() => onPay?.(picked.id)}
                data-pay
              >
                Pay
              </Button>
            </>
          )}
        </div>
      )}
      {hasOpen && (
        <div className="rounded-xl border border-border bg-bg px-3 py-2 text-sm" data-table-view>
          <p className="text-xs text-muted-foreground">
            {partyLabel || tableToken(table.label)} · {table.section} · {table.guestCount || table.seats} covers
            {headerServer ? ` · ${headerServer}` : ""}
          </p>
          {!busy && (
          <p className="mt-1 text-[11px] text-muted-foreground">
            Print check on the row. Tap the check to add, void, send, or pay. Staff split stays on
            that check — not Table QR.
          </p>
          )}
          <ul className="mt-2 space-y-2">
            {openChecks.map((c) => {
              const dual = computeDualTotals(c, settings);
              const items = c.lines.filter((l) => !l.voided).reduce((n, l) => n + l.quantity, 0);
              return (
                <li
                  key={c.id}
                  className="rounded-xl border border-border bg-surface p-2"
                  data-open-check={c.id}
                >
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-lg px-1 py-1 text-left text-sm hover:bg-surface-2"
                    onClick={() => (busy ? setPickedId(c.id) : onOpenCheck(c.id))}
                  >
                    <span>
                      <span className="font-medium">#{c.number}</span>
                      <span className="mt-0.5 block text-[11px] text-muted-foreground">
                        {c.serverName} · {items} item{items === 1 ? "" : "s"}
                      </span>
                    </span>
                    <span className="text-right text-xs tabular">
                      {dual.enabled ? (
                        <>
                          <span className="block">Cash {formatCurrency(dual.cash.totalCents)}</span>
                          <span className="block text-muted-foreground">
                            Card {formatCurrency(dual.card.totalCents)}
                          </span>
                        </>
                      ) : (
                        formatCurrency(dual.cash.totalCents)
                      )}
                    </span>
                  </button>
                  {!busy && (
                  <Button
                    size="lg"
                    className="station-touch mt-2 min-h-12 w-full"
                    onClick={() => onPrintCheck(c.id)}
                    data-print-check={c.id}
                  >
                    <Printer className="h-5 w-5" />
                    Print check
                  </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {table.releasedAt && (
        <p className="rounded-lg border border-amber-700/30 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Offered by {releasedByName ?? "staff"}
          {table.pendingAcceptName ? ` to ${table.pendingAcceptName}` : ""} — they must accept.
          The check stays owned until accept. Not unassigned.
        </p>
      )}
      <details
        data-floor-more={busy ? "1" : undefined}
        open={busy ? undefined : true}
        className={busy ? "rounded-xl border border-border" : undefined}
      >
        {busy && (
          <summary className="flex min-h-14 cursor-pointer list-none items-center px-4 text-lg font-semibold">
            More
          </summary>
        )}
        <div className={busy ? "space-y-3 border-t border-border p-3" : "space-y-3"}>
      <div className="flex flex-wrap gap-2">
        {onPartySize && (
          <Button variant="outline" onClick={onPartySize}>
            Party size
          </Button>
        )}
        {empty && canSeat && (
          <Button onClick={onSeat}>
            <Users className="h-4 w-4" />
            Seat
          </Button>
        )}
        {occupiedNoCheck && canOrder && (
          <Button onClick={onNewCheck}>Resume</Button>
        )}
        {hasOpen && canOrder && (
          <Button variant="outline" onClick={onNewCheck}>
            New check on this table
          </Button>
        )}
        {hasOpen && (
          <Button variant="ghost" size="sm" onClick={onPrintAll} data-print-all-open>
            Print all open
          </Button>
        )}
        {onMoveChecks && (
          <Button variant="outline" onClick={onMoveChecks} data-move-checks-primary>
            Move checks to primary
          </Button>
        )}
        {onSplitGroup && (
          <Button variant="outline" onClick={onSplitGroup} data-separate-open>
            <Split className="h-4 w-4" />
            Separate
          </Button>
        )}
        {(stored === "ordered_food" || stored === "food_delivered" || stored === "ordered_drinks" || hasOpen) && (
          <Button variant="outline" onClick={() => onStatus("food_delivered")}>
            Mark delivered
          </Button>
        )}
        {dirty && canClean && (
          <Button variant="outline" onClick={onClean}>
            Mark cleaned
          </Button>
        )}
        {onWaitlist && (
          <Button variant="outline" onClick={onWaitlist}>
            Waitlist
          </Button>
        )}
        {canRelease && onRelease && (
          <Button variant="outline" onClick={onRelease} data-demo="release-table">
            <Handshake className="h-4 w-4" />
            Transfer / hold
          </Button>
        )}
        {canAccept && onAccept && (
          <Button onClick={onAccept} data-demo="accept-table">
            <UserCheck className="h-4 w-4" />
            Accept table
          </Button>
        )}
        <Button variant="outline" onClick={onToggleQr}>
          <QrCode className="h-4 w-4" />
          {qrOpen ? "Hide QR" : "Table QR"}
        </Button>
      </div>
      {reassignOptions && reassignOptions.length > 0 && table.orderId && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="block min-w-[10rem] flex-1 text-xs text-muted-foreground">
            Force reassign
            <select
              className="mt-1 flex h-9 w-full rounded-md border border-border bg-bg px-2 text-sm text-foreground"
              value={reassignId ?? ""}
              onChange={(e) => onReassignId?.(e.target.value)}
            >
              <option value="">Choose server</option>
              {reassignOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline" disabled={!reassignId} onClick={onReassign}>
            Reassign
          </Button>
        </div>
      )}
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
                variant={stored === s && !hasOpen ? "default" : "outline"}
                disabled={s === "empty" && hasOpen}
                title={
                  s === "empty" && hasOpen
                    ? "Void or close open checks before setting Empty"
                    : undefined
                }
                onClick={() => onStatus(s)}
                style={
                  stored === s && !hasOpen
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
            {qrPolicySummary(parseQrPolicy(undefined, qrMode))}
          </p>
          <QrMark value={tableGuestUrl(table, { demoType })} />
          <div className="mt-2 flex flex-col gap-1.5">
            <a href={tableGuestUrl(table, { demoType })} className="text-sm underline">
              Open guest menu
            </a>
            <a href={tableGuestUrl(table, { pay: true, demoType })} className="text-sm underline">
              Open pay QR
            </a>
            <p className="break-all text-[11px] text-muted-foreground">
              {tableGuestUrl(table, { demoType })}
            </p>
          </div>
        </div>
      )}
        </div>
      </details>
    </div>
  );
}
