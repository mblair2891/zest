import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChefHat,
  Plus,
  Store,
  Trash2,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSaasStore } from "@/lib/pos/saas-store";
import type {
  LocationMode,
  OperatingModel,
  OperatorStationType,
  OrgPlan,
} from "@/lib/pos/saas-types";
import { formatCurrency } from "@/lib/utils";
import { hostLocationStatus } from "@/lib/pos/host-location";

const MODE_LABEL: Record<LocationMode, string> = {
  restaurant: "Restaurant",
  food_hall: "Food hall",
  truck_pod: "Truck pod",
  ghost_kitchen: "Ghost kitchen",
  catering: "Catering",
  bar_lounge: "Bar & lounge",
  cafe: "Café",
  qsr: "Quick service",
};

const STATION_LABEL: Record<OperatorStationType, string> = {
  bar: "Bar",
  kitchen: "Kitchen",
  both: "Bar + kitchen",
};

export function HostOnboardingView() {
  const orgs = useSaasStore((s) => s.orgs);
  const org = useSaasStore((s) => s.org);
  const activeOrgId = useSaasStore((s) => s.activeOrgId);
  const setActiveOrg = useSaasStore((s) => s.setActiveOrg);
  const locations = useSaasStore((s) => s.locations);
  const activeLocationId = useSaasStore((s) => s.activeLocationId);
  const setActiveLocation = useSaasStore((s) => s.setActiveLocation);
  const operators = useSaasStore((s) => s.operators);
  const categories = useSaasStore((s) => s.locationCategories);
  const items = useSaasStore((s) => s.locationItems);
  const createOrganization = useSaasStore((s) => s.createOrganization);
  const createLocation = useSaasStore((s) => s.createLocation);
  const updateLocation = useSaasStore((s) => s.updateLocation);
  const addOperator = useSaasStore((s) => s.addOperator);
  const updateOperator = useSaasStore((s) => s.updateOperator);
  const removeOperator = useSaasStore((s) => s.removeOperator);
  const addLocationCategory = useSaasStore((s) => s.addLocationCategory);
  const addLocationItem = useSaasStore((s) => s.addLocationItem);
  const removeLocationItem = useSaasStore((s) => s.removeLocationItem);
  const setOperatorRouting = useSaasStore((s) => s.setOperatorRouting);
  const generateStarterCatalog = useSaasStore((s) => s.generateStarterCatalog);

  const orgLocations = locations.filter((l) => l.orgId === org.id);
  const loc =
    orgLocations.find((l) => l.id === activeLocationId) ?? orgLocations[0];
  const locOps = operators.filter((o) => o.locationId === loc?.id);
  const locCats = categories.filter((c) => c.locationId === loc?.id);
  const locItems = items.filter((i) => i.locationId === loc?.id);
  const status = loc
    ? hostLocationStatus(loc, locOps, locCats, locItems)
    : null;

  const [flash, setFlash] = useState<string | null>(null);
  const [orgForm, setOrgForm] = useState({
    name: "",
    legalName: "",
    billingEmail: "",
    plan: "growth" as OrgPlan,
  });
  const [locForm, setLocForm] = useState({
    name: "",
    address: "",
    mode: "restaurant" as LocationMode,
    operatingModel: "host_multi_operator" as OperatingModel,
    hostBrandName: "",
  });
  const [opForm, setOpForm] = useState({
    name: "",
    payoutAccountLabel: "",
    payoutLast4: "",
    stationType: "bar" as OperatorStationType,
  });
  const [catForm, setCatForm] = useState({
    name: "",
    station: "kitchen" as "bar" | "kitchen",
  });
  const [itemForm, setItemForm] = useState({
    name: "",
    price: "",
    categoryId: "",
  });

  const uiLocations = orgLocations.filter((l) => l.createdBy === "ui");

  const steps = useMemo(() => {
    const orgDone = Boolean(org.id);
    if (!loc || loc.operatingModel !== "host_multi_operator") {
      return [
        { id: "org", label: "Organization", done: orgDone },
        { id: "loc", label: "Host location", done: false },
        { id: "ops", label: "Operators", done: false },
        { id: "menu", label: "Menu routing", done: false },
        { id: "pos", label: "Open POS", done: false },
      ];
    }
    return [
      { id: "org", label: "Organization", done: orgDone },
      {
        id: "loc",
        label: "Host location",
        done: Boolean(loc.hostBrandName?.trim()),
      },
      { id: "ops", label: "Operators", done: locOps.length >= 2 },
      {
        id: "menu",
        label: "Menu routing",
        done: (status?.routedOperators ?? 0) >= 2 && (status?.items ?? 0) > 0,
      },
      { id: "pos", label: "Open POS", done: Boolean(status?.ready) },
    ];
  }, [loc, locOps.length, status, org.id]);

  const show = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 4000);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 pb-10">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Host + multiple operators
        </p>
        <h2 className="mt-1 text-lg font-semibold">Onboard a host location</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Create any venue from this console. Guests pay once under the host
          brand via Zest Payments. Operators settle by merchandise share — no
          hardcoded demo restaurant required.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-bg px-3 py-2 text-xs"
            >
              <span
                className={
                  s.done
                    ? "flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    : "flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground"
                }
              >
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={s.done ? "text-foreground" : "text-muted-foreground"}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
        {flash && (
          <p className="mt-3 rounded-xl border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
            {flash}
          </p>
        )}
      </div>

      {/* 1. Org */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">1. Organization</h3>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {orgs.map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={o.id === activeOrgId ? "default" : "outline"}
              onClick={() => setActiveOrg(o.id)}
            >
              {o.name}
            </Button>
          ))}
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Active: <span className="font-medium text-foreground">{org.name}</span>{" "}
          · {org.plan} · {orgLocations.length} location(s)
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="New organization name"
            value={orgForm.name}
            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
          />
          <Input
            placeholder="Legal name (optional)"
            value={orgForm.legalName}
            onChange={(e) =>
              setOrgForm({ ...orgForm, legalName: e.target.value })
            }
          />
          <Input
            placeholder="Billing email (optional)"
            value={orgForm.billingEmail}
            onChange={(e) =>
              setOrgForm({ ...orgForm, billingEmail: e.target.value })
            }
          />
          <select
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={orgForm.plan}
            onChange={(e) =>
              setOrgForm({ ...orgForm, plan: e.target.value as OrgPlan })
            }
          >
            <option value="starter">Starter</option>
            <option value="growth">Growth</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
        <Button
          className="mt-3"
          size="sm"
          onClick={() => {
            const res = createOrganization(orgForm);
            if (!res.ok) {
              show(res.error);
              return;
            }
            setOrgForm({
              name: "",
              legalName: "",
              billingEmail: "",
              plan: "growth",
            });
            show("Organization created. Now add a host location.");
          }}
        >
          <Plus className="h-4 w-4" />
          Create organization
        </Button>
      </section>

      {/* 2. Location */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Store className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">2. Location & host brand</h3>
        </div>
        {orgLocations.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {orgLocations.map((l) => (
              <Button
                key={l.id}
                size="sm"
                variant={l.id === loc?.id ? "default" : "outline"}
                onClick={() => setActiveLocation(l.id)}
              >
                {l.name}
                {l.operatingModel === "host_multi_operator" ? " · Host" : ""}
              </Button>
            ))}
          </div>
        )}
        {loc && loc.operatingModel === "host_multi_operator" && (
          <div className="mb-4 rounded-xl border border-border bg-bg p-3">
            <p className="text-sm font-medium">{loc.name}</p>
            <p className="text-xs text-muted-foreground">
              {MODE_LABEL[loc.mode]} · {loc.code}
              {loc.createdBy === "ui" ? " · created in console" : ""}
            </p>
            <label className="mt-3 block text-xs text-muted-foreground">
              Host brand name (guest-facing on checks & Zest Payments)
              <Input
                className="mt-1"
                value={loc.hostBrandName ?? ""}
                onChange={(e) =>
                  updateLocation(loc.id, { hostBrandName: e.target.value })
                }
              />
            </label>
          </div>
        )}
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          New location
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Location name"
            value={locForm.name}
            onChange={(e) => setLocForm({ ...locForm, name: e.target.value })}
          />
          <Input
            placeholder="Host brand (defaults to location name)"
            value={locForm.hostBrandName}
            onChange={(e) =>
              setLocForm({ ...locForm, hostBrandName: e.target.value })
            }
          />
          <Input
            placeholder="Address (optional)"
            value={locForm.address}
            onChange={(e) =>
              setLocForm({ ...locForm, address: e.target.value })
            }
          />
          <select
            className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
            value={locForm.mode}
            onChange={(e) =>
              setLocForm({ ...locForm, mode: e.target.value as LocationMode })
            }
          >
            {Object.entries(MODE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-border bg-bg p-3 text-sm">
            <span className="text-xs text-muted-foreground">Operating model</span>
            <span className="flex flex-wrap gap-2">
              {(
                [
                  ["host_multi_operator", "Host + multiple operators"],
                  ["single_operator", "Single operator"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={locForm.operatingModel === id ? "default" : "outline"}
                  onClick={() =>
                    setLocForm({ ...locForm, operatingModel: id })
                  }
                >
                  {label}
                </Button>
              ))}
            </span>
          </label>
        </div>
        <Button
          className="mt-3"
          size="sm"
          onClick={() => {
            const res = createLocation({
              name: locForm.name,
              address: locForm.address,
              mode: locForm.mode,
              operatingModel: locForm.operatingModel,
              hostBrandName: locForm.hostBrandName || locForm.name,
            });
            if (!res.ok) {
              show(res.error);
              return;
            }
            setLocForm({
              name: "",
              address: "",
              mode: "restaurant",
              operatingModel: "host_multi_operator",
              hostBrandName: "",
            });
            show("Location created. Add two operators next.");
          }}
        >
          <Plus className="h-4 w-4" />
          Create location
        </Button>
      </section>

      {/* 3. Operators */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">3. Operators (merchants)</h3>
        </div>
        {!loc && (
          <p className="text-sm text-muted-foreground">Create a location first.</p>
        )}
        {loc && loc.operatingModel !== "host_multi_operator" && (
          <p className="text-sm text-muted-foreground">
            Switch this location to “Host + multiple operators” to add operators.
            <Button
              className="ml-2"
              size="sm"
              variant="outline"
              onClick={() =>
                updateLocation(loc.id, {
                  operatingModel: "host_multi_operator",
                  hostBrandName: loc.hostBrandName || loc.name,
                })
              }
            >
              Use host model
            </Button>
          </p>
        )}
        {loc && loc.operatingModel === "host_multi_operator" && (
          <>
            <ul className="mb-3 space-y-2">
              {locOps.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  No operators yet. Add at least two (name + payout placeholder).
                </li>
              )}
              {locOps.map((o) => (
                <li
                  key={o.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-border bg-bg px-3 py-2"
                >
                  <div>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: o.color }}
                      />
                      {o.name}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {STATION_LABEL[o.stationType]} · {o.payoutAccountLabel} ·
                      ••{o.payoutLast4}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["bar", "kitchen", "both"] as const).map((st) => (
                      <Button
                        key={st}
                        size="sm"
                        variant={o.stationType === st ? "default" : "outline"}
                        onClick={() =>
                          updateOperator(o.id, { stationType: st })
                        }
                      >
                        {st === "bar" ? (
                          <Wine className="h-3.5 w-3.5" />
                        ) : st === "kitchen" ? (
                          <ChefHat className="h-3.5 w-3.5" />
                        ) : null}
                        {STATION_LABEL[st]}
                      </Button>
                    ))}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${o.name}`}
                      onClick={() => removeOperator(o.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                placeholder="Operator name"
                value={opForm.name}
                onChange={(e) => setOpForm({ ...opForm, name: e.target.value })}
              />
              <Input
                placeholder="Payout account label (placeholder)"
                value={opForm.payoutAccountLabel}
                onChange={(e) =>
                  setOpForm({ ...opForm, payoutAccountLabel: e.target.value })
                }
              />
              <Input
                placeholder="Account last 4"
                maxLength={4}
                value={opForm.payoutLast4}
                onChange={(e) =>
                  setOpForm({
                    ...opForm,
                    payoutLast4: e.target.value.replace(/\D/g, "").slice(0, 4),
                  })
                }
              />
              <select
                className="flex h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm"
                value={opForm.stationType}
                onChange={(e) =>
                  setOpForm({
                    ...opForm,
                    stationType: e.target.value as OperatorStationType,
                  })
                }
              >
                <option value="kitchen">Kitchen station</option>
                <option value="bar">Bar station</option>
                <option value="both">Bar + kitchen</option>
              </select>
            </div>
            <Button
              className="mt-3"
              size="sm"
              onClick={() => {
                const res = addOperator({
                  locationId: loc.id,
                  name: opForm.name,
                  payoutAccountLabel:
                    opForm.payoutAccountLabel || `${opForm.name.trim()} payout`,
                  payoutLast4: opForm.payoutLast4,
                  stationType: opForm.stationType,
                });
                if (!res.ok) {
                  show(res.error);
                  return;
                }
                setOpForm({
                  name: "",
                  payoutAccountLabel: "",
                  payoutLast4: "",
                  stationType:
                    opForm.stationType === "bar" ? "kitchen" : "bar",
                });
                show("Operator added.");
              }}
            >
              <Plus className="h-4 w-4" />
              Add operator
            </Button>
          </>
        )}
      </section>

      {/* 4. Menu + routing */}
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ChefHat className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">4. Menu & routing</h3>
          </div>
          {loc && loc.operatingModel === "host_multi_operator" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const res = generateStarterCatalog(loc.id);
                if (!res.ok) {
                  show(res.error);
                  return;
                }
                show(
                  "Starter catalog created: Drinks → first bar operator, Kitchen → first kitchen operator.",
                );
              }}
            >
              Generate starter catalog
            </Button>
          )}
        </div>
        {loc && loc.operatingModel === "host_multi_operator" && (
          <>
            <p className="mb-3 text-xs text-muted-foreground">
              Each operator owns categories (and optional items). Tickets route
              to bar, kitchen, or both based on the operator’s station type.
            </p>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-border bg-bg p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Categories
                </p>
                <ul className="mb-2 space-y-1">
                  {locCats.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span>
                        {c.name}{" "}
                        <span className="text-[11px] text-muted-foreground">
                          · {c.station}
                        </span>
                      </span>
                    </li>
                  ))}
                  {locCats.length === 0 && (
                    <li className="text-sm text-muted-foreground">None yet</li>
                  )}
                </ul>
                <div className="flex gap-2">
                  <Input
                    placeholder="Category name"
                    value={catForm.name}
                    onChange={(e) =>
                      setCatForm({ ...catForm, name: e.target.value })
                    }
                  />
                  <select
                    className="h-11 rounded-lg border border-border bg-surface px-2 text-sm"
                    value={catForm.station}
                    onChange={(e) =>
                      setCatForm({
                        ...catForm,
                        station: e.target.value as "bar" | "kitchen",
                      })
                    }
                  >
                    <option value="kitchen">Kitchen</option>
                    <option value="bar">Bar</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={() => {
                      const res = addLocationCategory({
                        locationId: loc.id,
                        name: catForm.name,
                        station: catForm.station,
                      });
                      if (!res.ok) show(res.error);
                      else setCatForm({ name: "", station: catForm.station });
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-bg p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Items
                </p>
                <ul className="mb-2 max-h-40 space-y-1 overflow-y-auto">
                  {locItems.map((it) => {
                    const cat = locCats.find((c) => c.id === it.categoryId);
                    return (
                      <li
                        key={it.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <span>
                          {it.name}{" "}
                          <span className="text-[11px] text-muted-foreground">
                            · {cat?.name} · {formatCurrency(it.priceCents)}
                          </span>
                        </span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Remove ${it.name}`}
                          onClick={() => removeLocationItem(it.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    );
                  })}
                  {locItems.length === 0 && (
                    <li className="text-sm text-muted-foreground">None yet</li>
                  )}
                </ul>
                <div className="grid gap-2">
                  <select
                    className="h-11 rounded-lg border border-border bg-surface px-2 text-sm"
                    value={itemForm.categoryId}
                    onChange={(e) =>
                      setItemForm({ ...itemForm, categoryId: e.target.value })
                    }
                  >
                    <option value="">Category…</option>
                    {locCats.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Item name"
                      value={itemForm.name}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, name: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Price"
                      className="w-24"
                      inputMode="decimal"
                      value={itemForm.price}
                      onChange={(e) =>
                        setItemForm({ ...itemForm, price: e.target.value })
                      }
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const catId = itemForm.categoryId || locCats[0]?.id;
                        if (!catId) {
                          show("Add a category first");
                          return;
                        }
                        const cents = Math.round(
                          (parseFloat(itemForm.price) || 0) * 100,
                        );
                        const res = addLocationItem({
                          locationId: loc.id,
                          categoryId: catId,
                          name: itemForm.name,
                          priceCents: cents,
                        });
                        if (!res.ok) show(res.error);
                        else
                          setItemForm({
                            name: "",
                            price: "",
                            categoryId: catId,
                          });
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <p className="mb-2 mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Who owns what
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {locOps.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-border bg-bg p-3"
                >
                  <p className="text-sm font-medium">{o.name}</p>
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    Station: {STATION_LABEL[o.stationType]}
                  </p>
                  <ul className="space-y-1">
                    {locCats.map((c) => {
                      const on = o.ownedCategoryIds.includes(c.id);
                      return (
                        <li key={c.id}>
                          <label className="flex min-h-10 items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={on}
                              onChange={() => {
                                const next = on
                                  ? o.ownedCategoryIds.filter((id) => id !== c.id)
                                  : [...o.ownedCategoryIds, c.id];
                                setOperatorRouting({
                                  operatorId: o.id,
                                  stationType: o.stationType,
                                  ownedCategoryIds: next,
                                });
                              }}
                            />
                            {c.name}{" "}
                            <span className="text-[11px] text-muted-foreground">
                              ({c.station})
                            </span>
                          </label>
                        </li>
                      );
                    })}
                    {locCats.length === 0 && (
                      <li className="text-xs text-muted-foreground">
                        Add categories first
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 5. Open POS */}
      <section className="rounded-2xl border border-primary/40 bg-primary/10 p-4">
        <h3 className="text-sm font-semibold">5. Open POS</h3>
        {status && loc && (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={status.hostBrand ? "success" : "secondary"}>
                Host brand {status.hostBrand ? "set" : "needed"}
              </Badge>
              <Badge variant={status.operatorsOk ? "success" : "secondary"}>
                {status.operatorCount} operators
              </Badge>
              <Badge
                variant={
                  status.routedOperators >= 2 && status.items > 0
                    ? "success"
                    : "secondary"
                }
              >
                {status.items} items · {status.routedOperators} routed
              </Badge>
            </div>
            {status.missing.length > 0 && (
              <ul className="mt-2 list-disc pl-5 text-xs text-muted-foreground">
                {status.missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {loc.createdBy === "ui" ||
              loc.operatingModel === "host_multi_operator" ? (
                <Link to="/pos/$locationId" params={{ locationId: loc.id }}>
                  <Button disabled={!status.ready && locOps.length < 1}>
                    Open POS for {loc.hostBrandName || loc.name}
                  </Button>
                </Link>
              ) : (
                <Link to="/venue/$type" params={{ type: loc.mode }}>
                  <Button variant="outline">Open demo venue POS</Button>
                </Link>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Floor Server PIN 1111 · Kitchen 2222 · Bar 3333 · Manager 0000 ·
              Owner 9999. Ring items from more than one operator on a single
              check, send tickets, pay once with Zest Payments, then open
              Settlement.
            </p>
          </>
        )}
        {uiLocations.length > 0 && loc && loc.id !== uiLocations[0]?.id && (
          <p className="mt-2 text-xs text-muted-foreground">
            Console-created locations:{" "}
            {uiLocations.map((l) => l.name).join(", ")}
          </p>
        )}
      </section>
    </div>
  );
}
