import { Ban, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
import { isHappyHour } from "@/lib/pos/calculations";

export function MenuAdminView() {
  const categories = usePosStore((s) => s.categories);
  const menuItems = usePosStore((s) => s.menuItems);
  const settings = usePosStore((s) => s.settings);
  const toggleItemAvailable = usePosStore((s) => s.toggleItemAvailable);
  const happy = isHappyHour(settings);

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Menu & 86 board</h2>
        {happy && <Badge variant="success">Happy hour active</Badge>}
        <p className="w-full text-xs text-muted-foreground">
          Toggle availability to 86 items. Stock-tracked items auto-disable at
          zero.
        </p>
      </div>

      {categories.length === 0 && menuItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold">Menu is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            This location was onboarded without demo items. Add categories here, or
            import a CSV later from settings.
          </p>
        </div>
      )}

      {categories
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((cat) => {
          const items = menuItems.filter((m) => m.categoryId === cat.id);
          return (
            <section key={cat.id} className="mb-6">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: cat.color }}
                />
                {cat.name}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <p className="text-xs tabular text-muted-foreground">
                        {formatCurrency(item.priceCents)}
                        {item.happyHourPriceCents != null && (
                          <span className="ml-2 text-success">
                            HH {formatCurrency(item.happyHourPriceCents)}
                          </span>
                        )}
                        {item.trackStock && (
                          <span className="ml-2">stock {item.stock ?? 0}</span>
                        )}
                      </p>
                    </div>
                    <Badge variant={item.available ? "success" : "danger"}>
                      {item.available ? "Live" : "86"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => toggleItemAvailable(item.id)}
                      title={item.available ? "86 item" : "Restore"}
                    >
                      {item.available ? (
                        <Ban className="h-4 w-4" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}
