import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { computeTotals } from "@/lib/pos/calculations";
import { formatCurrency } from "@/lib/utils";
import { canEmployee } from "@/lib/access/permissions";
import type { SplitSpec } from "@/lib/pos/check-ops";

export function CheckOpsDialog({
  open,
  onOpenChange,
  orderId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orderId: string;
}) {
  const orders = usePosStore((s) => s.orders);
  const tables = usePosStore((s) => s.tables);
  const settings = usePosStore((s) => s.settings);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const splitCheck = usePosStore((s) => s.splitCheck);
  const combineChecks = usePosStore((s) => s.combineChecks);
  const moveLines = usePosStore((s) => s.moveLines);
  const moveCheck = usePosStore((s) => s.moveCheck);
  const order = orders.find((o) => o.id === orderId);
  const [tab, setTab] = useState<"split" | "combine" | "move">("split");
  const [mode, setMode] = useState<SplitSpec["mode"]>("items");
  const [parts, setParts] = useState(2);
  const [amounts, setAmounts] = useState("50,50");
  const [selected, setSelected] = useState<string[]>([]);
  const [targetId, setTargetId] = useState("");
  const [destTable, setDestTable] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const totals = order ? computeTotals(order, settings) : null;
  const openOthers = orders.filter((o) => o.status === "open" && o.id !== orderId);
  const destTables = tables.filter((t) => !t.mergedIntoId);
  const allowed = canEmployee(emp, "checks:mutate");

  const lineChoices = useMemo(
    () => (order ? order.lines.filter((l) => !l.voided) : []),
    [order],
  );

  if (!order) return null;

  const run = () => {
    setErr(null);
    if (!allowed) {
      setErr("This role cannot split or move checks");
      return;
    }
    let res: { ok: boolean; error?: string } = { ok: false, error: "Nothing to do" };
    if (tab === "split") {
      let spec: SplitSpec = { mode: "items", lineIds: selected };
      if (mode === "seat") spec = { mode: "seat" };
      else if (mode === "even") spec = { mode: "even", parts };
      else if (mode === "custom_amount") {
        const cents = amounts
          .split(/[,\s]+/)
          .map((s) => Math.round(Number(s) * 100))
          .filter((n) => n > 0);
        spec = { mode: "custom_amount", amountsCents: cents };
      } else spec = { mode: "items", lineIds: selected };
      res = splitCheck(order.id, spec);
    } else if (tab === "combine") {
      if (!targetId) {
        setErr("Pick a target check");
        return;
      }
      res = combineChecks(order.id, targetId);
    } else if (tab === "move") {
      if (selected.length && targetId) {
        res = moveLines(order.id, targetId, selected, destTable || undefined);
      } else if (destTable) {
        res = moveCheck(order.id, destTable);
      } else {
        setErr("Select items and a check, or pick a destination table");
        return;
      }
    }
    if (!res.ok) {
      setErr(res.error ?? "Failed");
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Split / combine / move · #{order.number}</DialogTitle>
        </DialogHeader>
        <div className="flex gap-1">
          {(["split", "combine", "move"] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={tab === t ? "default" : "outline"}
              onClick={() => setTab(t)}
            >
              {t === "split" ? "Split" : t === "combine" ? "Combine" : "Move"}
            </Button>
          ))}
        </div>
        {totals && (
          <p className="text-xs text-muted-foreground">
            Remaining {formatCurrency(totals.balanceCents)} · lines keep operator tags
          </p>
        )}
        {tab === "split" && (
          <div className="space-y-3">
            <label className="block text-sm">
              How
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={mode}
                onChange={(e) => setMode(e.target.value as SplitSpec["mode"])}
              >
                <option value="items">Selected items → new check</option>
                <option value="seat">By seat</option>
                <option value="even">Even split of items</option>
                <option value="custom_amount">Custom $ shares</option>
              </select>
            </label>
            {mode === "even" && (
              <label className="block text-sm">
                Parts
                <Input
                  type="number"
                  min={2}
                  max={8}
                  value={parts}
                  onChange={(e) => setParts(Number(e.target.value) || 2)}
                />
              </label>
            )}
            {mode === "custom_amount" && (
              <label className="block text-sm">
                Amounts in dollars, comma separated
                <Input value={amounts} onChange={(e) => setAmounts(e.target.value)} />
              </label>
            )}
            {(mode === "items" || mode === "even") && (
              <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                {lineChoices.map((l) => (
                  <li key={l.id}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.includes(l.id)}
                        onChange={(e) =>
                          setSelected((cur) =>
                            e.target.checked ? [...cur, l.id] : cur.filter((id) => id !== l.id),
                          )
                        }
                      />
                      {l.quantity}× {l.name}
                      {l.vendorName ? ` · ${l.vendorName}` : ""}
                      {l.seat ? ` · seat ${l.seat}` : ""}
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {tab === "combine" && (
          <label className="block text-sm">
            Target check
            <select
              className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              <option value="">Select…</option>
              {openOthers.map((o) => {
                const t = tables.find((x) => x.id === o.tableId);
                return (
                  <option key={o.id} value={o.id}>
                    #{o.number} {t ? `T${t.label}` : o.tabName ?? o.type}
                  </option>
                );
              })}
            </select>
          </label>
        )}
        {tab === "move" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Move selected items onto another check, or move the whole check to a table.
            </p>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
              {lineChoices.map((l) => (
                <li key={l.id}>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected.includes(l.id)}
                      onChange={(e) =>
                        setSelected((cur) =>
                          e.target.checked ? [...cur, l.id] : cur.filter((id) => id !== l.id),
                        )
                      }
                    />
                    {l.quantity}× {l.name}
                    {l.vendorName ? ` · ${l.vendorName}` : ""}
                  </label>
                </li>
              ))}
            </ul>
            <label className="block text-sm">
              Destination check (optional)
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
              >
                <option value="">New check if items selected</option>
                {openOthers.map((o) => (
                  <option key={o.id} value={o.id}>
                    #{o.number}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              Destination table
              <select
                className="mt-1 h-10 w-full rounded-md border border-border bg-bg px-2 text-sm"
                value={destTable}
                onChange={(e) => setDestTable(e.target.value)}
              >
                <option value="">Keep table</option>
                {destTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label} · {t.section}
                    {t.orderId ? " · occupied" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {err && <p className="text-sm text-danger">{err}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={run}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
