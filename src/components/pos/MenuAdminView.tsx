import { useEffect, useState } from "react";
import { Ban, Check, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
import { isHappyHour, printedItemPriceCents } from "@/lib/pos/calculations";
import { SetupAssistButton } from "@/components/assist/SetupAssistDialog";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { canEditMenu, canViewMenu, isHostPrivileged } from "@/lib/access/entity-grants";
import { saveMenuItemFn } from "@/lib/access/api";
import { isProspectDemo } from "@/lib/demo/session";
import { useSaasStore } from "@/lib/pos/saas-store";
import { useCostStore } from "@/lib/costs/store";
import { RecipeAssistButton } from "@/components/recipes/RecipeAssistDialog";
import { persistLocationCatalog } from "@/lib/pos/persist-location-setup";

export function MenuAdminView() {
  const categories = usePosStore((s) => s.categories);
  const menuItemsAll = usePosStore((s) => s.menuItems);
  const vendors = usePosStore((s) => s.vendors);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const grants = usePosStore((s) => s.entityPermissions);
  const settings = usePosStore((s) => s.settings);
  const toggleItemAvailable = usePosStore((s) => s.toggleItemAvailable);
  const createMenuItem = usePosStore((s) => s.createMenuItem);
  const updateMenuItem = usePosStore((s) => s.updateMenuItem);
  const deleteMenuItem = usePosStore((s) => s.deleteMenuItem);
  const happy = isHappyHour(settings);
  const orgId = useSaasStore((s) => s.org.id);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const host = isHostPrivileged(emp);

  const menuItems = menuItemsAll.filter((m) => canViewMenu(emp, grants, m.vendorId));
  const ownVendorId = emp?.role === "vendor_operator" ? emp.operatorId : undefined;
  const canCreate = host || Boolean(ownVendorId && canEditMenu(emp, grants, ownVendorId));

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [vendorId, setVendorId] = useState(ownVendorId || vendors[0]?.id || "");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const pendingPrice = useCostStore((s) => s.pendingPriceEdit);
  const clearPendingPrice = useCostStore((s) => s.clearPendingPriceEdit);

  const vendorName = (id?: string) =>
    vendors.find((v) => v.id === id)?.name ?? settings.name ?? "Host";

  useEffect(() => {
    if (!pendingPrice) return;
    const item = menuItemsAll.find((m) => m.id === pendingPrice.menuItemId);
    if (!item) return;
    setEditing(item.id);
    setEditName(item.name);
    setEditPrice((pendingPrice.suggestedPriceCents / 100).toFixed(2));
  }, [pendingPrice, menuItemsAll]);

  const persistWrite = (operatorId: string, action: "create" | "update" | "delete" | "toggle") => {
    if (isProspectDemo() || !orgId || !locId) return;
    void saveMenuItemFn({
      data: { orgId, locationId: locId, action, operatorId },
    }).catch(() => undefined);
    persistLocationCatalog("menu");
  };

  const add = () => {
    if (!name.trim() || !canCreate) return;
    const vid = ownVendorId || vendorId;
    const res = createMenuItem({
      name: name.trim(),
      priceCents: Math.round(Number(price) * 100) || 0,
      categoryId: categoryId || categories[0]?.id || "",
      vendorId: vid,
    });
    if (res.id) persistWrite(vid || "", "create");
    setName("");
    setPrice("");
  };

  return (
    <div className="h-full overflow-y-auto p-3" data-demo="menu-admin">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          {ownVendorId ? "Menu · your items and peer view" : "Menu & 86 board"}
        </h2>
        {happy && <Badge variant="success">Happy hour active</Badge>}
        {canCreate && (
          <SetupAssistButton
            domain="menu_item"
            label="Describe with AI"
            lockedVendorId={ownVendorId}
          />
        )}
        <GuideLearnLink topicId="menu-modifiers" compact>
          Learn
        </GuideLearnLink>
        {host && (
          <>
            <SetupAssistButton domain="category" label="Add category" />
            <SetupAssistButton domain="modifier" label="Add modifiers" />
          </>
        )}
        <p className="w-full text-xs text-muted-foreground">
          Edit only what you own unless the host grants edit. Foreign items show a view-only badge.
        </p>
        {pendingPrice && (
          <p className="w-full text-xs text-primary">
            Cost rec prefilled {editName} at ${editPrice}. Save to confirm — prices never change automatically.
          </p>
        )}
      </div>

      {canCreate && (
        <div className="mb-4 grid gap-2 rounded-2xl border border-border bg-surface p-3 sm:grid-cols-4">
          <Input placeholder="Item name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            placeholder="Price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
          <select
            className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {host ? (
            <select
              className="h-10 rounded-xl border border-border bg-bg px-3 text-sm"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.shortName}
                </option>
              ))}
            </select>
          ) : (
            <Button type="button" onClick={add} disabled={!name.trim()}>
              Add item
            </Button>
          )}
          {host && (
            <Button type="button" className="sm:col-span-4" onClick={add} disabled={!name.trim()}>
              Add item
            </Button>
          )}
        </div>
      )}

      {categories.length === 0 && menuItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
          <p className="text-sm font-semibold">Menu is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Training starts empty. Add a category and item here — or Describe with
            AI. There is no Load demo catalog.
          </p>
        </div>
      )}

      {categories
        .slice()
        .sort((a, b) => a.sort - b.sort)
        .map((cat) => {
          const items = menuItems.filter((m) => m.categoryId === cat.id);
          if (items.length === 0) return null;
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
                {items.map((item) => {
                  const editable = canEditMenu(emp, grants, item.vendorId);
                  const foreign = ownVendorId && item.vendorId && item.vendorId !== ownVendorId;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                    >
                      <div className="min-w-0 flex-1">
                        {editing === item.id ? (
                          <div className="grid gap-1">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                            />
                            <Input
                              value={editPrice}
                              inputMode="decimal"
                              onChange={(e) => setEditPrice(e.target.value)}
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                updateMenuItem(item.id, {
                                  name: editName.trim() || item.name,
                                  priceCents: Math.round(Number(editPrice) * 100) || item.priceCents,
                                });
                                persistWrite(item.vendorId || "", "update");
                                if (pendingPrice?.menuItemId === item.id) clearPendingPrice();
                                setEditing(null);
                              }}
                            >
                              Save
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="truncate text-sm font-medium">{item.name}</p>
                            <p className="text-xs tabular text-muted-foreground">
                              {formatCurrency(item.priceCents)}
                              {printedItemPriceCents(item.priceCents, settings).enabled && (
                                <span className="ml-2">
                                  cash{" "}
                                  {formatCurrency(
                                    printedItemPriceCents(item.priceCents, settings).cash,
                                  )}
                                </span>
                              )}
                              {item.happyHourPriceCents != null && (
                                <span className="ml-2 text-success">
                                  HH {formatCurrency(item.happyHourPriceCents)}
                                </span>
                              )}
                              {item.trackStock && (
                                <span className="ml-2">stock {item.stock ?? 0}</span>
                              )}
                            </p>
                            {foreign && (
                              <Badge variant="secondary" className="mt-1">
                                {vendorName(item.vendorId)} — view only
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                      <Badge variant={item.available ? "success" : "danger"}>
                        {item.available ? "Live" : "86"}
                      </Badge>
                      {editable ? (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              toggleItemAvailable(item.id);
                              persistWrite(item.vendorId || "", "toggle");
                            }}
                            title={item.available ? "86 item" : "Restore"}
                          >
                            {item.available ? (
                              <Ban className="h-4 w-4" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <SetupAssistButton
                            domain="menu_item"
                            label="Assist"
                            itemId={item.id}
                            lockedVendorId={ownVendorId || item.vendorId}
                          />
                          <RecipeAssistButton menuItemId={item.id} label="Recipe" />
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              setEditing(item.id);
                              setEditName(item.name);
                              setEditPrice((item.priceCents / 100).toFixed(2));
                            }}
                            title="Edit"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            onClick={() => {
                              deleteMenuItem(item.id);
                              persistWrite(item.vendorId || "", "delete");
                            }}
                            title="Remove"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
    </div>
  );
}
