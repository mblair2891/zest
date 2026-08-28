import { useRef, useState } from "react";
import { Plus, Trash2, QrCode } from "lucide-react";
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
import { tableGuestUrl } from "@/lib/pos/qr-table";
import { getDemoType } from "@/lib/demo/session";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { QrMark } from "./QrMark";
import { persistLocationCatalog } from "@/lib/pos/persist-location-setup";

const KINDS: { id: TableKind; label: string; shape: "rect" | "round" | "bar" | "booth" | "other"; w: number; h: number; seats: number }[] = [
  { id: "table", label: "Table", shape: "round", w: 12, h: 12, seats: 4 },
  { id: "booth", label: "Booth", shape: "booth", w: 16, h: 12, seats: 4 },
  { id: "barstool", label: "Barstool", shape: "bar", w: 8, h: 8, seats: 1 },
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
      const nw = Math.min(40, Math.max(6, resize.current.origW + dw));
      const nh = Math.min(40, Math.max(6, resize.current.origH + dh));
      update(resize.current.id, {
        w: Math.round(nw * 10) / 10,
        h: Math.round(nh * 10) / 10,
      });
      return;
    }
    if (!drag.current) return;
    const dx = ((e.clientX - drag.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.current.startY) / rect.height) * 100;
    const nx = Math.min(90, Math.max(0, drag.current.origX + dx));
    const ny = Math.min(90, Math.max(0, drag.current.origY + dy));
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
    const count = tables.filter((t) => t.kind === kind.id || (!t.kind && kind.id === "table")).length;
    const id = add({
      x: 20 + (count % 5) * 12,
      y: 20 + Math.floor(count / 5) * 14,
      section: dining,
      seats: kind.seats,
      shape: kind.shape,
      kind: kind.id,
      w: kind.w,
      h: kind.h,
      label:
        kind.id === "barstool"
          ? `B${tables.filter((t) => t.section === "Bar" || t.kind === "barstool").length + 1}`
          : undefined,
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
              <Plus className="h-3.5 w-3.5" />
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
              const kind = t.kind ?? (t.shape === "bar" ? "barstool" : t.shape === "booth" ? "booth" : "table");
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
                    boxShadow: `inset 0 3px 0 0 ${color}`,
                  }}
                  className={cn(
                    "absolute flex cursor-grab flex-col items-center justify-center border-2 bg-surface-2 text-center active:cursor-grabbing",
                    t.shape === "round" || t.shape === "bar" || kind === "barstool"
                      ? "rounded-full"
                      : kind === "booth"
                        ? "rounded-2xl"
                        : "rounded-xl",
                    selected === t.id
                      ? "border-primary ring-2 ring-primary/40"
                      : "border-border",
                    (t.mergedChildIds?.length ?? 0) > 0 && "border-info",
                  )}
                >
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t.section}
                  </span>
                  {selected === t.id && (
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 cursor-nwse-resize rounded-sm bg-primary"
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
              <label className="block text-xs text-muted-foreground">
                Seats
                <Input
                  className="mt-1"
                  type="number"
                  value={selectedTable.seats}
                  onChange={(e) =>
                    update(selectedTable.id, {
                      seats: Math.max(1, parseInt(e.target.value, 10) || 1),
                    })
                  }
                />
              </label>
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
                        (selectedTable.kind ?? "table") === k.id
                          ? "default"
                          : "outline"
                      }
                      onClick={() =>
                        update(selectedTable.id, {
                          kind: k.id,
                          shape: k.shape,
                        })
                      }
                    >
                      {k.label}
                    </Button>
                  ))}
                </div>
              </div>
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
              <div className="flex gap-1">
                {(["rect", "round", "bar", "booth", "other"] as const).map((shape) => (
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
              Select a seat to edit. Drag to move, corner to resize. Add table, booth, barstool, or other.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
