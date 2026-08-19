import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import { computeTotals } from "@/lib/pos/calculations";
import { formatCurrency, formatTime } from "@/lib/utils";

export function TakeoutView() {
  const orders = usePosStore((s) => s.orders);
  const settings = usePosStore((s) => s.settings);
  const openTakeout = usePosStore((s) => s.openTakeout);
  const openBarTab = usePosStore((s) => s.openBarTab);
  const setActiveOrder = usePosStore((s) => s.setActiveOrder);
  const setView = usePosStore((s) => s.setView);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"takeout" | "tab">("takeout");

  const list = orders.filter(
    (o) =>
      o.status === "open" &&
      (o.type === "takeout" || o.type === "delivery" || o.type === "bar_tab"),
  );

  return (
    <div className="flex h-full flex-col p-3">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Takeout & tabs</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setMode("tab");
              setOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Bar tab
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setMode("takeout");
              setOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Takeout
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((o) => {
          const tot = computeTotals(o, settings);
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => {
                setActiveOrder(o.id);
                setView("order");
              }}
              className="rounded-xl border border-border bg-surface p-4 text-left transition hover:border-border-strong"
            >
              <p className="font-medium">
                {o.tabName || "Guest"}{" "}
                <span className="text-xs font-normal capitalize text-muted-foreground">
                  {o.type.replace("_", " ")}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                #{o.number} · {formatTime(o.createdAt)} · {o.serverName}
              </p>
              <p className="mt-2 text-lg font-semibold tabular">
                {formatCurrency(tot.balanceCents || tot.totalCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                {o.lines.filter((l) => !l.voided).length} items
              </p>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
            No open takeout orders or bar tabs
          </p>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {mode === "takeout" ? "New takeout order" : "Open bar tab"}
            </DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Guest name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                if (mode === "takeout") openTakeout(name.trim());
                else openBarTab(name.trim());
                setName("");
                setOpen(false);
              }}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
