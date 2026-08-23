import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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

export function FloorEditorView() {
  const tables = usePosStore((s) => s.tables);
  const floorSections = usePosStore((s) => s.floorSections);
  const update = usePosStore((s) => s.updateTableLayout);
  const add = usePosStore((s) => s.addFloorTable);
  const remove = usePosStore((s) => s.removeFloorTable);
  const upsertFloorSection = usePosStore((s) => s.upsertFloorSection);
  const removeFloorSection = usePosStore((s) => s.removeFloorSection);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const selectedTable = tables.find((t) => t.id === selected);

  const onPointerDown = (
    e: React.PointerEvent,
    id: string,
    x: number,
    y: number,
  ) => {
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

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const dx = ((e.clientX - drag.current.startX) / rect.width) * 100;
    const dy = ((e.clientY - drag.current.startY) / rect.height) * 100;
    const nx = Math.min(90, Math.max(0, drag.current.origX + dx));
    const ny = Math.min(90, Math.max(0, drag.current.origY + dy));
    update(drag.current.id, { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
  };

  const onPointerUp = () => {
    drag.current = null;
  };

  const renameSection = (id: string, name: string) => {
    const prev = floorSections.find((s) => s.id === id);
    upsertFloorSection({ id, name });
    if (prev && prev.name !== name) {
      for (const t of tables) {
        if (t.section === prev.name) update(t.id, { section: name });
      }
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">Floor plan editor</h2>
        <Badge variant="secondary">Drag tables · color-coded sections</Badge>
        <SetupAssistButton domain="floor" label="Add by voice or text" />
        <div className="ml-auto flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              const dining = floorSections[0]?.name ?? "Dining";
              const id = add({ x: 45, y: 45, section: dining });
              setSelected(id);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add table
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              add({
                label: `B${tables.filter((t) => t.section === "Bar").length + 1}`,
                section: "Bar",
                seats: 1,
                shape: "bar",
                w: 8,
                h: 8,
                x: 10 + tables.filter((t) => t.section === "Bar").length * 10,
                y: 82,
              })
            }
          >
            Add bar seat
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[300px] flex-1 p-3">
          <div
            ref={boardRef}
            className="relative mx-auto aspect-[4/3] w-full max-w-4xl touch-none rounded-2xl border border-border bg-surface"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {tables
              .filter((t) => !t.mergedIntoId)
              .map((t) => {
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
                      boxShadow: `inset 0 3px 0 0 ${color}`,
                    }}
                    className={cn(
                      "absolute flex cursor-grab flex-col items-center justify-center border-2 bg-surface-2 text-center active:cursor-grabbing",
                      t.shape === "round" || t.shape === "bar"
                        ? "rounded-full"
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
                  </button>
                );
              })}
          </div>
        </div>

        <aside className="w-full shrink-0 space-y-4 border-t border-border bg-surface p-3 lg:w-80 lg:border-l lg:border-t-0">
          <div>
            <p className="mb-2 text-sm font-medium">Sections</p>
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
                placeholder="New section"
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
                Edit table {selectedTable.label}
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
                Section
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
                {(["rect", "round", "bar"] as const).map((shape) => (
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
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                onClick={() => {
                  const res = remove(selectedTable.id);
                  if (!res.ok) alert(res.error);
                  else setSelected(null);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete table
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a table to edit. Drag on the canvas to reposition.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
