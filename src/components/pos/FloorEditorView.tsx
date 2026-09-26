import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, QrCode, RotateCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import { cn, uid } from "@/lib/utils";
import { SetupAssistButton } from "@/components/assist/SetupAssistDialog";
import {
  SECTION_SWATCHES,
  sectionColorForTable,
  swatchCss,
} from "@/lib/pos/section-control";
import type { BarGuestSide, TableKind } from "@/lib/pos/types";
import {
  BOOTH_DEFAULTS,
  asBoothKind,
  clampBoothSeats,
  isBoothKind,
  nextBoothRotation,
  type BoothKind,
} from "@/lib/pos/floor-booth";
import { FloorBoothIcon } from "@/components/pos/FloorBoothMark";
import { FloorFixtureArt } from "@/components/pos/FloorFixtureArt";
import { tableGuestUrl } from "@/lib/pos/qr-table";
import { getDemoType } from "@/lib/demo/session";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { QrMark } from "./QrMark";
import {
  flushLocationCatalog,
  persistClearedFloor,
  persistLocationCatalog,
  persistPrinterAssignments,
} from "@/lib/pos/persist-location-setup";
import {
  CLEAR_SLATE_CONFIRM,
  idsInMarquee,
  multiDeleteConfirm,
  nextSelection,
  toggleSelection,
  viewportBoxToPlan,
} from "@/lib/pos/floor-select";
import {
  DEFAULT_OBJECT_IN,
  DEFAULT_ROOM,
  ROOM_FIT_MARGIN_PX,
  dimensionLabel,
  cameraAfterFloorInput,
  fitRoomToView,
  formatFeetInches,
  zoomFloorCamera,
  nearestObjectGap,
  nearestRoomEdge,
  fixtureEdgeBox,
  objectInches,
  parseFeetInches,
  parsePositiveInches,
  sizePatch,
  splitInches,
} from "@/lib/pos/floor-dimensions";
import { planFloorCopies } from "@/lib/pos/floor-copy";
import {
  ADD_COUNT_TITLE,
  RENUMBER_CONFIRM,
  RENUMBER_LABEL,
  alignSelection,
  canvasCenterOrigin,
  isAddCountKind,
  nextFreeNumbers,
  nextFreeStoolLabels,
  originAtClick,
  outsideWalkOrder,
  placeRow,
  resetFloorNumbers,
  rulerMarks,
  snapToGrid,
  snapToObjects,
  type AlignOp,
  type GridSizeIn,
  type SnapMode,
} from "@/lib/pos/floor-arrange";
import { FloorArchitectureMark } from "@/components/pos/FloorArchitectureMark";
import {
  barClosedShape,
  barDepthIn,
  barLegsForShape,
  dragLegEnd,
  dragLengthEnd,
  dragRotatedCorner,
  lengthEndWorld,
  legInches,
  nearestWallSnap,
  placeWallEnd,
  planFromLegInches,
  generateBarStools,
  isStoolPathText,
  resizeBarLeg,
  slabBounds,
  wallEndExtensions,
  isArchitectureKind,
  legHandles,
  legLengthsOf,
  planToLocal,
  sealBarLoop,
  snapPct,
  snapStoolToRail,
  storedBarPlan,
  unrotatePointer,
  type BarStoolCounts,
  type BarTopShape,
  type LegHandle,
  type PlanPoint,
  type SpinBox,
} from "@/lib/pos/floor-architecture";
import {
  barPrinterForSection,
  isBarOrderPrinter,
  receiptPrinterForSection,
  setSectionPrinter,
} from "@/lib/print/printer-assignment";
import { isReceiptPrinterType } from "@/lib/pos/location-devices";

function stoolsOnRail(
  tables: { id: string; kind?: string | null; x: number; y: number; w: number; h: number; railBarId?: string }[],
  bar: {
    id?: string;
    x: number;
    y: number;
    w: number;
    h: number;
    kind?: string | null;
    rotation?: number | null;
    barShape?: BarTopShape | null;
    points?: PlanPoint[] | null;
    legLengths?: number[] | null;
    widthIn?: number | null;
  },
  room: { widthIn: number; depthIn: number },
): string[] {
  return tables
    .filter((t) => t.kind === "barstool")
    .filter((t) => {
      if (bar.id && t.railBarId === bar.id) return true;
      const snapped = snapStoolToRail(t, [{ ...bar, kind: "bar_top" }], room);
      if (!snapped) return false;
      return Math.hypot(snapped.x - t.x, snapped.y - t.y) < 8;
    })
    .map((t) => t.id);
}

function isThinPiece(kind?: string | null): boolean {
  return kind === "wall" || kind === "door" || kind === "window";
}

function spinBoxOf(piece: { x: number; y: number; w: number; h: number; rotation?: number | null }): SpinBox {
  return { x: piece.x, y: piece.y, w: piece.w, h: piece.h, rotation: Number(piece.rotation) || 0 };
}

function LengthHandles({
  id,
  rot,
  onEnd,
}: {
  id: string;
  rot: number;
  onEnd: (event: React.PointerEvent, id: string, end: "start" | "end") => void;
}) {
  const vertical = rot % 180 === 90;
  return (
    <>
      {(["start", "end"] as const).map((end) => (
        <span
          key={end}
          data-floor-end={end}
          role="button"
          aria-label={end === "start" ? "Length start" : "Length end"}
          className={cn(
            "pointer-events-auto absolute z-20 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-neutral-950 shadow",
            vertical ? "cursor-ns-resize" : "cursor-ew-resize",
          )}
          style={{ left: end === "start" ? "0%" : "100%", top: "50%" }}
          onPointerDown={(event) => onEnd(event, id, end)}
        />
      ))}
    </>
  );
}

function CornerHandle({
  id,
  rot,
  onCorner,
}: {
  id: string;
  rot: number;
  onCorner: (event: React.PointerEvent, id: string) => void;
}) {
  return (
    <span
      data-floor-resize
      role="button"
      aria-label="Resize"
      className={cn(
        "pointer-events-auto absolute bottom-0 right-0 z-20 h-3 w-3 rounded-sm bg-primary",
        rot % 180 === 0 ? "cursor-nwse-resize" : "cursor-nesw-resize",
      )}
      onPointerDown={(event) => onCorner(event, id)}
    />
  );
}

function MeasureGuides({
  table,
  tables,
  room,
}: {
  table: { id: string; kind?: string | null; x: number; y: number; w: number; h: number; rotation?: number | null };
  tables: Array<{ id: string; kind?: string | null; x: number; y: number; w: number; h: number; rotation?: number | null }>;
  room: { widthIn: number; depthIn: number };
}) {
  const box = fixtureEdgeBox(table, room);
  const edge = nearestRoomEdge(box, room);
  const other = nearestObjectGap(table, tables, room);
  return (
    <div
      data-floor-measure=""
      className="pointer-events-none absolute left-1/2 top-full z-30 mt-1 flex -translate-x-1/2 flex-col items-center gap-0.5 whitespace-nowrap text-[10px] font-medium text-neutral-900"
    >
      <span className="rounded bg-white px-1 shadow">
        {formatFeetInches(Math.max(0, edge.inches))} to {edge.side}
      </span>
      {other ? (
        <span className="rounded bg-white px-1 shadow">
          {formatFeetInches(Math.max(0, other.inches))} to {other.label}
        </span>
      ) : null}
    </div>
  );
}

function ThicknessInput({
  totalIn,
  onCommit,
}: {
  totalIn: number;
  onCommit: (inches: number) => void;
}) {
  const [text, setText] = useState(String(totalIn));
  const [seen, setSeen] = useState(String(totalIn));
  if (seen !== String(totalIn)) {
    setSeen(String(totalIn));
    setText(String(totalIn));
  }
  return (
    <label className="block text-xs text-muted-foreground" data-floor-size="thickness">
      Thickness (in)
      <Input
        className="mt-1 h-8"
        inputMode="numeric"
        value={text}
        placeholder="optional"
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === "") return;
          const parsed = parsePositiveInches(Number(e.target.value));
          if (parsed != null) onCommit(parsed);
        }}
        onBlur={() => {
          if (text.trim() === "" || parsePositiveInches(Number(text)) == null) setText(String(totalIn));
        }}
      />
    </label>
  );
}

function StoolCount({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-xs text-muted-foreground">
      {label}
      <Input
        className="mt-1 h-8"
        inputMode="numeric"
        data-stool-count={label}
        value={value ? String(value) : ""}
        placeholder="0"
        onChange={(e) => onChange(Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0))))}
      />
    </label>
  );
}

