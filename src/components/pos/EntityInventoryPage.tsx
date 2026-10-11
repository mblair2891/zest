import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { usePosStore } from "@/lib/pos/store";
import { useCostStore } from "@/lib/costs/store";
import { entityLoginScope, HOST_SCOPE, isHostPrivileged } from "@/lib/access/entity-grants";
import { useDemoOperatingEntityId } from "@/lib/demo/use-demo-operating-entity";
import { persistLocationCatalog } from "@/lib/pos/persist-location-setup";
import {
  INVENTORY_GRANT_ROLES,
  canOpenEntityInventory,
  entityInventoryRows,
  filterInventoryRows,
  formatOnHand,
  inventoryWhenLabel,
  type InventoryFilter,
  type InventoryRow,
} from "@/lib/costs/entity-inventory";

const GRANT_LABEL: Record<(typeof INVENTORY_GRANT_ROLES)[number], string> = {
  supervisor: "Supervisor",
  server: "Server",
  bartender: "Bartender",
  kitchen: "Kitchen",
  host: "Host",
  cashier: "Cashier",
  busser: "Busser",
  accountant: "Accountant",
};

export function EntityInventoryPage() {
  const demoScope = useDemoOperatingEntityId();
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const menuItems = usePosStore((s) => s.menuItems);
  const vendors = usePosStore((s) => s.vendors);
  const skus = useCostStore((s) => s.skus);
  const granted = useCostStore((s) => s.settings.inventoryAccessRoles);
  const loginScope = entityLoginScope(emp);
  const [picked, setPicked] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<InventoryFilter>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const entityId = demoScope || loginScope || picked || "";

  const entities = useMemo(
    () => vendors.filter((v) => v.active && v.id !== HOST_SCOPE),
    [vendors],
  );
  const entityName = entities.find((v) => v.id === entityId)?.name || "This entity";
  const rows = useMemo(
    () => entityInventoryRows(entityId, menuItems, skus),
    [entityId, menuItems, skus],
  );
  const visible = useMemo(
    () => filterInventoryRows(rows, query, filter),
    [rows, query, filter],
  );

  if (!emp) {
    return (
      <p className="text-sm text-muted-foreground" data-entity-inventory>
        Opening inventory…
      </p>
    );
  }
  if (!canOpenEntityInventory(emp, granted)) {
    return (
      <p className="text-sm text-muted-foreground" data-entity-inventory data-inventory-denied>
        Inventory access is not granted for this role.
      </p>
    );
  }

  function saveCount(row: InventoryRow) {
    const raw = (drafts[row.id] ?? "").trim();
    if (!raw) return;
    const qty = Number(raw);
    if (!Number.isFinite(qty) || qty < 0) return;
    if (row.kind === "ingredient") {
      useCostStore.getState().runCount(
        "partial",
        [{ skuId: row.id, qty }],
        "Inventory count",
        entityId,
      );
    } else {
      usePosStore.getState().updateMenuItem(row.id, {
        stock: qty,
        trackStock: true,
        lastCountedAt: Date.now(),
      });
      persistLocationCatalog("menu");
    }
    setDrafts((prev) => ({ ...prev, [row.id]: "" }));
  }

  function toggleGrant(role: string, on: boolean) {
    const cur = useCostStore.getState().settings.inventoryAccessRoles ?? [];
    const next = on ? [...cur.filter((r) => r !== role), role] : cur.filter((r) => r !== role);
    useCostStore.getState().updateSettings({ inventoryAccessRoles: next });
    persistLocationCatalog("costs");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4" data-entity-inventory>
      <div>
        <h2 className="text-lg font-semibold">{entityName}</h2>
        <p className="text-sm text-muted-foreground">
          Menu items and ingredients on hand. Enter a count to set the quantity.
        </p>
      </div>

      {!entityId ? (
        <label className="block max-w-sm space-y-1 text-sm" data-inventory-pick>
          <span className="font-medium">Selling entity</span>
          <select
            className="h-10 w-full rounded-lg border border-border bg-surface px-3"
            data-inventory-entity
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
          >
            <option value="">Choose an entity</option>
            {entities.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Input
              className="h-10 min-w-48 flex-1"
              placeholder="Search"
              value={query}
              data-inventory-search
              onChange={(e) => setQuery(e.target.value)}
            />
            <select
              className="h-10 rounded-lg border border-border bg-surface px-3 text-sm"
              data-inventory-filter
              value={filter}
              aria-label="Filter inventory"
              onChange={(e) => setFilter(e.target.value as InventoryFilter)}
            >
              <option value="all">All</option>
              <option value="menu">Menu items</option>
              <option value="ingredient">Ingredients</option>
              <option value="low">Zero or low</option>
            </select>
          </div>

          {visible.length === 0 ? (
            <p className="text-sm text-muted-foreground">No items match.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {visible.map((row) => {
                const draft = drafts[row.id] ?? "";
                const when = inventoryWhenLabel(
                  row.lastKind === "counted" ? row.lastAt ?? undefined : undefined,
                  row.lastKind === "received" ? row.lastAt ?? undefined : undefined,
                );
                return (
                  <li
                    key={`${row.kind}:${row.id}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3"
                    data-inventory-row
                    data-inventory-kind={row.kind}
                    data-inventory-id={row.id}
                  >
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium">{row.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.kind === "menu" ? "Menu item" : "Ingredient"}
                      </p>
                    </div>
                    <p className="text-sm tabular-nums" data-inventory-qty>
                      {formatOnHand(row.onHand)}
                    </p>
                    <p className="w-12 text-xs text-muted-foreground" data-inventory-unit>
                      {row.unit}
                    </p>
                    <p className="w-40 text-xs text-muted-foreground" data-inventory-last>
                      {when}
                    </p>
                    <span
                      className={
                        row.mark === "zero"
                          ? "rounded-md bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger"
                          : row.mark === "low"
                            ? "rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800"
                            : "w-12"
                      }
                      data-inventory-mark={row.mark}
                    >
                      {row.mark === "zero" ? "Zero" : row.mark === "low" ? "Low" : ""}
                    </span>
                    <Input
                      className="h-9 w-20"
                      inputMode="decimal"
                      aria-label={`Count ${row.name}`}
                      placeholder="Count"
                      value={draft}
                      data-inventory-count
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={!draft.trim() || !Number.isFinite(Number(draft)) || Number(draft) < 0}
                      data-inventory-save
                      onClick={() => saveCount(row)}
                    >
                      Save
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}

          {isHostPrivileged(emp) && (
            <fieldset className="rounded-2xl border border-border bg-surface p-4" data-inventory-grants>
              <legend className="px-1 text-sm font-medium">Roles with inventory access</legend>
              <p className="mb-3 text-xs text-muted-foreground">
                The entity manager already has this page. Check a role to grant it.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {INVENTORY_GRANT_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      data-inventory-grant={role}
                      checked={(granted ?? []).includes(role)}
                      onChange={(e) => toggleGrant(role, e.target.checked)}
                    />
                    {GRANT_LABEL[role]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </>
      )}
    </div>
  );
}
