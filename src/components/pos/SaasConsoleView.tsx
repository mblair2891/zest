import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSaasStore } from "@/lib/pos/saas-store";
import {
  ZEST_PACKAGES,
  formatPackagePrice,
  packageMonthlyTotal,
  type PackageCategory,
  type PackageId,
} from "@/lib/pos/packages";
import type { LocationMode, OrgPlan } from "@/lib/pos/saas-types";
import {
  HARDWARE_KITS,
  HARDWARE_POLICY,
  HARDWARE_SKUS,
} from "@/lib/pos/hardware-catalog";
import { formatCurrency, formatTime } from "@/lib/utils";
import { venueById } from "@/lib/pos/entities";
import { HostOnboardingView } from "./HostOnboardingView";

type Tab =
  | "overview"
  | "locations"
  | "host"
  | "team"
  | "devices"
  | "hardware"
  | "billing"
  | "onboarding";

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

const CAT_LABEL: Record<PackageCategory, string> = {
  core: "Core",
  operations: "Operations",
  commerce: "Commerce",
  intelligence: "Intelligence",
  platform: "Platform",
};

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "host", label: "Host setup" },
  { id: "locations", label: "Locations" },
  { id: "team", label: "Team" },
  { id: "devices", label: "Devices" },
  { id: "hardware", label: "Hardware" },
  { id: "billing", label: "Billing" },
  { id: "onboarding", label: "Onboarding" },
];

