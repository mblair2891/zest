import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  MapPin,
  Store,
  Wallet,
  Globe,
  Calendar,
  Tag,
  PartyPopper,
  ChefHat,
  Truck,
  Megaphone,
  Plug,
  ClipboardCheck,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, formatDateTime, formatTime } from "@/lib/utils";
import { venueById } from "@/lib/pos/entities";
import type { PosView } from "@/lib/pos/types";
import { RoleHomeDashboard } from "./RoleHomeDashboard";
import { EntityScheduleView } from "./EntityScheduleView";

function Shell({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <div className="ml-auto flex flex-wrap gap-2">{actions}</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}

export function HqView() {
  return <RoleHomeDashboard />;
}

export function OnlineOrdersView() {
  const orders = usePlatformStore((s) => s.onlineOrders);
  const update = usePlatformStore((s) => s.updateOnlineStatus);
  const accept = usePlatformStore((s) => s.acceptOnlineOrder);
  const markArrived = usePlatformStore((s) => s.markGuestArrived);
  const linkTable = usePlatformStore((s) => s.linkOrderToTable);
  const fireKitchen = usePlatformStore((s) => s.fireOnlineOrderToKitchen);
  const processQueue = usePlatformStore((s) => s.processKitchenFireQueue);
  const settings = usePlatformStore((s) => s.fulfillmentSettings);
  const updateFulfillment = usePlatformStore((s) => s.updateFulfillmentSettings);
  const [filter, setFilter] = useState<string>("active");
  const [tableDraft, setTableDraft] = useState<Record<string, string>>({});
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => processQueue(), 4000);
    return () => window.clearInterval(id);
  }, [processQueue]);

  const list = useMemo(() => {
    if (filter === "active")
      return orders.filter(
        (o) => !["completed", "cancelled"].includes(o.status),
      );
    if (filter === "awaiting")
      return orders.filter(
        (o) =>
          o.arrivalStatus === "awaiting" &&
          !["completed", "cancelled"].includes(o.status),
      );
    if (filter === "hold")
      return orders.filter(
        (o) =>
          o.kitchenStatus === "pending_fire" &&
          !["completed", "cancelled"].includes(o.status),
      );
    return orders;
  }, [orders, filter]);

  return (
    <Shell
      title="Online · ahead · QR · curbside"
      actions={
        <>
          {(
            [
              ["active", "Active"],
              ["awaiting", "Awaiting guest"],
              ["hold", "Kitchen hold"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={filter === id ? "default" : "outline"}
              onClick={() => setFilter(id)}
            >
              {label}
            </Button>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettings((v) => !v)}
          >
            Fire rules
          </Button>
          <a
            href="/online"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-2"
          >
            <Globe className="mr-1 h-3.5 w-3.5" />
            Guest site
          </a>
          <a
            href="/table/12"
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-border px-3 text-xs font-medium hover:bg-surface-2"
          >
            Table QR
          </a>
        </>
      }
    >
      {showSettings && (
        <div className="mb-4 rounded-2xl border border-border bg-surface p-4 text-xs">
          <p className="mb-2 text-sm font-semibold">Kitchen fire defaults</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {(
              [
                ["defaultFireModeOrderAhead", "Order ahead"],
                ["defaultFireModeTakeout", "To-go / pickup"],
                ["defaultFireModeCurbside", "Curbside"],
                ["defaultFireModeQrTable", "Table QR"],
                ["defaultFireModeDelivery", "Delivery"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-muted-foreground">{label}</span>
                <select
                  className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-1.5"
                  value={settings[key]}
                  onChange={(e) =>
                    updateFulfillment({
                      [key]: e.target.value,
                    } as Partial<typeof settings>)
                  }
                >
                  <option value="immediate">Immediate on accept</option>
                  <option value="on_arrival">Wait until guest arrives</option>
                  <option value="delay_after_order">Delay after order</option>
                  <option value="delay_after_arrival">
                    Delay after arrival
                  </option>
                </select>
              </label>
            ))}
            <label className="block">
              <span className="text-muted-foreground">Default delay (min)</span>
              <Input
                type="number"
                className="mt-1 h-8"
                value={settings.defaultDelayMinutes}
                onChange={(e) =>
                  updateFulfillment({
                    defaultDelayMinutes: parseInt(e.target.value, 10) || 0,
                  })
                }
              />
            </label>
            <label className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={settings.allowGuestChooseFireMode}
                onChange={(e) =>
                  updateFulfillment({
                    allowGuestChooseFireMode: e.target.checked,
                  })
                }
              />
              Guest can choose fire mode
            </label>
            <label className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={settings.requireTableOnArrival}
                onChange={(e) =>
                  updateFulfillment({
                    requireTableOnArrival: e.target.checked,
                  })
                }
              />
              Require table # on arrival
            </label>
            <label className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={settings.autoAcceptOnline}
                onChange={(e) =>
                  updateFulfillment({ autoAcceptOnline: e.target.checked })
                }
              />
              Auto-accept online orders
            </label>
          </div>
        </div>
      )}

      <div className="grid gap-2 lg:grid-cols-2">
        {list.map((o) => (
          <article
            key={o.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  #{o.number} {o.guestName}
                  {o.claimCode && (
                    <span className="ml-2 font-mono text-xs text-primary">
                      {o.claimCode}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {o.channel}
                  {o.marketplace ? ` · ${o.marketplace}` : ""} ·{" "}
                  {o.type.replaceAll("_", " ")}
                  {o.tableLabel ? ` · T${o.tableLabel}` : ""}
                  {o.vehicleDescription
                    ? ` · ${o.vehicleColor ?? ""} ${o.vehicleDescription}`
                    : ""}
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Fire: {o.kitchenFireMode ?? "—"} · Kitchen:{" "}
                  {o.kitchenStatus ?? "—"} · Guest: {o.arrivalStatus ?? "—"}
                </p>
              </div>
              <Badge
                variant={
                  o.status === "placed"
                    ? "warn"
                    : o.status === "ready"
                      ? "success"
                      : "info"
                }
              >
                {o.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {o.items.map((i, idx) => (
                <li key={idx}>
                  {i.qty}× {i.name}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-semibold tabular">
              {formatCurrency(o.totalCents)}
              {o.discountCents > 0 && (
                <span className="ml-2 text-xs font-normal text-success">
                  −{formatCurrency(o.discountCents)} promo
                </span>
              )}
            </p>
            <div className="mt-2 flex gap-1">
              <Input
                className="h-8 max-w-[6rem] text-xs"
                placeholder="Table #"
                value={tableDraft[o.id] ?? ""}
                onChange={(e) =>
                  setTableDraft((d) => ({ ...d, [o.id]: e.target.value }))
                }
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const lab = (tableDraft[o.id] ?? "").trim();
                  if (!lab) return;
                  linkTable(o.id, lab);
                }}
              >
                Link table
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {o.status === "placed" && (
                <Button size="sm" onClick={() => accept(o.id)}>
                  Accept
                </Button>
              )}
              {o.arrivalStatus === "awaiting" &&
                !["completed", "cancelled"].includes(o.status) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      markArrived(o.id, {
                        tableLabel:
                          (tableDraft[o.id] ?? "").trim() || o.tableLabel,
                      })
                    }
                  >
                    Guest arrived
                  </Button>
                )}
              {o.kitchenStatus !== "fired" &&
                !["completed", "cancelled"].includes(o.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fireKitchen(o.id)}
                  >
                    Fire kitchen now
                  </Button>
                )}
              {["accepted", "preparing"].includes(o.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update(o.id, "ready")}
                >
                  Mark ready
                </Button>
              )}
              {o.status === "ready" && o.type === "delivery" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => update(o.id, "out_for_delivery")}
                >
                  Out for delivery
                </Button>
              )}
              {!["completed", "cancelled"].includes(o.status) && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => update(o.id, "completed")}
                >
                  Complete
                </Button>
              )}
            </div>
          </article>
        ))}
        {list.length === 0 && (
          <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
            No matching orders
          </p>
        )}
      </div>
    </Shell>
  );
}

