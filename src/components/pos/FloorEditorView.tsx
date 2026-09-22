import { useRef, useState } from "react";
import { Plus, Trash2, QrCode, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { cn, uid } from "@/lib/utils";
import { SetupAssistButton } from "@/components/assist/SetupAssistDialog";
import {
  SECTION_SWATCHES,
  sectionColorForTable,
  swatchCss,
} from "@/lib/pos/section-control";
import type { TableKind } from "@/lib/pos/types";
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
import { flushLocationCatalog, persistLocationCatalog, persistPrinterAssignments } from "@/lib/pos/persist-location-setup";
import { FloorArchitectureMark } from "@/components/pos/FloorArchitectureMark";
import {
  isArchitectureKind,
  snapPct,
  snapStoolToRail,
  type BarTopShape,
} from "@/lib/pos/floor-architecture";
import {
  barPrinterForSection,
  isBarOrderPrinter,
  receiptPrinterForSection,
  setSectionPrinter,
} from "@/lib/print/printer-assignment";
import { isReceiptPrinterType } from "@/lib/pos/location-devices";

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
  const update = usePosStore((s) => s.updateTableLayout);
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
  const [newName, setNewName] = useState("");
  const [room, setRoom] = useState<string>("All");
  const [scope, setScope] = useState<"entire" | "section">("entire");
  const [showQr, setShowQr] = useState(false);
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const resize = useRef<{
    id: string;
    startX: number;
    startY: number;
    origW: number;
    origH: number;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
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
    if (resize.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
    };
    setSelected(id);
  };

  const onResizeDown = (
    e: React.PointerEvent,
    id: string,
    w: number,
    h: number,
  ) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = null;
    resize.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origW: w,
      origH: h,
    };
    setSelected(id);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    if (resize.current) {
      const dw = ((e.clientX - resize.current.startX) / rect.width) * 100;
      const dh = ((e.clientY - resize.current.startY) / rect.height) * 100;
      const target = tables.find((t) => t.id === resize.current?.id);
      const thin = target && (target.kind === "wall" || target.kind === "door" || target.kind === "window");
      const arch = isArchitectureKind(target?.kind);
      const nw = Math.min(arch ? 100 : 40, Math.max(thin ? 2 : 6, resize.current.origW + dw));
      const nh = thin
        ? resize.current.origH
        : Math.min(arch ? 100 : 40, Math.max(6, resize.current.origH + dh));
      update(resize.current.id, {
        w: thin || arch ? snapPct(nw) : Math.round(nw * 10) / 10,
        h: thin ? target?.h ?? nh : Math.round(nh * 10) / 10,
      });
      return;
    }
    if (!drag.current) return;
    const dx = ((e.clientX - drag.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.current.startY) / rect.height) * 100;
    const target = tables.find((t) => t.id === drag.current?.id);
    let nx = Math.min(90, Math.max(0, drag.current.origX + dx));
    let ny = Math.min(90, Math.max(0, drag.current.origY + dy));
    if (isArchitectureKind(target?.kind)) {
      nx = snapPct(nx);
      ny = snapPct(ny);
    }
    if (target?.kind === "barstool") {
      const snapped = snapStoolToRail(
        { x: nx, y: ny, w: target.w, h: target.h },
        tables,
      );
      if (snapped && Math.hypot(snapped.x - nx, snapped.y - ny) < 8) {
        nx = snapped.x;
        ny = snapped.y;
      }
    }
    update(drag.current.id, { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
  };

  const onPointerUp = () => {
    if (drag.current || resize.current) persistLocationCatalog("floor");
    drag.current = null;
    resize.current = null;
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

  const placeKind = (kind: (typeof KINDS)[number]) => {
    const dining =
      room !== "All" ? room : floorSections[0]?.name ?? "Dining";
    const sec = floorSections.find((s) => s.name === dining);
    const count = tables.filter((t) => t.kind === kind.id || (!t.kind && kind.id === "table")).length;
    const booth = kind.booth;
    const seats = booth ? BOOTH_DEFAULTS[booth].seats : kind.seats;
    const id = add({
      x: 20 + (count % 5) * 12,
      y: 20 + Math.floor(count / 5) * 14,
      section: dining,
      sectionId: sec?.id,
      seats,
      shape: kind.shape,
      kind: kind.id,
      w: kind.w,
      h: kind.h,
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
    });
    setSelected(id);
    persistLocationCatalog("floor");
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
            <Button key={k.id} size="sm" variant="outline" onClick={() => placeKind(k)}>
              {k.booth ? <FloorBoothIcon kind={k.booth} /> : <Plus className="h-3.5 w-3.5" />}
              {k.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[300px] flex-1 p-3">
          <div
            ref={boardRef}
            className="relative mx-auto aspect-[4/3] w-full max-w-4xl touch-none rounded-2xl border border-border bg-surface"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {visible.map((t) => {
              const color = sectionColorForTable(t, floorSections);
              return (
                <button
                  key={t.id}
                  type="button"
                  onPointerDown={(e) => onPointerDown(e, t.id, t.x, t.y)}
                  style={{
                    left: `${t.x}%`,
                    top: `${t.y}%`,
                    width: `${t.w}%`,
                    height: `${t.h}%`,
                  }}
                  data-floor-rotation={((Number(t.rotation) || 0) % 360 + 360) % 360}
                  className={cn(
                    "absolute cursor-grab overflow-visible border-0 bg-transparent p-0 text-center active:cursor-grabbing",
                    selected === t.id && "ring-2 ring-primary/40",
                    (t.mergedChildIds?.length ?? 0) > 0 && "ring-1 ring-info",
                  )}
                >
                  {isArchitectureKind(t.kind) ? (
                    <FloorArchitectureMark table={t} />
                  ) : (
                  <FloorFixtureArt
                    table={t}
                    tableFill="#efe6d8"
                    outline={selected === t.id ? "var(--primary)" : color}
                    sectionColor={color}
                    label={t.label}
                    rotation={t.rotation ?? 0}
                  />
                  )}
                  {selected === t.id && (
                    <span
                      className="absolute bottom-0 right-0 z-10 h-3 w-3 cursor-nwse-resize rounded-sm bg-primary"
                      onPointerDown={(e) => onResizeDown(e, t.id, t.w, t.h)}
                    />
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Layout saves on this location as you drag. Corner handle resizes. Rooms are sections.
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
                          update(selectedTable.id, {
                            barShape: shape,
                            points:
                              shape === "polyline"
                                ? selectedTable.points ?? [
                                    { x: 8, y: 70 },
                                    { x: 40, y: 20 },
                                    { x: 92, y: 70 },
                                  ]
                                : selectedTable.points,
                          });
                          persistLocationCatalog("floor");
                        }}
                      >
                        {shape === "l" ? "L" : shape === "u" ? "U" : shape}
                      </Button>
                    ))}
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
                        update(selectedTable.id, {
                          kind: k.id,
                          shape: k.shape,
                          seats: booth
                            ? clampBoothSeats(booth, selectedTable.seats)
                            : selectedTable.seats,
                          w: booth ? BOOTH_DEFAULTS[booth].w : selectedTable.w,
                          h: booth ? BOOTH_DEFAULTS[booth].h : selectedTable.h,
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
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-muted-foreground">
                  W %
                  <Input
                    className="mt-1"
                    type="number"
                    value={selectedTable.w}
                    onChange={(e) =>
                      update(selectedTable.id, {
                        w: Math.max(6, parseFloat(e.target.value) || 10),
                      })
                    }
                  />
                </label>
                <label className="block text-xs text-muted-foreground">
                  H %
                  <Input
                    className="mt-1"
                    type="number"
                    value={selectedTable.h}
                    onChange={(e) =>
                      update(selectedTable.id, {
                        h: Math.max(6, parseFloat(e.target.value) || 10),
                      })
                    }
                  />
                </label>
              </div>
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
                onClick={() => {
                  const res = remove(selectedTable.id);
                  if (!res.ok) alert(res.error);
                  else {
                    setSelected(null);
                    persistLocationCatalog("floor");
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a fixture to edit. Drag to move, corner to resize, Rotate 90°. Booths keep benches attached.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