export function SaasConsoleView() {
  const [tab, setTab] = useState<Tab>("host");
  const org = useSaasStore((s) => s.org);
  const orgs = useSaasStore((s) => s.orgs);
  const setActiveOrg = useSaasStore((s) => s.setActiveOrg);
  const members = useSaasStore((s) => s.members);
  const locations = useSaasStore((s) => s.locations);
  const devices = useSaasStore((s) => s.devices);
  const invoices = useSaasStore((s) => s.invoices);
  const onboarding = useSaasStore((s) => s.onboarding);
  const activeLocationId = useSaasStore((s) => s.activeLocationId);
  const setActiveLocation = useSaasStore((s) => s.setActiveLocation);
  const toggleLocationOpen = useSaasStore((s) => s.toggleLocationOpen);
  const toggleLocationPackage = useSaasStore((s) => s.toggleLocationPackage);
  const updatePlan = useSaasStore((s) => s.updatePlan);
  const completeOnboardingStep = useSaasStore((s) => s.completeOnboardingStep);
  const generateLeaseInvoices = useSaasStore((s) => s.generateLeaseInvoices);
  const markInvoicePaid = useSaasStore((s) => s.markInvoicePaid);
  const platformAdminRole = useSaasStore((s) => s.platformAdminRole);

  const orgLocations = locations.filter((l) => l.orgId === org.id);
  const loc =
    orgLocations.find((l) => l.id === activeLocationId) ?? orgLocations[0];
  const locTotal = loc ? packageMonthlyTotal(loc.enabledPackages as PackageId[]) : 0;
  const orgMembers = members.filter((m) => m.orgId === org.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-border px-3 py-2">
        {TABS.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "host" && <HostOnboardingView />}

        {tab === "overview" && (
          <div className="mx-auto grid max-w-4xl gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Organization
              </p>
              <p className="mt-1 text-lg font-semibold">
                {org.id ? org.name : "No organization yet"}
              </p>
              <p className="text-sm text-muted-foreground">
                {org.id
                  ? org.legalName
                  : "Create one on Host setup — this control plane starts empty."}
              </p>
              <p className="mt-2 text-sm capitalize">
                {org.id
                  ? `${org.plan} · ${org.seats} seats · ${orgLocations.length} locations`
                  : "0 organizations"}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Signed in as platform admin
              </p>
              <Button
                className="mt-3"
                size="sm"
                onClick={() => setTab("host")}
              >
                Onboard host + operators
              </Button>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active location
              </p>
              <p className="mt-1 text-lg font-semibold">
                {loc?.name ?? "No location"}
              </p>
              <p className="text-sm text-muted-foreground">
                {loc ? MODE_LABEL[loc.mode] : "—"} · {loc?.code}
              </p>
              <p className="mt-2 text-sm tabular">
                Packages {formatCurrency(locTotal * 100)} / mo
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 sm:col-span-2">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Locations
              </p>
              {orgs.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {orgs.map((o) => (
                    <Button
                      key={o.id}
                      size="sm"
                      variant={o.id === org.id ? "default" : "outline"}
                      onClick={() => setActiveOrg(o.id)}
                    >
                      {o.name}
                    </Button>
                  ))}
                </div>
              )}
              <ul className="grid gap-2 sm:grid-cols-2">
                {orgLocations.length === 0 && (
                  <li className="text-sm text-muted-foreground sm:col-span-2">
                    No locations. Use Host setup to create one.
                  </li>
                )}
                {orgLocations.map((l) => (
                  <li key={l.id}>
                    <button
                      type="button"
                      onClick={() => setActiveLocation(l.id)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-bg px-3 py-2 text-left text-sm hover:border-primary/50"
                    >
                      <span>
                        <span className="font-medium">{l.name}</span>
                        <span className="mt-0.5 block text-[11px] text-muted-foreground">
                          {MODE_LABEL[l.mode]} · {l.code}
                        </span>
                      </span>
                      <Badge variant={l.open ? "success" : "secondary"}>
                        {l.open ? "Open" : "Closed"}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === "locations" && !loc && (
          <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
            <p className="font-medium">No locations</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an organization and location on Host setup.
            </p>
            <Button className="mt-4" size="sm" onClick={() => setTab("host")}>
              Host setup
            </Button>
          </div>
        )}

        {tab === "locations" && loc && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="flex flex-wrap gap-2">
              {orgLocations.map((l) => (
                <Button
                  key={l.id}
                  size="sm"
                  variant={l.id === loc.id ? "default" : "outline"}
                  onClick={() => setActiveLocation(l.id)}
                >
                  {l.name}
                </Button>
              ))}
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{loc.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {MODE_LABEL[loc.mode]} · {loc.address}
                  </p>
                  {venueById(loc.mode) && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      POS staff logins live under this venue type on the home
                      page.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(loc.operatingModel === "host_multi_operator" ||
                    loc.createdBy === "ui") && (
                    <a href={`/pos/${loc.id}`}>
                      <Button size="sm">Open POS</Button>
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleLocationOpen(loc.id)}
                  >
                    {loc.open ? "Mark closed" : "Mark open"}
                  </Button>
                </div>
              </div>
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Packages
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {ZEST_PACKAGES.filter((p) => p.id !== "saas_console").map(
                  (p) => {
                    const on = loc.enabledPackages.includes(p.id);
                    return (
                      <li
                        key={p.id}
                        className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm"
                      >
                        <span>
                          <span className="font-medium">{p.shortName}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {CAT_LABEL[p.category]} · {formatPackagePrice(p)}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant={on ? "default" : "outline"}
                          onClick={() => toggleLocationPackage(loc.id, p.id)}
                        >
                          {on ? "On" : "Off"}
                        </Button>
                      </li>
                    );
                  },
                )}
              </ul>
            </div>
          </div>
        )}

        {tab === "team" && (
          <div className="mx-auto max-w-2xl space-y-2">
            {orgMembers.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.email}</p>
                </div>
                <Badge variant="secondary" className="capitalize">
                  {m.role}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {tab === "devices" && (
          <div className="mx-auto max-w-3xl space-y-2">
            {devices.map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-surface px-4 py-3"
              >
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.type} · {d.serial} ·{" "}
                    {locations.find((l) => l.id === d.locationId)?.code}
                  </p>
                </div>
                <div className="text-right">
                  <Badge
                    variant={d.status === "online" ? "success" : "secondary"}
                  >
                    {d.status}
                  </Badge>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatTime(d.lastSeenAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "hardware" && (
          <div className="mx-auto max-w-4xl space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="font-semibold">{HARDWARE_POLICY.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {HARDWARE_POLICY.summary}
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {HARDWARE_POLICY.principles.slice(0, 4).map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {HARDWARE_KITS.map((k) => (
                <div
                  key={k.id}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <p className="font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground">{k.bestFor}</p>
                  <p className="mt-2 text-sm tabular">
                    Buy ${k.buyTotalUsd} · Sub ${k.subscribeMonthlyUsd}/mo
                  </p>
                </div>
              ))}
            </div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Certified SKUs
            </p>
            <ul className="space-y-2">
              {HARDWARE_SKUS.slice(0, 8).map((s) => (
                <li
                  key={s.id}
                  className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {s.role} · ${s.listPriceUsd}
                    {s.byodOk ? " · BYOD ok" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "billing" && (
          <div className="mx-auto max-w-3xl space-y-4">
            <div className="rounded-2xl border border-border bg-surface p-4">
              <p className="text-sm font-medium">Plan</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["starter", "growth", "enterprise"] as OrgPlan[]).map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant={org.plan === p ? "default" : "outline"}
                    onClick={() => updatePlan(p)}
                    className="capitalize"
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {org.billingEmail} · {org.status}
              </p>
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={() => generateLeaseInvoices(loc?.id ?? "")}
              >
                Generate lease invoices
              </Button>
            </div>
            <ul className="space-y-2">
              {invoices.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No invoices yet.
                </p>
              )}
              {invoices.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                >
                  <span>
                    {inv.merchantName}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">
                      {formatCurrency(inv.totalCents)} · {inv.status}
                    </span>
                  </span>
                  {inv.status !== "paid" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markInvoicePaid(inv.id)}
                    >
                      Mark paid
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "onboarding" && (
          <div className="mx-auto max-w-xl space-y-2">
            {onboarding.map((step) => (
              <label
                key={step.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={step.done}
                  onChange={() => completeOnboardingStep(step.id)}
                  className="h-4 w-4 rounded border-border"
                />
                <span className={step.done ? "text-muted-foreground" : ""}>
                  {step.title}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