export function PayoutsView() {
  const payouts = usePlatformStore((s) => s.payouts);
  const tenants = usePlatformStore((s) => s.tenants);
  const mark = usePlatformStore((s) => s.markPayoutPaid);
  const recalc = usePlatformStore((s) => s.recalculatePayouts);

  return (
    <Shell
      title="Tenant payouts (Connect-style)"
      actions={
        <Button size="sm" variant="outline" onClick={() => recalc()}>
          Recalculate
        </Button>
      }
    >
      <p className="mb-3 text-xs text-muted-foreground">
        Food-hall and multi-tenant sales settle to each merchant bank account
        after platform fees and shared commons (rent/CAM).
      </p>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border bg-surface text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tenant</th>
              <th className="px-3 py-2">Gross</th>
              <th className="px-3 py-2">Fees</th>
              <th className="px-3 py-2">Commons</th>
              <th className="px-3 py-2">Net</th>
              <th className="px-3 py-2">Bank</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payouts.map((p) => {
              const t = tenants.find((x) => x.id === p.tenantId);
              return (
                <tr key={p.id}>
                  <td className="px-3 py-3 font-medium">{t?.name}</td>
                  <td className="px-3 py-3 tabular">
                    {formatCurrency(p.grossSalesCents)}
                  </td>
                  <td className="px-3 py-3 tabular">
                    {formatCurrency(p.feesCents)}
                  </td>
                  <td className="px-3 py-3 tabular">
                    {formatCurrency(p.commonsCents)}
                  </td>
                  <td className="px-3 py-3 tabular font-semibold">
                    {formatCurrency(p.netPayoutCents)}
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground">
                    ••{t?.bankAccount.last4}
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      variant={
                        p.status === "paid"
                          ? "success"
                          : p.status === "processing"
                            ? "info"
                            : "warn"
                      }
                    >
                      {p.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    {p.status !== "paid" && (
                      <Button size="sm" onClick={() => mark(p.id)}>
                        Mark paid
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

export function ScheduleView() {
  return <EntityScheduleView />;
}

export function PromosView() {
  const promotions = usePlatformStore((s) => s.promotions);
  const toggle = usePlatformStore((s) => s.togglePromo);

  return (
    <Shell title="Promotions engine">
      <div className="grid gap-2 sm:grid-cols-2">
        {promotions.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.type}
                  {p.code ? ` · code ${p.code}` : ""} ·{" "}
                  {p.channels.join(", ")}
                </p>
              </div>
              <Badge variant={p.active ? "success" : "secondary"}>
                {p.active ? "On" : "Off"}
              </Badge>
            </div>
            <Button
              className="mt-3"
              size="sm"
              variant="outline"
              onClick={() => toggle(p.id)}
            >
              Toggle
            </Button>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function CateringView() {
  const catering = usePlatformStore((s) => s.catering);
  const update = usePlatformStore((s) => s.updateCateringStatus);

  return (
    <Shell title="Catering & private dining">
      <div className="space-y-2">
        {catering.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">
                  {c.clientName} · {c.guestCount} guests ·{" "}
                  {formatDateTime(c.startsAt)}
                </p>
                <p className="mt-1 text-sm tabular">
                  {formatCurrency(c.quoteCents)}
                  {c.depositPaid && (
                    <span className="ml-2 text-xs text-success">
                      deposit {formatCurrency(c.depositCents)}
                    </span>
                  )}
                </p>
              </div>
              <Badge variant="info">{c.status.replaceAll("_", " ")}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(
                [
                  "quoted",
                  "contracted",
                  "deposit_paid",
                  "completed",
                ] as const
              ).map((st) => (
                <Button
                  key={st}
                  size="sm"
                  variant="outline"
                  onClick={() => update(c.id, st)}
                >
                  {st.replaceAll("_", " ")}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function RecipesView() {
  const recipes = usePlatformStore((s) => s.recipes);
  const inventory = usePosStore((s) => s.inventory);
  const menuItems = usePosStore((s) => s.menuItems);

  return (
    <Shell title="Recipes & plate cost">
      <div className="grid gap-3 sm:grid-cols-2">
        {recipes.map((r) => {
          const item = menuItems.find((m) => m.id === r.menuItemId);
          const margin =
            item != null
              ? item.priceCents - r.plateCostCents
              : 0;
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                Plate cost {formatCurrency(r.plateCostCents)}
                {item && (
                  <>
                    {" "}
                    · sell {formatCurrency(item.priceCents)} · margin{" "}
                    {formatCurrency(margin)} (
                    {item.priceCents
                      ? Math.round((margin / item.priceCents) * 100)
                      : 0}
                    %)
                  </>
                )}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {r.lines.map((l, i) => {
                  const inv = inventory.find((x) => x.id === l.inventoryId);
                  return (
                    <li key={i}>
                      {l.qty} {l.unit} {inv?.name ?? l.inventoryId}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function PurchasingView() {
  const pos = usePlatformStore((s) => s.purchaseOrders);
  const send = usePlatformStore((s) => s.sendPO);
  const receive = usePlatformStore((s) => s.receivePO);
  const receiveInv = usePosStore((s) => s.receiveInventory);

  return (
    <Shell title="Purchase orders">
      <div className="space-y-3">
        {pos.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-surface p-4"
          >
            <div className="flex justify-between">
              <div>
                <p className="font-medium">{p.vendor}</p>
                <p className="text-xs text-muted-foreground">
                  {p.lines.length} lines · {formatDateTime(p.createdAt)}
                </p>
              </div>
              <Badge
                variant={
                  p.status === "received"
                    ? "success"
                    : p.status === "sent"
                      ? "info"
                      : "secondary"
                }
              >
                {p.status}
              </Badge>
            </div>
            <ul className="mt-2 text-sm text-muted-foreground">
              {p.lines.map((l, i) => (
                <li key={i}>
                  {l.qty}× {l.name} @ {formatCurrency(l.unitCostCents)}
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              {p.status === "draft" && (
                <Button size="sm" onClick={() => send(p.id)}>
                  Send PO
                </Button>
              )}
              {p.status === "sent" && (
                <Button
                  size="sm"
                  onClick={() => {
                    for (const l of p.lines) receiveInv(l.inventoryId, l.qty);
                    receive(p.id);
                  }}
                >
                  Receive into inventory
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function DeliveryView() {
  const drivers = usePlatformStore((s) => s.drivers);
  const orders = usePlatformStore((s) => s.onlineOrders);
  const assign = usePlatformStore((s) => s.assignDriver);
  const deliveryOrders = orders.filter(
    (o) =>
      o.type === "delivery" &&
      !["completed", "cancelled"].includes(o.status),
  );

  return (
    <Shell title="Delivery dispatch">
      <div className="grid gap-3 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Drivers
          </p>
          {drivers.map((d) => (
            <div
              key={d.id}
              className="mb-2 rounded-xl border border-border bg-surface p-3 text-sm"
            >
              <p className="font-medium">{d.name}</p>
              <Badge
                variant={d.status === "available" ? "success" : "warn"}
                className="mt-1"
              >
                {d.status.replaceAll("_", " ")}
              </Badge>
            </div>
          ))}
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
            Delivery orders
          </p>
          {deliveryOrders.map((o) => (
            <div
              key={o.id}
              className="mb-2 rounded-xl border border-border bg-surface p-3 text-sm"
            >
              <p className="font-medium">
                #{o.number} {o.guestName}
              </p>
              <p className="text-xs text-muted-foreground">{o.address}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {drivers
                  .filter((d) => d.status === "available")
                  .map((d) => (
                    <Button
                      key={d.id}
                      size="sm"
                      variant="outline"
                      onClick={() => assign(o.id, d.id)}
                    >
                      <Truck className="h-3.5 w-3.5" />
                      {d.name.split(" ")[0]}
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Shell>
  );
}

export function CampaignsView() {
  const campaigns = usePlatformStore((s) => s.campaigns);
  const send = usePlatformStore((s) => s.sendCampaign);

  return (
    <Shell title="CRM campaigns">
      <div className="space-y-2">
        {campaigns.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-3"
          >
            <Megaphone className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.channel} · {c.segment} · {c.audienceSize} guests
              </p>
            </div>
            <Badge variant={c.status === "sent" ? "success" : "info"}>
              {c.status}
            </Badge>
            {c.status !== "sent" && (
              <Button size="sm" onClick={() => send(c.id)}>
                Send now
              </Button>
            )}
          </div>
        ))}
      </div>
    </Shell>
  );
}

export function IntegrationsView() {
  // Full marketplace lives in IntegrationsHubView — keep export for HQ links
  const setView = usePosStore((s) => s.setView);
  return (
    <Shell
      title="Integrations"
      actions={
        <Button size="sm" onClick={() => setView("integrations")}>
          Open marketplace
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        80+ third-party partners: payments, delivery, accounting, payroll, hardware,
        PMS, loyalty, webhooks, and more.
      </p>
      <Button onClick={() => setView("integrations")}>Open integrations</Button>
    </Shell>
  );
}

export function ChecklistsView() {
  const lists = usePlatformStore((s) => s.checklists);
  const toggle = usePlatformStore((s) => s.toggleChecklistItem);

  return (
    <Shell title="Open / close checklists">
      <div className="grid gap-4 lg:grid-cols-2">
        {lists.map((list) => {
          const done = list.items.filter((i) => i.done).length;
          return (
            <div
              key={list.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <p className="mb-1 text-sm font-medium capitalize">
                {list.type} checklist
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                {done}/{list.items.length} complete
              </p>
              <ul className="space-y-2">
                {list.items.map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() => toggle(list.id, it.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border px-2 py-2 text-left text-sm hover:bg-surface-2"
                    >
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          it.done
                            ? "border-success bg-success/20 text-success"
                            : "border-border"
                        }`}
                      >
                        {it.done && <Check className="h-3 w-3" />}
                      </span>
                      <span className={it.done ? "line-through opacity-60" : ""}>
                        {it.text}
                      </span>
                      {it.required && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          required
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

export function HallView() {
  const tenants = usePlatformStore((s) => s.tenants);
  const cart = usePlatformStore((s) => s.hallCart);
  const add = usePlatformStore((s) => s.addHallCartItem);
  const checkout = usePlatformStore((s) => s.checkoutHallCart);
  const [name, setName] = useState("Hall guest");
  const [result, setResult] = useState<string | null>(null);

  // demo stall menus
  const stallMenus: Record<
    string,
    { id: string; name: string; price: number }[]
  > = {
    ten_hh: [
      { id: "mi_burger", name: "Forge Burger", price: 1900 },
      { id: "mi_ipa", name: "Local IPA", price: 800 },
    ],
    ten_noodle: [
      { id: "n1", name: "Shoyu Ramen", price: 1600 },
      { id: "n2", name: "Gyoza (6)", price: 900 },
    ],
    ten_taco: [
      { id: "t1", name: "Fish Tacos (3)", price: 1400 },
      { id: "t2", name: "Horchata", price: 450 },
    ],
    ten_gelato: [
      { id: "g1", name: "Gelato scoop", price: 500 },
      { id: "g2", name: "Affogato", price: 700 },
    ],
  };

  const total = cart.reduce((s, c) => s + c.unitPriceCents * c.qty, 0);

  return (
    <Shell title="Food hall — multi-tenant cart">
      <p className="mb-3 text-xs text-muted-foreground">
        Guest pays once; order splits by stall for kitchen tickets and separate
        merchant payouts.
      </p>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {tenants
            .filter((t) => stallMenus[t.id])
            .map((t) => (
              <div
                key={t.id}
                className="rounded-2xl border border-border bg-surface p-3"
              >
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Store className="h-4 w-4" style={{ color: t.color }} />
                  {t.name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {t.cuisine}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {stallMenus[t.id]!.map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        add({
                          tenantId: t.id,
                          menuItemId: item.id,
                          name: item.name,
                          unitPriceCents: item.price,
                        })
                      }
                    >
                      {item.name} · {formatCurrency(item.price)}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
        </div>
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="mb-2 text-sm font-medium">Shared cart</p>
          <Input
            className="mb-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Guest name"
          />
          <ul className="mb-3 max-h-48 space-y-1 overflow-y-auto text-sm">
            {cart.map((c, i) => {
              const t = tenants.find((x) => x.id === c.tenantId);
              return (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {c.qty}× {c.name}
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      {t?.name}
                    </span>
                  </span>
                  <span className="tabular">
                    {formatCurrency(c.unitPriceCents * c.qty)}
                  </span>
                </li>
              );
            })}
            {cart.length === 0 && (
              <li className="text-muted-foreground">Empty</li>
            )}
          </ul>
          <p className="mb-3 text-lg font-semibold tabular">
            {formatCurrency(total)}
          </p>
          <Button
            className="w-full"
            disabled={!cart.length}
            onClick={() => {
              const res = checkout(name);
              if (res.ok) {
                setResult(
                  res.splits
                    .map((s) => {
                      const t = tenants.find((x) => x.id === s.tenantId);
                      return `${t?.name}: ${formatCurrency(s.totalCents)}`;
                    })
                    .join(" · "),
                );
              }
            }}
          >
            <Wallet className="h-4 w-4" />
            Pay & split to tenants
          </Button>
          {result && (
            <p className="mt-3 text-xs text-success">Settled → {result}</p>
          )}
        </div>
      </div>
    </Shell>
  );
}

// re-export icons unused silence
void [Calendar, ChefHat, ClipboardCheck, PartyPopper, Tag];