function ObjectSizeFields({
  table,
  room,
  onSize,
}: {
  table: { shape?: string | null; kind?: string | null; w: number; h: number; lengthIn?: number | null; widthIn?: number | null };
  room: { widthIn: number; depthIn: number };
  onSize: (lengthIn: number, widthIn: number) => void;
}) {
  const size = objectInches(table, room);
  const round = table.shape === "round" || table.kind === "barstool";
  const thin = table.kind === "wall" || table.kind === "door" || table.kind === "window";
  return (
    <div className="grid grid-cols-2 gap-2" data-floor-object-size="">
      <FeetInchesInput
        label={round ? "Diameter" : "Length"}
        totalIn={size.lengthIn}
        testId="length"
        onCommit={(n) => onSize(n, round ? n : size.widthIn)}
      />
      {round ? (
        <p className="self-end pb-2 text-[11px] text-muted-foreground">{formatFeetInches(size.lengthIn)} dia</p>
      ) : thin ? (
        <ThicknessInput totalIn={size.widthIn} onCommit={(n) => onSize(size.lengthIn, n)} />
      ) : (
        <FeetInchesInput
          label="Width"
          totalIn={size.widthIn}
          testId="width"
          onCommit={(n) => onSize(size.lengthIn, n)}
        />
      )}
    </div>
  );
}

function FeetInchesInput({
  label,
  totalIn,
  onCommit,
  testId,
}: {
  label: string;
  totalIn: number;
  onCommit: (total: number) => void;
  testId?: string;
}) {
  const split = splitInches(totalIn);
  const [feet, setFeet] = useState(String(split.feet));
  const [inches, setInches] = useState(String(split.inches));
  const syncKey = `${split.feet}:${split.inches}`;
  const [seen, setSeen] = useState(syncKey);
  if (seen !== syncKey) {
    setSeen(syncKey);
    setFeet(String(split.feet));
    setInches(String(split.inches));
  }
  const commit = (nextFeet: string, nextInches: string) => {
    const parsed = parseFeetInches(Number(nextFeet), Number(nextInches));
    if (parsed == null) return;
    if (parsed !== totalIn) onCommit(parsed);
  };
  return (
    <label className="block text-xs text-muted-foreground" data-floor-size={testId}>
      {label}
      <span className="mt-1 flex items-center gap-1">
        <Input
          className="h-8 w-14"
          inputMode="numeric"
          value={feet}
          onChange={(e) => {
            setFeet(e.target.value);
            commit(e.target.value, inches);
          }}
          onBlur={() => {
            if (parseFeetInches(Number(feet), Number(inches)) == null) {
              setFeet(String(split.feet));
              setInches(String(split.inches));
            }
          }}
        />
        <span>'</span>
        <Input
          className="h-8 w-14"
          inputMode="numeric"
          value={inches}
          onChange={(e) => {
            setInches(e.target.value);
            commit(feet, e.target.value);
          }}
          onBlur={() => {
            if (parseFeetInches(Number(feet), Number(inches)) == null) {
              setFeet(String(split.feet));
              setInches(String(split.inches));
            }
          }}
        />
        <span>"</span>
      </span>
    </label>
  );
}

const KINDS: {
  id: TableKind;
  label: string;
  shape: "rect" | "round" | "bar" | "booth" | "other";
  w: number;
  h: number;
  seats: number;
  booth?: BoothKind;
}[] = [
  { id: "table", label: "Table", shape: "round", w: 12, h: 12, seats: 4 },
  { id: "square_plain", label: "Square no seats", shape: "rect", w: 10, h: 10, seats: 0 },
  { id: "booth_4", label: "Booth 4-top", shape: "booth", w: 16, h: 20, seats: 4, booth: "booth_4" },
  { id: "booth_u", label: "Booth U", shape: "booth", w: 20, h: 18, seats: 6, booth: "booth_u" },
  { id: "booth_l", label: "Booth L", shape: "booth", w: 18, h: 18, seats: 5, booth: "booth_l" },
  { id: "barstool", label: "Barstool", shape: "bar", w: 8, h: 8, seats: 1 },
  { id: "wall", label: "Wall", shape: "rect", w: 28, h: 2, seats: 0 },
  { id: "door", label: "Door", shape: "rect", w: 8, h: 2, seats: 0 },
  { id: "window", label: "Window", shape: "rect", w: 12, h: 2, seats: 0 },
  { id: "host_stand", label: "Host stand", shape: "rect", w: 14, h: 10, seats: 0 },
  { id: "bar_top", label: "Bar top", shape: "rect", w: 36, h: 16, seats: 0 },
  { id: "other", label: "Other", shape: "other", w: 12, h: 10, seats: 2 },
];

