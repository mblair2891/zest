import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";

export function InventoryView() {
  const inventory = usePosStore((s) => s.inventory);
  const receiveInventory = usePosStore((s) => s.receiveInventory);
  const updateInventory = usePosStore((s) => s.updateInventory);

  const low = inventory.filter((i) => i.lowStock).length;

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="text-sm font-semibold">Inventory</h2>
        {low > 0 && (
          <Badge variant="warn" className="tabular">
            {low} below par
          </Badge>
        )}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2.5 font-medium">Item</th>
              <th className="px-3 py-2.5 font-medium">On hand</th>
              <th className="px-3 py-2.5 font-medium">Par</th>
              <th className="px-3 py-2.5 font-medium">Cost</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-bg">
            {inventory.map((item) => (
              <tr key={item.id} className="hover:bg-surface/50">
                <td className="px-3 py-3 font-medium">
                  {item.name}
                  <span className="ml-1 text-xs text-muted-foreground">
                    / {item.unit}
                  </span>
                </td>
                <td className="px-3 py-3 tabular">{item.onHand}</td>
                <td className="px-3 py-3 tabular text-muted-foreground">
                  {item.par}
                </td>
                <td className="px-3 py-3 tabular">
                  {formatCurrency(item.costCents)}
                </td>
                <td className="px-3 py-3">
                  <Badge variant={item.lowStock ? "warn" : "success"}>
                    {item.lowStock ? "Low" : "OK"}
                  </Badge>
                </td>
                <td className="px-3 py-3">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => receiveInventory(item.id, 1)}
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => receiveInventory(item.id, 5)}
                    >
                      +5
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateInventory(item.id, { onHand: Math.max(0, item.onHand - 1) })
                      }
                    >
                      −1
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