export function FloorEditorView() {
  const tables = usePosStore((s) => s.tables);
  const floorSections = usePosStore((s) => s.floorSections);
  const updateLayout = usePosStore((s) => s.updateTableLayout);
  const floorRoom = usePosStore((s) => s.floorRoom) ?? DEFAULT_ROOM;
  const setFloorRoom = usePosStore((s) => s.setFloorRoom);
  const update = (id: string, patch: Partial<import("@/lib/pos/types").Table>) => {
    if (patch.w != null || patch.h != null) {
      const roomNow = usePosStore.getState().floorRoom ?? DEFAULT_ROOM;
      const current = usePosStore.getState().tables.find((row) => row.id === id);
      const barPiece = current?.kind === "bar_top" || patch.kind === "bar_top";
      if (current && !barPiece) {
        const w = patch.w ?? current.w;
        const h = patch.h ?? current.h;
        patch = {
          ...patch,
          lengthIn: Math.max(1, Math.round((w / 100) * roomNow.widthIn)),
          widthIn: Math.max(1, Math.round((h / 100) * roomNow.depthIn)),
        };
      }
    }
    updateLayout(id, patch);
  };
  const add = usePosStore((s) => s.addFloorTable);
  const remove = usePosStore((s) => s.removeFloorTable);
  const rotateTableQr = usePosStore((s) => s.rotateTableQr);
  const upsertFloorSection = usePosStore((s) => s.upsertFloorSection);
  const removeFloorSection = usePosStore((s) => s.removeFloorSection);
  const locationDevices = usePosStore((s) => s.locationDevices ?? []);
  const receiptPrinters = locationDevices.filter(
    (d) => d.status !== "inactive" && isReceiptPrinterType(d.type),
  );
  const barPrinters = locationDevices.filter((d) => isBarOrderPrinter(d));

  const assignSectionPrinter = (sectionId: string, kind: "receipt" | "bar", printerId: string) => {
    const next = setSectionPrinter(
      usePosStore.getState().locationDevices ?? [],
      sectionId,
      kind,
      printerId || null,
    );
    usePosStore.setState({ locationDevices: next });
    persistPrinterAssignments();
  };
  const [selected, setSelected] = useState<string | null>(null);
  const [selection, setSelection] = useState<string[]>([]);
  const selectionRef = useRef<string[]>([]);
  selectionRef.current = selection;
  const [clearOpen, setClearOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const marqueeRef = useRef<{
    x: number;
    y: number;
    additive: boolean;
    moved: boolean;
  } | null>(null);
  const spaceRef = useRef(false);
  const selectOnly = (id: string | null) => {
    setSelected(id);
    setSelection(id ? [id] : []);
  };
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyCount, setCopyCount] = useState("1");
  const [addOpen, setAddOpen] = useState(false);
  const [addCount, setAddCount] = useState("1");
  const [pendingKind, setPendingKind] = useState<(typeof KINDS)[number] | null>(null);
  const [renumberOpen, setRenumberOpen] = useState(false);
  const [gridOn, setGridOn] = useState(false);
  const [rulerOn, setRulerOn] = useState(false);
  const [snapMode, setSnapMode] = useState<SnapMode>("off");
  const [gridIn, setGridIn] = useState<GridSizeIn>(12);
  const snapRef = useRef<{ mode: SnapMode; gridIn: number }>({ mode: "off", gridIn: 12 });
  snapRef.current = { mode: snapMode, gridIn };
  const placePointRef = useRef<{ x: number; y: number } | null>(null);
  const [newName, setNewName] = useState("");
  const [room, setRoom] = useState<string>("All");
  const [scope, setScope] = useState<"entire" | "section">("entire");
  const [showQr, setShowQr] = useState(false);
  const [stoolCounts, setStoolCounts] = useState<BarStoolCounts>({
    count: 0,
    legA: 0,
    legB: 0,
    corner: false,
    left: 0,
    rear: 0,
    right: 0,
  });
  const [stoolBar, setStoolBar] = useState<string | null>(null);
  const [replaceStools, setReplaceStools] = useState(false);
  const [pendingSide, setPendingSide] = useState<BarGuestSide | null>(null);
  if (selected !== stoolBar) {
    setStoolBar(selected);
    setReplaceStools(false);
    setPendingSide(null);
  }
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origPoints: PlanPoint[] | null;
    stoolOrig: Record<string, { x: number; y: number }>;
  } | null>(null);
  const resize = useRef<{
    id: string;
    mode: "corner" | "end";
    end?: "start" | "end";
    orig: SpinBox;
    arch: boolean;
  } | null>(null);
  const legDrag = useRef<{
    id: string;
    handle: LegHandle;
    orig: PlanPoint[];
    stoolIds: string[];
    box: SpinBox;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  const [cam, setCam] = useState({ s: 1, x: ROOM_FIT_MARGIN_PX, y: ROOM_FIT_MARGIN_PX });
  const camRef = useRef(cam);
  camRef.current = cam;
  const fittedKey = useRef<string | null>(null);
  const [frame, setFrame] = useState<{ pxPerIn: number; worldW: number; worldH: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);
  const fit = useMemo(
    () =>
      fitRoomToView({
        room: floorRoom,
        viewW: Math.max(1, view.w),
        viewH: Math.max(1, view.h),
        marginPx: ROOM_FIT_MARGIN_PX,
      }),
    [floorRoom, view.w, view.h],
  );
  const draw = frame ?? fit;
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) setView({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    if (view.w <= 0 || view.h <= 0) return;
    const key = `${floorRoom.widthIn}x${floorRoom.depthIn}`;
    const input = fittedKey.current === null ? "open" : fittedKey.current === key ? "viewport" : "room";
    const next = cameraAfterFloorInput(camRef.current, input, {
      s: 1,
      x: fit.originX,
      y: fit.originY,
    });
    if (input === "viewport") return;
    fittedKey.current = key;
    setFrame({ pxPerIn: fit.pxPerIn, worldW: fit.worldW, worldH: fit.worldH });
    setCam(next);
  }, [view.w, view.h, floorRoom.widthIn, floorRoom.depthIn, fit.originX, fit.originY, fit.pxPerIn, fit.worldW, fit.worldH]);
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = event.clientX - rect.left;
      const py = event.clientY - rect.top;
      const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
      setCam((c) => cameraAfterFloorInput(c, "wheel", zoomFloorCamera(c, factor, { x: px, y: py })));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);
  const fitRoomView = () => {
    setFrame({ pxPerIn: fit.pxPerIn, worldW: fit.worldW, worldH: fit.worldH });
    setCam((c) => cameraAfterFloorInput(c, "fit", { s: 1, x: fit.originX, y: fit.originY }));
  };
  const zoomBy = (factor: number) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const origin = { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 };
    setCam((c) => cameraAfterFloorInput(c, "control", zoomFloorCamera(c, factor, origin)));
  };
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);
  const onViewportPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      const [a, b] = [...pointersRef.current.values()];
      pinchRef.current = {
        dist: Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y)),
        scale: camRef.current.s,
      };
      panRef.current = null;
      return;
    }
    if (e.button === 0 && !spaceRef.current) {
      marqueeRef.current = { x: e.clientX, y: e.clientY, additive: e.shiftKey, moved: false };
      panRef.current = null;
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    panRef.current = { x: e.clientX, y: e.clientY, ox: camRef.current.x, oy: camRef.current.y };
  };
  const onViewportPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const [a, b] = [...pointersRef.current.values()];
      const dist = Math.max(1, Math.hypot(a!.x - b!.x, a!.y - b!.y));
      const s = Math.min(8, Math.max(0.25, pinchRef.current.scale * (dist / pinchRef.current.dist)));
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = (a!.x + b!.x) / 2 - rect.left;
      const my = (a!.y + b!.y) / 2 - rect.top;
      setCam((c) => {
        const k = s / (c.s || 1);
        return cameraAfterFloorInput(c, "pinch", { s, x: mx - (mx - c.x) * k, y: my - (my - c.y) * k });
      });
      return;
    }
    const mark = marqueeRef.current;
    if (mark && e.button === 0) {
      if (Math.hypot(e.clientX - mark.x, e.clientY - mark.y) > 4) mark.moved = true;
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMarqueeBox({
        left: Math.min(mark.x, e.clientX) - rect.left,
        top: Math.min(mark.y, e.clientY) - rect.top,
        width: Math.abs(e.clientX - mark.x),
        height: Math.abs(e.clientY - mark.y),
      });
      return;
    }
    const pan = panRef.current;
    if (!pan) return;
    setCam((c) => ({
      ...c,
      x: pan.ox + (e.clientX - pan.x),
      y: pan.oy + (e.clientY - pan.y),
    }));
  };
  const onViewportPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const mark = marqueeRef.current;
    if (mark) {
      if (!mark.moved) {
        const board = boardRef.current?.getBoundingClientRect();
        if (board && board.width > 0 && board.height > 0) {
          const x = ((e.clientX - board.left) / board.width) * 100;
          const y = ((e.clientY - board.top) / board.height) * 100;
          if (x >= 0 && x <= 100 && y >= 0 && y <= 100) placePointRef.current = { x, y };
        }
        selectOnly(null);
      } else {
        const rect = viewportRef.current?.getBoundingClientRect();
        if (rect && draw.worldW > 0) {
          const plan = viewportBoxToPlan(
            {
              left: Math.min(mark.x, e.clientX) - rect.left,
              top: Math.min(mark.y, e.clientY) - rect.top,
              width: Math.abs(e.clientX - mark.x),
              height: Math.abs(e.clientY - mark.y),
            },
            camRef.current,
            draw.worldW,
            draw.worldH,
          );
          const hit = idsInMarquee(
            visible.map((t) => ({ id: t.id, x: t.x, y: t.y, w: t.w, h: t.h })),
            plan,
          );
          const next = nextSelection(selectionRef.current, hit, mark.additive);
          setSelection(next);
          setSelected(next[next.length - 1] ?? null);
        }
      }
      marqueeRef.current = null;
      setMarqueeBox(null);
    }
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
    panRef.current = null;
  };
  const demoType = getDemoType();

  const selectedTable = tables.find((t) => t.id === selected);
  const visible = tables.filter((t) => {
    if (t.mergedIntoId) return false;
    if (scope === "section" && room === "All") return t.section === (floorSections[0]?.name ?? t.section);
    if (room !== "All" && t.section !== room) return false;
    return true;
  });

  const onPointerDown = (
    e: React.PointerEvent,
    id: string,
    x: number,
    y: number,
  ) => {
    if (resize.current || legDrag.current) return;
    if (e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      const next = toggleSelection(selectionRef.current, id);
      setSelection(next);
      setSelected(next.includes(id) ? id : (next[next.length - 1] ?? null));
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const piece = tables.find((t) => t.id === id);
    const origPoints =
      piece?.kind === "bar_top" && piece.legLengths && piece.legLengths.length > 0
        ? storedBarPlan(piece).map((p) => ({ x: p.x, y: p.y }))
        : null;
    const stoolOrig: Record<string, { x: number; y: number }> = {};
    if (piece?.kind === "bar_top") {
      const plan = storedBarPlan(piece);
      const ids = stoolsOnRail(tables, { ...piece, points: plan, legLengths: legLengthsOf(plan) }, floorRoom);
      for (const sid of ids) {
        const stool = tables.find((t) => t.id === sid);
        if (stool) stoolOrig[sid] = { x: stool.x, y: stool.y };
      }
    }
    drag.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
      origPoints,
      stoolOrig,
    };
    selectOnly(id);
  };

  const startResize = (
    e: React.PointerEvent,
    id: string,
    mode: "corner" | "end",
    end?: "start" | "end",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const piece = tables.find((t) => t.id === id);
    if (!piece) return;
    drag.current = null;
    legDrag.current = null;
    resize.current = {
      id,
      mode,
      end,
      orig: spinBoxOf(piece),
      arch: isArchitectureKind(piece.kind),
    };
    selectOnly(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 100;
    const py = ((e.clientY - rect.top) / rect.height) * 100;
    if (legDrag.current) {
      const active = legDrag.current;
      const current = tables.find((t) => t.id === active.id);
      const pointer = unrotatePointer({ x: px, y: py }, active.box, active.box.rotation);
      const next = sealBarLoop(dragLegEnd(active.orig, active.handle, pointer), current?.barShape ?? undefined);
      const depth = barDepthIn(current?.widthIn);
      const box = slabBounds(next, depth, floorRoom, barClosedShape(current?.barShape, next));
      const lengths = legLengthsOf(next);
      update(active.id, { points: next, legLengths: lengths, ...box, widthIn: depth });
      const bar = {
        ...(current ?? { x: box.x, y: box.y, w: box.w, h: box.h }),
        points: next,
        legLengths: lengths,
        ...box,
      };
      for (const sid of active.stoolIds) {
        const stool = tables.find((t) => t.id === sid);
        if (!stool) continue;
        const snapped = snapStoolToRail(stool, [bar]);
        if (snapped) update(sid, snapped);
      }
      return;
    }
    if (resize.current) {
      const active = resize.current;
      const pointer = { x: px, y: py };
      if (active.mode === "end" && active.end) {
        const piece = tables.find((t) => t.id === active.id);
        if (piece?.kind === "wall") {
          const free = dragLengthEnd(active.orig, active.end, pointer, { min: 2, max: 100, snap: 0 });
          const freeEnd = lengthEndWorld(
            { ...free, rotation: active.orig.rotation },
            active.end,
          );
          const hit = nearestWallSnap(
            freeEnd,
            tables.filter((t) => t.kind === "wall"),
            active.id,
            { width: rect.width, height: rect.height },
          );
          update(
            active.id,
            hit
              ? placeWallEnd(active.orig, active.end, hit, { min: 2, max: 100 })
              : dragLengthEnd(active.orig, active.end, pointer, { min: 2, max: 100, snap: 2 }),
          );
        } else {
          update(active.id, dragLengthEnd(active.orig, active.end, pointer, { min: 2, max: 100, snap: 2 }));
        }
        return;
      }
      const limit = active.arch ? 100 : 40;
      update(
        active.id,
        dragRotatedCorner(active.orig, pointer, {
          minW: 6,
          maxW: limit,
          minH: 6,
          maxH: limit,
          snap: active.arch ? 2 : 0,
        }),
      );
      return;
    }
    if (!drag.current) return;
    const dx = ((e.clientX - drag.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.current.startY) / rect.height) * 100;
    const target = tables.find((t) => t.id === drag.current?.id);
    let nx = Math.min(90, Math.max(0, drag.current.origX + dx));
    let ny = Math.min(90, Math.max(0, drag.current.origY + dy));
    const snap = snapRef.current;
    if (snap.mode === "grid") {
      const snapped = snapToGrid(nx, ny, floorRoom, snap.gridIn);
      nx = snapped.x;
      ny = snapped.y;
    } else if (snap.mode === "objects" && target) {
      const others = tables
        .filter((row) => row.id !== target.id && !row.mergedIntoId)
        .map((row) => ({ x: row.x, y: row.y, w: row.w, h: row.h }));
      const snapped = snapToObjects({ x: nx, y: ny, w: target.w, h: target.h }, others, floorRoom);
      nx = snapped.x;
      ny = snapped.y;
    } else if (isArchitectureKind(target?.kind)) {
      nx = snapPct(nx);
      ny = snapPct(ny);
    }
    let stoolFacing: number | null = null;
    if (target?.kind === "barstool") {
      const snapped = snapStoolToRail(
        { x: nx, y: ny, w: target.w, h: target.h },
        tables,
        floorRoom,
      );
      if (snapped && Math.hypot(snapped.x - nx, snapped.y - ny) < 8) {
        nx = snapped.x;
        ny = snapped.y;
        stoolFacing = snapped.rotation;
      }
    }
    const appliedDx = nx - drag.current.origX;
    const appliedDy = ny - drag.current.origY;
    if (target?.kind === "bar_top") {
      const patch: { x: number; y: number; points?: PlanPoint[]; legLengths?: number[] } = {
        x: Math.round(nx * 10) / 10,
        y: Math.round(ny * 10) / 10,
      };
      if (drag.current.origPoints) {
        const next = drag.current.origPoints.map((p) => ({
          x: Math.round((p.x + appliedDx) * 10) / 10,
          y: Math.round((p.y + appliedDy) * 10) / 10,
        }));
        patch.points = next;
        patch.legLengths = legLengthsOf(next);
      }
      update(drag.current.id, patch);
      for (const [sid, origin] of Object.entries(drag.current.stoolOrig)) {
        update(sid, {
          x: Math.round((origin.x + appliedDx) * 10) / 10,
          y: Math.round((origin.y + appliedDy) * 10) / 10,
        });
      }
      return;
    }
    update(drag.current.id, {
      x: Math.round(nx * 10) / 10,
      y: Math.round(ny * 10) / 10,
      ...(stoolFacing != null ? { rotation: stoolFacing } : {}),
    });
  };

  const onPointerUp = () => {
    if (drag.current || resize.current || legDrag.current) persistLocationCatalog("floor");
    drag.current = null;
    resize.current = null;
    legDrag.current = null;
  };

  const startLeg = (e: React.PointerEvent, id: string, handle: LegHandle) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const bar = tables.find((t) => t.id === id);
    if (!bar) return;
    const plan = storedBarPlan(bar);
    const stoolIds = stoolsOnRail(tables, { ...bar, points: plan, legLengths: legLengthsOf(plan) }, floorRoom);
    drag.current = null;
    resize.current = null;
    legDrag.current = { id, handle, orig: plan, stoolIds, box: spinBoxOf(bar) };
    selectOnly(id);
  };

  const renameSection = (id: string, name: string) => {
    const prev = floorSections.find((s) => s.id === id);
    upsertFloorSection({ id, name });
    if (prev && prev.name !== name) {
      for (const t of tables) {
        if (t.section === prev.name) update(t.id, { section: name });
      }
    }
    persistLocationCatalog("floor");
  };

  const placeStools = (barId: string, confirmed: boolean, side?: BarGuestSide) => {
    const bar = tables.find((t) => t.id === barId);
    if (!bar || bar.kind !== "bar_top") return;
    const existingIds = stoolsOnRail(tables, bar, floorRoom);
    const existing = tables.filter((t) => existingIds.includes(t.id));
    if (existing.some((t) => t.orderId)) return;
    if (existing.length > 0 && !confirmed) {
      setPendingSide(side ?? null);
      setReplaceStools(true);
      return;
    }
    const useSide = side ?? bar.barSide;
    if (useSide) update(bar.id, { barSide: useSide });
    for (const id of existingIds) remove(id);
    const poses = generateBarStools({
      bar: { ...bar, barSide: useSide },
      room: floorRoom,
      counts: stoolCounts,
      side: useSide,
    });
    const walkBar = {
      id: bar.id,
      x: bar.x,
      y: bar.y,
      w: bar.w,
      h: bar.h,
      points: storedBarPlan(bar),
      barShape: bar.barShape,
      barSide: useSide ?? bar.barSide,
      widthIn: bar.widthIn,
    };
    const order = outsideWalkOrder(
      poses.map((pose) => ({ x: pose.x + pose.w / 2, y: pose.y + pose.h / 2 })),
      walkBar,
      floorRoom,
    );
    order.forEach((poseIndex, n) => {
      const pose = poses[poseIndex];
      if (!pose) return;
      add({
        ...pose,
        kind: "barstool",
        shape: "bar",
        seats: 1,
        section: bar.section,
        sectionId: bar.sectionId,
        label: `B${n + 1}`,
        railBarId: bar.id,
      });
    });
    if (isStoolPathText(bar.label)) update(bar.id, { label: "BAR" });
    setReplaceStools(false);
    setPendingSide(null);
    persistLocationCatalog("floor");
  };

  const chooseSide = (barId: string, side: BarGuestSide) => {
    const bar = tables.find((t) => t.id === barId);
    if (!bar) return;
    const existingIds = stoolsOnRail(tables, bar, floorRoom);
    if (!existingIds.length) {
      update(barId, { barSide: side });
      persistLocationCatalog("floor");
      return;
    }
    setPendingSide(side);
    setReplaceStools(true);
  };

  const placeKind = (kind: (typeof KINDS)[number]) => {
    const dining =
      room !== "All" ? room : floorSections[0]?.name ?? "Dining";
    const sec = floorSections.find((s) => s.name === dining);
    const count = tables.filter((t) => t.kind === kind.id || (!t.kind && kind.id === "table")).length;
    const booth = kind.booth;
    const seats = booth ? BOOTH_DEFAULTS[booth].seats : kind.seats;
    const x = 20 + (count % 5) * 12;
    const y = 20 + Math.floor(count / 5) * 14;
    const spec = DEFAULT_OBJECT_IN[kind.id] ?? DEFAULT_OBJECT_IN.table!;
    const sized = sizePatch(spec.lengthIn, spec.widthIn, floorRoom, { round: kind.shape === "round" });
    const w = sized?.w ?? kind.w;
    const h = sized?.h ?? kind.h;
    const barDepth = 24;
    const barOrigin = { x, y: y + 2 };
    const barPoints =
      kind.id === "bar_top"
        ? planFromLegInches("straight", barOrigin, barLegsForShape("straight"), floorRoom)
        : null;
    const barBox = barPoints ? slabBounds(barPoints, barDepth, floorRoom, false) : null;
    const id = add({
      x: barBox?.x ?? x,
      y: barBox?.y ?? y,
      section: dining,
      sectionId: sec?.id,
      seats,
      shape: kind.shape,
      kind: kind.id,
      w: barBox?.w ?? w,
      h: barBox?.h ?? h,
      lengthIn: kind.id === "bar_top" ? 12 * 12 : sized?.lengthIn,
      widthIn: kind.id === "bar_top" ? barDepth : sized?.widthIn,
      rotation: 0,
      label:
        kind.id === "barstool"
          ? `B${tables.filter((t) => t.section === "Bar" || t.kind === "barstool").length + 1}`
          : kind.id === "wall"
            ? "Wall"
            : kind.id === "door"
              ? "Door"
              : kind.id === "window"
                ? "Window"
                : kind.id === "host_stand"
                  ? "Host"
                  : kind.id === "bar_top"
                    ? "Bar"
                    : undefined,
      barShape: kind.id === "bar_top" ? "straight" : undefined,
      ...(barPoints ? { points: barPoints, legLengths: legLengthsOf(barPoints) } : {}),
    });
    selectOnly(id);
    persistLocationCatalog("floor");
  };

  const addCountOk = /^[1-9]\d*$/.test(addCount.trim());

  const confirmAdd = () => {
    if (!pendingKind || !addCountOk) return;
    const count = Number(addCount.trim());
    const state = usePosStore.getState();
    const roomNow = state.floorRoom ?? DEFAULT_ROOM;
    const spec = DEFAULT_OBJECT_IN[pendingKind.id] ?? DEFAULT_OBJECT_IN.table!;
    const sized = sizePatch(spec.lengthIn, spec.widthIn, roomNow, { round: pendingKind.shape === "round" });
    const w = sized?.w ?? pendingKind.w;
    const h = sized?.h ?? pendingKind.h;
    const click = placePointRef.current;
    const origin = click ? originAtClick(click, w, h) : canvasCenterOrigin(w, h);
    const spots = placeRow(origin, { w, h }, count, roomNow);
    const existing = state.tables.map((row) => row.label);
    const labels =
      pendingKind.id === "barstool" ? nextFreeStoolLabels(existing, count) : nextFreeNumbers(existing, count);
    const dining = room !== "All" ? room : floorSections[0]?.name ?? "Dining";
    const sec = floorSections.find((section) => section.name === dining);
    const booth = pendingKind.booth;
    const seats = booth ? BOOTH_DEFAULTS[booth].seats : pendingKind.seats;
    const ids: string[] = [];
    spots.forEach((spot, index) => {
      ids.push(
        state.addFloorTable({
          x: spot.x,
          y: spot.y,
          section: dining,
          sectionId: sec?.id,
          seats,
          shape: pendingKind.shape,
          kind: pendingKind.id,
          w,
          h,
          lengthIn: sized?.lengthIn,
          widthIn: sized?.widthIn,
          rotation: 0,
          label: labels[index],
        }),
      );
    });
    setSelection(ids);
    setSelected(ids[ids.length - 1] ?? null);
    placePointRef.current = null;
    setAddOpen(false);
    setPendingKind(null);
    persistLocationCatalog("floor");
  };

  const confirmRenumber = () => {
    const state = usePosStore.getState();
    const roomNow = state.floorRoom ?? DEFAULT_ROOM;
    const bars = state.tables
      .filter((row) => row.kind === "bar_top")
      .map((row) => ({
        id: row.id,
        x: row.x,
        y: row.y,
        w: row.w,
        h: row.h,
        label: row.label,
        points: storedBarPlan(row),
        barShape: row.barShape,
        barSide: row.barSide,
        widthIn: row.widthIn,
        section: row.section,
        sectionId: row.sectionId,
      }));
    const plan = resetFloorNumbers(state.tables, bars, roomNow);
    for (const patch of plan.labels) update(patch.id, { label: patch.label });
    for (const move of plan.moves) {
      update(move.id, { x: move.x, y: move.y, rotation: move.rotation, railBarId: move.railBarId });
    }
    for (const made of plan.create) {
      state.addFloorTable({
        label: made.label,
        kind: "barstool",
        shape: "bar",
        seats: 1,
        section: made.section,
        sectionId: made.sectionId,
        x: made.x,
        y: made.y,
        w: made.w,
        h: made.h,
        rotation: made.rotation,
        lengthIn: made.lengthIn,
        widthIn: made.widthIn,
        railBarId: made.railBarId,
      });
    }
    setRenumberOpen(false);
    persistLocationCatalog("floor");
  };

  const applyAlign = (op: AlignOp) => {
    const ids = selectionRef.current;
    const patches = alignSelection(usePosStore.getState().tables, ids, op);
    for (const patch of patches) {
      update(patch.id, {
        x: patch.x,
        y: patch.y,
        ...(patch.points ? { points: patch.points, legLengths: patch.legLengths } : {}),
      });
    }
    if (patches.length) persistLocationCatalog("floor");
  };

  const copyCountOk = /^[1-9]\d*$/.test(copyCount.trim());

  const applyCopies = () => {
    const ids = selectionRef.current.length ? selectionRef.current : selected ? [selected] : [];
    if (!copyCountOk || !ids.length) return;
    const count = Number(copyCount.trim());
    const state = usePosStore.getState();
    const roomNow = state.floorRoom ?? DEFAULT_ROOM;
    let labels = state.tables.map((t) => t.label);
    let last: string | null = null;
    for (const id of ids) {
      const source = state.tables.find((t) => t.id === id);
      if (!source) continue;
      const copies = planFloorCopies(source, labels, count, roomNow);
      for (const copy of copies) {
        labels = [...labels, copy.label];
        last = state.addFloorTable({
          label: copy.label,
          section: copy.section,
          sectionId: copy.sectionId,
          seats: copy.seats,
          x: copy.x,
          y: copy.y,
          w: copy.w,
          h: copy.h,
          shape: copy.shape,
          kind: copy.kind,
          barShape: copy.barShape,
          points: copy.points ?? undefined,
          legLengths: copy.legLengths ?? undefined,
          lengthIn: copy.lengthIn,
          widthIn: copy.widthIn,
          fill: copy.fill,
          rotation: copy.rotation ?? 0,
        });
      }
    }
    if (last) selectOnly(last);
    setCopyOpen(false);
    persistLocationCatalog("floor");
  };

  const removeIds = (ids: string[]) => {
    const blocked: string[] = [];
    for (const id of ids) {
      const res = remove(id);
      if (!res.ok && res.error) blocked.push(res.error);
    }
    selectOnly(null);
    if (blocked.length) alert(blocked[0]);
    persistLocationCatalog("floor");
  };

  const deleteSelection = () => {
    const ids = selectionRef.current;
    if (!ids.length) return;
    const ask = multiDeleteConfirm(ids.length);
    if (ask) {
      setDeleteOpen(true);
      return;
    }
    removeIds(ids);
  };

  const deleteRef = useRef(deleteSelection);
  deleteRef.current = deleteSelection;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!selectionRef.current.length) return;
      event.preventDefault();
      deleteRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const confirmClear = () => {
    usePosStore.setState({ tables: [] });
    selectOnly(null);
    setClearOpen(false);
    persistClearedFloor();
  };

  return (
    <div className="flex h-full flex-col" data-demo="floor-editor">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Floor plan editor</h2>
        <Badge variant="secondary">Drag · resize · rooms</Badge>
        <GuideLearnLink topicId="floor-editor" compact>
          Learn
        </GuideLearnLink>
        <SetupAssistButton domain="floor" label="Add by voice or text" />
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={scope === "entire" ? "default" : "outline"}
            onClick={() => {
              setScope("entire");
              setRoom("All");
            }}
          >
            Entire location
          </Button>
          <Button
            size="sm"
            variant={scope === "section" ? "default" : "outline"}
            onClick={() => {
              setScope("section");
              setRoom(floorSections[0]?.name ?? "All");
            }}
          >
            By section
          </Button>
          {scope === "entire" && (
          <Button
            size="sm"
            variant={room === "All" ? "default" : "outline"}
            onClick={() => setRoom("All")}
          >
            All rooms
          </Button>
          )}
          {floorSections.map((s) => (
            <Button
              key={s.id}
              size="sm"
              variant={room === s.name ? "default" : "outline"}
              onClick={() => setRoom(s.name)}
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
        <div className="ml-auto flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant="outline"
              onClick={() => {
                if (isAddCountKind(k.id)) {
                  setPendingKind(k);
                  setAddCount("1");
                  setAddOpen(true);
                  return;
                }
                placeKind(k);
              }}
            >
              {k.booth ? <FloorBoothIcon kind={k.booth} /> : <Plus className="h-3.5 w-3.5" />}
              {k.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-[300px] flex-1 flex-col p-3">
          <div className="mb-2 flex flex-wrap items-end gap-3" data-floor-room="">
            <FeetInchesInput
              label="Room width"
              totalIn={floorRoom.widthIn}
              testId="room-width"
              onCommit={(widthIn) => {
                setFloorRoom({ widthIn, depthIn: floorRoom.depthIn });
                persistLocationCatalog("floor");
              }}
            />
            <FeetInchesInput
              label="Room depth"
              totalIn={floorRoom.depthIn}
              testId="room-depth"
              onCommit={(depthIn) => {
                setFloorRoom({ widthIn: floorRoom.widthIn, depthIn });
                persistLocationCatalog("floor");
              }}
            />
            <Button type="button" size="sm" variant="outline" data-floor-zoom-out="" onClick={() => zoomBy(1 / 1.25)}>
              Zoom out
            </Button>
            <Button type="button" size="sm" variant="outline" data-floor-zoom-in="" onClick={() => zoomBy(1.25)}>
              Zoom in
            </Button>
            <Button type="button" size="sm" variant="outline" data-floor-fit-room="" onClick={fitRoomView}>
              Fit room
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-floor-clear=""
              onClick={() => setClearOpen(true)}
            >
              Clear slate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-floor-renumber=""
              onClick={() => setRenumberOpen(true)}
            >
              {RENUMBER_LABEL}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={gridOn ? "default" : "outline"}
              data-floor-grid=""
              aria-pressed={gridOn}
              onClick={() => setGridOn((on) => !on)}
            >
              Grid
            </Button>
            <Button
              type="button"
              size="sm"
              variant={rulerOn ? "default" : "outline"}
              data-floor-ruler=""
              aria-pressed={rulerOn}
              onClick={() => setRulerOn((on) => !on)}
            >
              Ruler
            </Button>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Snap
              <select
                data-floor-snap=""
                className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-foreground"
                value={snapMode}
                onChange={(event) => setSnapMode(event.target.value as SnapMode)}
              >
                <option value="off">Off</option>
                <option value="grid">Grid</option>
                <option value="objects">Objects</option>
              </select>
            </label>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              Grid size
              <select
                data-floor-grid-size=""
                className="h-8 rounded-md border border-border bg-bg px-2 text-xs text-foreground"
                value={String(gridIn)}
                onChange={(event) => setGridIn(Number(event.target.value) as GridSizeIn)}
              >
                <option value="6">6"</option>
                <option value="12">1'</option>
                <option value="24">2'</option>
              </select>
            </label>
            {selection.length >= 2 ? (
              <div className="flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="outline" data-floor-align="left" onClick={() => applyAlign("left")}>
                  Left
                </Button>
                <Button type="button" size="sm" variant="outline" data-floor-align="right" onClick={() => applyAlign("right")}>
                  Right
                </Button>
                <Button type="button" size="sm" variant="outline" data-floor-align="top" onClick={() => applyAlign("top")}>
                  Top
                </Button>
                <Button type="button" size="sm" variant="outline" data-floor-align="bottom" onClick={() => applyAlign("bottom")}>
                  Bottom
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-floor-align="distribute-h"
                  disabled={selection.length < 3}
                  onClick={() => applyAlign("distribute-h")}
                >
                  Distribute horizontal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-floor-align="distribute-v"
                  disabled={selection.length < 3}
                  onClick={() => applyAlign("distribute-v")}
                >
                  Distribute vertical
                </Button>
              </div>
            ) : null}
          </div>
          <div
            ref={viewportRef}
            data-floor-viewport=""
            className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-white"
            onPointerDown={onViewportPointerDown}
            onPointerMove={onViewportPointerMove}
            onPointerUp={onViewportPointerUp}
            onPointerCancel={onViewportPointerUp}
          >
          {marqueeBox ? (
            <div
              data-floor-marquee=""
              className="pointer-events-none absolute z-20 border border-primary bg-primary/15"
              style={{
                left: marqueeBox.left,
                top: marqueeBox.top,
                width: marqueeBox.width,
                height: marqueeBox.height,
              }}
            />
          ) : null}
          <div
            ref={boardRef}
            data-floor-canvas="white"
            data-floor-fit="room"
            className="absolute left-0 top-0 border border-neutral-300 bg-white"
            style={{
              width: draw.worldW,
              height: draw.worldH,
              transform: `translate(${cam.x}px, ${cam.y}px) scale(${cam.s})`,
              transformOrigin: "0 0",
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {gridOn ? (
              <div
                data-floor-grid-lines=""
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(28,25,23,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(28,25,23,0.22) 1px, transparent 1px)",
                  backgroundSize: `${(gridIn / floorRoom.widthIn) * 100}% ${(gridIn / floorRoom.depthIn) * 100}%`,
                }}
              />
            ) : null}
            {rulerOn ? (
              <div className="pointer-events-none absolute inset-0 z-10">
                {rulerMarks(floorRoom.widthIn).map((mark) =>
                  mark.label ? (
                    <span
                      key={`x-${mark.at}`}
                      className="absolute top-0 -translate-x-1/2 whitespace-nowrap pt-0.5 text-[9px] leading-none text-neutral-500"
                      style={{ left: `${mark.at}%` }}
                    >
                      {mark.label}
                    </span>
                  ) : (
                    <span
                      key={`x-${mark.at}`}
                      className="absolute top-0 h-1.5 w-px bg-neutral-400"
                      style={{ left: `${mark.at}%` }}
                    />
                  ),
                )}
                {rulerMarks(floorRoom.depthIn).map((mark) =>
                  mark.label ? (
                    <span
                      key={`y-${mark.at}`}
                      className="absolute left-0 -translate-y-1/2 whitespace-nowrap pl-0.5 text-[9px] leading-none text-neutral-500"
                      style={{ top: `${mark.at}%` }}
                    >
                      {mark.label}
                    </span>
                  ) : (
                    <span
                      key={`y-${mark.at}`}
                      className="absolute left-0 h-px w-1.5 bg-neutral-400"
                      style={{ top: `${mark.at}%` }}
                    />
                  ),
                )}
              </div>
            ) : null}
            {visible.map((t) => {
              const color = sectionColorForTable(t, floorSections);
              const rot = ((Number(t.rotation) || 0) % 360 + 360) % 360;
              const inSet = selection.includes(t.id);
              const spinRing = cn(
                inSet && "ring-2 ring-primary/50",
                (t.mergedChildIds?.length ?? 0) > 0 && "ring-1 ring-info",
              );
              const frame = {
                left: `${t.x}%`,
                top: `${t.y}%`,
                width: `${t.w}%`,
                height: `${t.h}%`,
              };
              if (t.kind === "bar_top") {
                const plan = storedBarPlan(t);
                const local = planToLocal(plan, t);
                const handles = selected === t.id ? legHandles(plan, t.barShape ?? "straight") : [];
                return (
                  <div
                    key={t.id}
                    data-floor-bar-hit="path"
                    data-floor-rotation={rot}
                    data-floor-selected={inSet ? "1" : undefined}
                    className="pointer-events-none absolute overflow-visible"
                    style={frame}
                  >
                    {selected === t.id ? (
                      <span
                        data-floor-dim=""
                        className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-white px-1 text-[10px] font-medium text-neutral-900 shadow"
                      >
                        {dimensionLabel(t, floorRoom)}
                      </span>
                    ) : null}
                    {selected === t.id ? <MeasureGuides table={t} tables={tables} room={floorRoom} /> : null}
                    <div
                      data-floor-spin=""
                      className="relative h-full w-full"
                      style={{
                        transform: `rotate(${rot}deg)`,
                        transformOrigin: "center center",
                        pointerEvents: "none",
                      }}
                    >
                      <FloorArchitectureMark
                        table={{ ...t, rotation: 0 }}
                        selected={selected === t.id}
                        room={floorRoom}
                        pxPerIn={draw.pxPerIn * cam.s}
                        spinDeg={rot}
                        onBarPointerDown={(e) => onPointerDown(e, t.id, t.x, t.y)}
                      />
                      {handles.map((h) => {
                        const p = local[h.index];
                        if (!p) return null;
                        return (
                          <span
                            key={`${h.index}-${h.anchor}`}
                            data-bar-leg={h.index}
                            role="button"
                            aria-label={`Bar leg ${h.index + 1}`}
                            className="pointer-events-auto absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-primary shadow active:cursor-grabbing"
                            style={{ left: `${p.x}%`, top: `${p.y}%` }}
                            onPointerDown={(e) => startLeg(e, t.id, h)}
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              }
              const thin = isThinPiece(t.kind);
              return (
                <div
                  key={t.id}
                  data-floor-rotation={rot}
                  data-floor-selected={inSet ? "1" : undefined}
                  className="pointer-events-none absolute overflow-visible"
                  style={frame}
                >
                  {selected === t.id ? (
                    <span
                      data-floor-dim=""
                      className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded bg-white px-1 text-[10px] font-medium text-neutral-900 shadow"
                    >
                      {dimensionLabel(t, floorRoom)}
                    </span>
                  ) : null}
                  {selected === t.id ? <MeasureGuides table={t} tables={tables} room={floorRoom} /> : null}
                  {isArchitectureKind(t.kind) ? (
                    <FloorArchitectureMark
                      table={t}
                      selected={selected === t.id}
                      className={cn("pointer-events-auto cursor-grab", spinRing)}
                      onShapePointerDown={(e) => onPointerDown(e, t.id, t.x, t.y)}
                      extend={
                        t.kind === "wall"
                          ? wallEndExtensions(
                              t,
                              tables.filter((w) => w.kind === "wall" && w.id !== t.id),
                            )
                          : undefined
                      }
                    >
                      {selected === t.id && thin ? (
                        <LengthHandles
                          id={t.id}
                          rot={rot}
                          onEnd={(e, id, end) => startResize(e, id, "end", end)}
                        />
                      ) : null}
                      {selected === t.id && !thin ? (
                        <CornerHandle id={t.id} rot={rot} onCorner={(e, id) => startResize(e, id, "corner")} />
                      ) : null}
                    </FloorArchitectureMark>
                  ) : (
                    <FloorFixtureArt
                      table={t}
                      tableFill="#efe6d8"
                      outline={selected === t.id ? "var(--primary)" : color}
                      sectionColor={color}
                      label={t.label}
                      rotation={rot}
                      className={cn("pointer-events-auto cursor-grab", spinRing)}
                      onPointerDown={(e) => onPointerDown(e, t.id, t.x, t.y)}
                    >
                      {selected === t.id ? (
                        <CornerHandle id={t.id} rot={rot} onCorner={(e, id) => startResize(e, id, "corner")} />
                      ) : null}
                    </FloorFixtureArt>
                  )}
                </div>
              );
            })}
          </div>
        </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Layout saves on this location as you drag. Handles turn with the piece. A wall’s black ends lengthen that wall; a corner resizes a table or booth. Scroll, pinch, or the zoom buttons change the zoom. Clicking or dragging a piece keeps that view. Space or the middle button pans. Fit room fills the workspace.
          </p>
        </div>

        <aside className="w-full shrink-0 space-y-4 border-t border-border bg-surface p-3 lg:w-80 lg:border-l lg:border-t-0">
          <div>
            <p className="mb-2 text-sm font-medium">Rooms / sections</p>
            <ul className="space-y-2">
              {floorSections.map((sec) => (
                <li key={sec.id} className="rounded-xl border border-border p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      className="h-8"
                      value={sec.name}
                      onChange={(e) => renameSection(sec.id, e.target.value)}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        const res = removeFloorSection(sec.id);
                        if (!res.ok) alert(res.error);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <label className="mt-1.5 block text-[11px] text-muted-foreground">
                    Receipt printer
                    <select
                      className="mt-0.5 h-8 w-full rounded-lg border border-border bg-bg px-2 text-xs text-foreground"
                      value={receiptPrinterForSection(locationDevices, sec.id)?.id ?? ""}
                      onChange={(e) => assignSectionPrinter(sec.id, "receipt", e.target.value)}
                    >
                      <option value="">None</option>
                      {receiptPrinters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="mt-1 block text-[11px] text-muted-foreground">
                    Bar printer
                    <select
                      className="mt-0.5 h-8 w-full rounded-lg border border-border bg-bg px-2 text-xs text-foreground"
                      value={barPrinterForSection(locationDevices, sec.id)?.id ?? ""}
                      onChange={(e) => assignSectionPrinter(sec.id, "bar", e.target.value)}
                    >
                      <option value="">
                        {barPrinters.length === 1 ? "All sections (only bar printer)" : "None"}
                      </option>
                      {barPrinters.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {SECTION_SWATCHES.map((sw) => (
                      <button
                        key={sw.id}
                        type="button"
                        title={sw.label}
                        onClick={() =>
                          upsertFloorSection({ id: sec.id, color: sw.id })
                        }
                        className={cn(
                          "h-6 w-6 rounded-full border-2",
                          sec.color === sw.id
                            ? "border-foreground"
                            : "border-transparent",
                        )}
                        style={{ background: swatchCss(sw.id) }}
                      />
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                className="h-8"
                placeholder="New room"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
              <Button
                size="sm"
                disabled={!newName.trim()}
                onClick={() => {
                  upsertFloorSection({
                    id: uid("sec"),
                    name: newName.trim(),
                    color: SECTION_SWATCHES[floorSections.length % 6].id,
                    sort: floorSections.length,
                  });
                  persistPrinterAssignments();
                  setNewName("");
                }}
              >
                Add
              </Button>
            </div>
          </div>

          {selectedTable ? (
            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-sm font-medium">
                Edit {selectedTable.kind ?? "table"} {selectedTable.label}
              </p>
              <label className="block text-xs text-muted-foreground">
                Label
                <Input
                  className="mt-1"
                  value={selectedTable.label}
                  onChange={(e) =>
                    update(selectedTable.id, { label: e.target.value })
                  }
                />
              </label>
              {selectedTable.kind === "bar_top" && (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Bar shape</p>
                  <div className="flex flex-wrap gap-1" data-bar-shape-picker>
                    {(["straight", "l", "u", "island", "polyline"] as BarTopShape[]).map((shape) => (
                      <Button
                        key={shape}
                        size="sm"
                        variant={(selectedTable.barShape ?? "straight") === shape ? "default" : "outline"}
                        onClick={() => {
                          const origin = storedBarPlan(selectedTable)[0] ?? {
                            x: selectedTable.x,
                            y: selectedTable.y,
                          };
                          const depth = barDepthIn(selectedTable.widthIn);
                          const legs = barLegsForShape(shape);
                          const points = planFromLegInches(shape, origin, legs, floorRoom);
                          const lengths = legLengthsOf(points);
                          const box = slabBounds(points, depth, floorRoom, shape === "island");
                          const nextBar = {
                            ...selectedTable,
                            ...box,
                            barShape: shape,
                            points,
                            legLengths: lengths,
                            widthIn: depth,
                          };
                          update(selectedTable.id, {
                            barShape: shape,
                            points,
                            legLengths: lengths,
                            ...box,
                            widthIn: depth,
                            lengthIn: Math.max(...legs),
                          });
                          for (const stool of tables) {
                            if (stool.kind !== "barstool") continue;
                            if (!stoolsOnRail(tables, selectedTable, floorRoom).includes(stool.id)) continue;
                            const snapped = snapStoolToRail(stool, [nextBar], floorRoom);
                            if (snapped) update(stool.id, snapped);
                          }
                          persistLocationCatalog("floor");
                        }}
                      >
                        {shape === "l" ? "L" : shape === "u" ? "U" : shape}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {selectedTable.kind === "bar_top" && (
                <div className="grid gap-2" data-bar-slab="">
                  {legInches(storedBarPlan(selectedTable), floorRoom)
                    .filter((inches) => inches > 1)
                    .map((inches, index) => (
                      <FeetInchesInput
                        key={`leg-${index}`}
                        label={index === 0 ? "Leg" : `Leg ${index + 1}`}
                        totalIn={inches}
                        testId={`bar-leg-${index}`}
                        onCommit={(next) => {
                          const plan = storedBarPlan(selectedTable);
                          const depth = barDepthIn(selectedTable.widthIn);
                          const points = resizeBarLeg(
                            plan,
                            selectedTable.barShape,
                            index,
                            next,
                            floorRoom,
                          );
                          const box = slabBounds(
                            points,
                            depth,
                            floorRoom,
                            barClosedShape(selectedTable.barShape, points),
                          );
                          update(selectedTable.id, {
                            points,
                            legLengths: legLengthsOf(points),
                            ...box,
                            widthIn: depth,
                            lengthIn: Math.round(Math.max(...legInches(points, floorRoom), next)),
                          });
                          persistLocationCatalog("floor");
                        }}
                      />
                    ))}
                  <label className="block text-xs text-muted-foreground" data-bar-depth="">
                    Counter depth (in)
                    <Input
                      className="mt-1 h-8"
                      inputMode="numeric"
                      data-bar-depth-input=""
                      defaultValue={barDepthIn(selectedTable.widthIn)}
                      key={barDepthIn(selectedTable.widthIn)}
                      onBlur={(e) => {
                        const parsed = parsePositiveInches(Number(e.target.value), 48);
                        if (parsed == null) return;
                        const plan = storedBarPlan(selectedTable);
                        const box = slabBounds(
                          plan,
                          parsed,
                          floorRoom,
                          barClosedShape(selectedTable.barShape, plan),
                        );
                        update(selectedTable.id, { widthIn: parsed, ...box });
                        persistLocationCatalog("floor");
                      }}
                    />
                  </label>
                  <div className="space-y-2" data-bar-stools="">
                    <p className="text-xs text-muted-foreground">Guest side</p>
                    {(selectedTable.barShape ?? "straight") === "island" ? (
                      <p className="text-xs">Around the perimeter.</p>
                    ) : (selectedTable.barShape ?? "straight") === "l" ||
                      (selectedTable.barShape ?? "straight") === "u" ? (
                      <div className="flex gap-1" data-bar-side="">
                        {(["outside", "inside"] as const).map((side) => (
                          <Button
                            key={side}
                            type="button"
                            size="sm"
                            variant={(selectedTable.barSide ?? "outside") === side ? "default" : "outline"}
                            onClick={() => chooseSide(selectedTable.id, side)}
                          >
                            {side === "outside" ? "Outside" : "Inside"}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex gap-1" data-bar-side="">
                        {(["a", "b"] as const).map((side) => (
                          <Button
                            key={side}
                            type="button"
                            size="sm"
                            variant={(selectedTable.barSide ?? "a") === side ? "default" : "outline"}
                            onClick={() => chooseSide(selectedTable.id, side)}
                          >
                            Guest side {side.toUpperCase()}
                          </Button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground">Stools</p>
                    {(selectedTable.barShape ?? "straight") === "l" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <StoolCount
                          label="Leg A"
                          value={stoolCounts.legA ?? 0}
                          onChange={(legA) => setStoolCounts({ ...stoolCounts, legA })}
                        />
                        <StoolCount
                          label="Leg B"
                          value={stoolCounts.legB ?? 0}
                          onChange={(legB) => setStoolCounts({ ...stoolCounts, legB })}
                        />
                        <label className="col-span-2 flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={Boolean(stoolCounts.corner)}
                            onChange={(e) => setStoolCounts({ ...stoolCounts, corner: e.target.checked })}
                          />
                          Corner seat
                        </label>
                      </div>
                    ) : (selectedTable.barShape ?? "straight") === "u" ? (
                      <div className="grid grid-cols-3 gap-2">
                        <StoolCount
                          label="Left"
                          value={stoolCounts.left ?? 0}
                          onChange={(left) => setStoolCounts({ ...stoolCounts, left })}
                        />
                        <StoolCount
                          label="Rear"
                          value={stoolCounts.rear ?? 0}
                          onChange={(rear) => setStoolCounts({ ...stoolCounts, rear })}
                        />
                        <StoolCount
                          label="Right"
                          value={stoolCounts.right ?? 0}
                          onChange={(right) => setStoolCounts({ ...stoolCounts, right })}
                        />
                      </div>
                    ) : (
                      <StoolCount
                        label={(selectedTable.barShape ?? "straight") === "island" ? "Around the island" : "Stools"}
                        value={stoolCounts.count ?? 0}
                        onChange={(count) => setStoolCounts({ ...stoolCounts, count })}
                      />
                    )}
                    <Button type="button" size="sm" onClick={() => placeStools(selectedTable.id, false)}>
                      Generate stools
                    </Button>
                    {replaceStools && (
                      <p className="text-xs text-muted-foreground">
                        {pendingSide
                          ? "Move the stools onto that side?"
                          : "Replace the stools already on this bar?"}
                        <span className="mt-1 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              placeStools(selectedTable.id, true, pendingSide ?? selectedTable.barSide)
                            }
                          >
                            Replace
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={() => setReplaceStools(false)}>
                            Cancel
                          </Button>
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              )}
              {!isArchitectureKind(selectedTable.kind) && (
              <label className="block text-xs text-muted-foreground">
                Seats
                <Input
                  className="mt-1"
                  type="number"
                  min={asBoothKind(selectedTable.kind, selectedTable.shape)
                    ? BOOTH_DEFAULTS[asBoothKind(selectedTable.kind, selectedTable.shape)!].minSeats
                    : 1}
                  max={asBoothKind(selectedTable.kind, selectedTable.shape)
                    ? BOOTH_DEFAULTS[asBoothKind(selectedTable.kind, selectedTable.shape)!].maxSeats
                    : 20}
                  value={selectedTable.seats}
                  onChange={(e) => {
                    const booth = asBoothKind(selectedTable.kind, selectedTable.shape);
                    const raw = parseInt(e.target.value, 10) || 1;
                    update(selectedTable.id, {
                      seats: booth ? clampBoothSeats(booth, raw) : Math.max(1, raw),
                    });
                  }}
                />
              </label>
              )}
              <label className="block text-xs text-muted-foreground">
                Room / section
                <select
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-bg px-3 text-sm"
                  value={selectedTable.section}
                  onChange={(e) =>
                    update(selectedTable.id, { section: e.target.value })
                  }
                >
                  {floorSections.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {!floorSections.some(
                    (s) => s.name === selectedTable.section,
                  ) && (
                    <option value={selectedTable.section}>
                      {selectedTable.section}
                    </option>
                  )}
                </select>
              </label>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Kind</p>
                <div className="flex flex-wrap gap-1">
                  {KINDS.map((k) => (
                    <Button
                      key={k.id}
                      size="sm"
                      variant={
                        (asBoothKind(selectedTable.kind, selectedTable.shape) ??
                          selectedTable.kind ??
                          "table") === k.id
                          ? "default"
                          : "outline"
                      }
                      onClick={() => {
                        const booth = k.booth;
                        const spec = DEFAULT_OBJECT_IN[k.id] ?? DEFAULT_OBJECT_IN.table!;
                        const sized = sizePatch(spec.lengthIn, spec.widthIn, floorRoom, {
                          round: k.shape === "round",
                        });
                        const barOrigin = { x: selectedTable.x, y: selectedTable.y };
                        const barLegs = barLegsForShape("straight");
                        const points =
                          k.id === "bar_top"
                            ? planFromLegInches("straight", barOrigin, barLegs, floorRoom)
                            : undefined;
                        const barBox = points ? slabBounds(points, 24, floorRoom, false) : null;
                        update(selectedTable.id, {
                          kind: k.id,
                          shape: k.shape,
                          seats: booth
                            ? clampBoothSeats(booth, selectedTable.seats)
                            : selectedTable.seats,
                          ...(k.id === "bar_top" && barBox && points
                            ? {
                                ...barBox,
                                lengthIn: barLegs[0],
                                widthIn: 24,
                                barShape: "straight" as const,
                                points,
                                legLengths: legLengthsOf(points),
                              }
                            : sized
                              ? { w: sized.w, h: sized.h, lengthIn: sized.lengthIn, widthIn: sized.widthIn }
                              : {}),
                        });
                        persistLocationCatalog("floor");
                      }}
                    >
                      {k.booth ? <FloorBoothIcon kind={k.booth} /> : null}
                      {k.label}
                    </Button>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                data-floor-copy=""
                onClick={() => {
                  setCopyCount("1");
                  setCopyOpen(true);
                }}
              >
                <Copy className="h-3.5 w-3.5" />
                Copy
              </Button>
              <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
                <DialogContent data-floor-copy-dialog="">
                  <DialogHeader>
                    <DialogTitle>How many copies?</DialogTitle>
                  </DialogHeader>
                  <Input
                    data-floor-copy-count=""
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    value={copyCount}
                    onChange={(e) => setCopyCount(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") applyCopies();
                    }}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCopyOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="button" data-floor-copy-confirm="" disabled={!copyCountOk} onClick={applyCopies}>
                      Copy
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                data-floor-rotate
                onClick={() => {
                  update(selectedTable.id, {
                    rotation: nextBoothRotation(selectedTable.rotation),
                  });
                  void flushLocationCatalog("floor");
                }}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Rotate 90°
              </Button>
              {selectedTable.kind === "bar_top" ? null : (
              <ObjectSizeFields
                table={selectedTable}
                room={floorRoom}
                onSize={(lengthIn, widthIn) => {
                  const patch = sizePatch(lengthIn, widthIn, floorRoom, {
                    round: selectedTable.shape === "round",
                  });
                  if (!patch) return;
                  const points =
                    selectedTable.kind === "bar_top" && selectedTable.points && selectedTable.points.length >= 2
                      ? selectedTable.points.map((p) => ({
                          x: selectedTable.x + ((p.x - selectedTable.x) / Math.max(0.4, selectedTable.w)) * patch.w,
                          y: selectedTable.y + ((p.y - selectedTable.y) / Math.max(0.4, selectedTable.h)) * patch.h,
                        }))
                      : undefined;
                  update(selectedTable.id, {
                    ...patch,
                    ...(points ? { points, legLengths: legLengthsOf(points) } : {}),
                  });
                  persistLocationCatalog("floor");
                }}
              />
              )}
              {!isBoothKind(selectedTable.kind, selectedTable.shape) && (
              <div className="flex gap-1">
                {(["rect", "round", "bar", "other"] as const).map((shape) => (
                  <Button
                    key={shape}
                    size="sm"
                    variant={
                      selectedTable.shape === shape ? "default" : "outline"
                    }
                    onClick={() => update(selectedTable.id, { shape })}
                    className="capitalize"
                  >
                    {shape}
                  </Button>
                ))}
              </div>
              )}
              <div className="rounded-xl border border-border bg-bg p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">Table QR</p>
                  <Button size="sm" variant="ghost" onClick={() => setShowQr((v) => !v)}>
                    <QrCode className="h-3.5 w-3.5" />
                    {showQr ? "Hide" : "Show"}
                  </Button>
                </div>
                <p className="mt-1 break-all text-[11px] text-muted-foreground">
                  {selectedTable.qrToken ?? "token on save"}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2 w-full"
                  onClick={() => {
                    const res = rotateTableQr(selectedTable.id);
                    if (!res.ok) alert(res.error);
                  }}
                >
                  Rotate token
                </Button>
                {showQr && (
                  <div className="mt-2 text-center">
                    <QrMark
                      value={tableGuestUrl(selectedTable, { demoType })}
                      size={140}
                    />
                  </div>
                )}
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                data-floor-delete=""
                onClick={deleteSelection}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {selection.length > 1 ? `Delete ${selection.length}` : "Delete"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a fixture to edit. Shift-click or drag a box to select several. Drag to move, corner to resize, Copy, Rotate 90°. Booths keep benches attached.
            </p>
          )}
        </aside>
      </div>
      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setPendingKind(null);
        }}
      >
        <DialogContent data-floor-add-count="">
          <DialogHeader>
            <DialogTitle>{ADD_COUNT_TITLE}</DialogTitle>
          </DialogHeader>
          <Input
            data-floor-add-count-input=""
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={addCount}
            onChange={(event) => setAddCount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") confirmAdd();
            }}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" data-floor-add-count-confirm="" disabled={!addCountOk} onClick={confirmAdd}>
              Place
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={renumberOpen} onOpenChange={setRenumberOpen}>
        <DialogContent data-floor-renumber-dialog="">
          <DialogHeader>
            <DialogTitle>{RENUMBER_CONFIRM}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenumberOpen(false)}>
              Cancel
            </Button>
            <Button type="button" data-floor-renumber-confirm="" onClick={confirmRenumber}>
              Reset numbers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent data-floor-clear-dialog="">
          <DialogHeader>
            <DialogTitle>{CLEAR_SLATE_CONFIRM}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClearOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" data-floor-clear-confirm="" onClick={confirmClear}>
              Remove all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent data-floor-delete-dialog="">
          <DialogHeader>
            <DialogTitle>{multiDeleteConfirm(selection.length) ?? "Remove objects?"}</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              data-floor-delete-confirm=""
              onClick={() => {
                setDeleteOpen(false);
                removeIds(selectionRef.current);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
