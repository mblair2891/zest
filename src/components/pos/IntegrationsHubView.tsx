import { useMemo, useState } from "react";
import {
  Plug,
  RefreshCw,
  Search,
  Key,
  Webhook,
  CheckCircle2,
  AlertTriangle,
  Link2Off,
  Landmark,
  CreditCard,
  ShieldCheck,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useIntegrationsStore } from "@/lib/pos/integrations-store";
import {
  CATEGORY_LABELS,
  INTEGRATION_CATALOG,
  SUMMEX_PAYMENTS_ID,
  type IntegrationCategory,
} from "@/lib/pos/integrations-catalog";
import { cn, formatCurrency, formatDateTime, formatTime } from "@/lib/utils";

const CATS: (IntegrationCategory | "all" | "connected")[] = [
  "all",
  "connected",
  "payments",
  "delivery",
  "marketplace",
  "accounting",
  "payroll",
  "hr",
  "reservations",
  "marketing",
  "loyalty",
  "inventory",
  "comms",
  "analytics",
  "hardware",
  "hotel",
  "compliance",
  "devtools",
];

export function IntegrationsHubView() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<(typeof CATS)[number]>("all");
  const [selected, setSelected] = useState<string | null>(SUMMEX_PAYMENTS_ID);
  const [flash, setFlash] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState("Partner app");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const filterCatalog = useIntegrationsStore((s) => s.filterCatalog);
  const connections = useIntegrationsStore((s) => s.connections);
  const logs = useIntegrationsStore((s) => s.logs);
  const connect = useIntegrationsStore((s) => s.connect);
  const disconnect = useIntegrationsStore((s) => s.disconnect);
  const sync = useIntegrationsStore((s) => s.sync);
  const syncAll = useIntegrationsStore((s) => s.syncAll);
  const getConnection = useIntegrationsStore((s) => s.getConnection);
  const webhookUrl = useIntegrationsStore((s) => s.webhookUrl);
  const setWebhookUrl = useIntegrationsStore((s) => s.setWebhookUrl);
  const apiKeys = useIntegrationsStore((s) => s.apiKeys);
  const createApiKey = useIntegrationsStore((s) => s.createApiKey);
  const revokeApiKey = useIntegrationsStore((s) => s.revokeApiKey);

  const list = useMemo(
    () => filterCatalog(q, cat),
    [filterCatalog, q, cat, connections],
  );

  const def =
    INTEGRATION_CATALOG.find((d) => d.id === selected) ?? list[0] ?? null;
  const conn = def ? getConnection(def.id) : undefined;

  const connectedCount = connections.filter(
    (c) => c.status === "connected",
  ).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Plug className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Integrations</h2>
          <Badge variant="info">
            {INTEGRATION_CATALOG.length} partners · {connectedCount} connected
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              const n = syncAll();
              setFlash(`Synced ${n} connected partners`);
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync all
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Card processing is{" "}
          <span className="font-medium text-foreground">Summex Payments</span> —
          not a partner you pick. This list is delivery, accounting, labor,
          hardware, and APIs.
        </p>
        {flash && (
          <p className="mt-2 rounded-lg border border-success/30 bg-success/10 px-2 py-1 text-xs text-success">
            {flash}
          </p>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 w-full flex-col border-b border-border lg:w-[22rem] lg:border-b-0 lg:border-r xl:w-[26rem]">
          <div className="space-y-2 border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search partners, features…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-0.5">
              {CATS.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={cat === c ? "default" : "outline"}
                  className="shrink-0 capitalize"
                  onClick={() => setCat(c)}
                >
                  {c === "all"
                    ? "All"
                    : c === "connected"
                      ? "Connected"
                      : CATEGORY_LABELS[c as IntegrationCategory].split(" ")[0]}
                </Button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="space-y-1.5">
              {list.map((d) => {
                const c = getConnection(d.id);
                const on = c?.status === "connected" || d.platformOwned;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setSelected(d.id)}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2.5 text-left transition",
                      selected === d.id
                        ? "border-primary bg-surface-2"
                        : "border-border bg-surface hover:border-border-strong",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {d.vendor} · {CATEGORY_LABELS[d.category]}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {d.platformOwned && (
                          <Badge variant="secondary" className="text-[10px]">
                            Built-in
                          </Badge>
                        )}
                        {on ? (
                          <Badge variant="success">On</Badge>
                        ) : c?.status === "error" ? (
                          <Badge variant="danger">Error</Badge>
                        ) : (
                          <Badge variant="outline">Off</Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {list.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No partners match
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {def && (
            <div className="mx-auto max-w-3xl space-y-4">
              {def.id === SUMMEX_PAYMENTS_ID && <SummexPaymentsPanel />}

              <div className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
                    {def.id === SUMMEX_PAYMENTS_ID ? (
                      <CreditCard className="h-5 w-5 text-primary" />
                    ) : (
                      <Plug className="h-5 w-5 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-lg font-semibold">{def.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {def.vendor}
                      {def.platformOwned
                        ? " · built into Summex"
                        : ` · Auth: ${def.authType}${def.bidirectional ? " · bi-directional" : " · outbound"}`}
                    </p>
                    <p className="mt-2 text-sm">{def.description}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {def.platformOwned ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          const r = sync(def.id);
                          setFlash(r.message);
                        }}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                      </Button>
                    ) : conn?.status === "connected" ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            const r = sync(def.id);
                            setFlash(r.message);
                          }}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync now
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            disconnect(def.id);
                            setFlash(`Disconnected ${def.name}`);
                          }}
                        >
                          <Link2Off className="h-3.5 w-3.5" />
                          Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          connect(def.id, {
                            location: "This location",
                          });
                          setFlash(`Connected ${def.name}`);
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {def.features.map((f) => (
                    <Badge key={f} variant="secondary">
                      {f}
                    </Badge>
                  ))}
                </div>
                {def.monthlyFeeCents > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Platform fee: {formatCurrency(def.monthlyFeeCents)}/mo
                    (demo)
                  </p>
                )}
                {conn && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat
                      label="Status"
                      value={def.platformOwned ? "live" : conn.status}
                      warn={conn.status === "error"}
                    />
                    <Stat label="Events" value={String(conn.eventsSynced)} />
                    <Stat
                      label="Last sync"
                      value={
                        conn.lastSyncAt ? formatTime(conn.lastSyncAt) : "—"
                      }
                    />
                    <Stat
                      label="Connected"
                      value={
                        conn.connectedAt
                          ? formatDateTime(conn.connectedAt).split(",")[0]
                          : "—"
                      }
                    />
                  </div>
                )}
                {conn?.lastError && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-danger">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {conn.lastError}
                  </p>
                )}
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Webhook className="h-4 w-4" />
                    Outbound webhooks
                  </h4>
                  <label className="block text-xs text-muted-foreground">
                    Endpoint URL
                    <Input
                      className="mt-1 font-mono text-xs"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                    />
                  </label>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Topics: order.created, payment.captured, ticket.bumped,
                    settlement.closed, inventory.low, guest.created
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface p-4">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Key className="h-4 w-4" />
                    API keys
                  </h4>
                  <div className="mb-2 flex gap-2">
                    <Input
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      placeholder="Key name"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const secret = createApiKey(newKeyName || "Key");
                        setRevealedKey(secret);
                        setFlash("API key created — copy now (shown once)");
                      }}
                    >
                      Create
                    </Button>
                  </div>
                  {revealedKey && (
                    <p className="mb-2 break-all rounded-lg bg-surface-2 p-2 font-mono text-[11px]">
                      {revealedKey}
                    </p>
                  )}
                  <ul className="space-y-1 text-xs">
                    {apiKeys.map((k) => (
                      <li
                        key={k.id}
                        className="flex items-center justify-between gap-2 border-b border-border/50 py-1.5"
                      >
                        <span>
                          {k.name}{" "}
                          <span className="text-muted-foreground">
                            {k.prefix}
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeApiKey(k.id)}
                        >
                          Revoke
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-surface p-4">
                <h4 className="mb-2 text-sm font-semibold">Activity log</h4>
                <ul className="max-h-56 space-y-1 overflow-y-auto text-xs">
                  {logs.slice(0, 40).map((l) => (
                    <li
                      key={l.id}
                      className="flex gap-2 border-b border-border/40 py-1.5"
                    >
                      <span className="shrink-0 tabular text-muted-foreground">
                        {formatTime(l.at)}
                      </span>
                      <Badge
                        variant={
                          l.level === "error"
                            ? "danger"
                            : l.level === "success"
                              ? "success"
                              : l.level === "warn"
                                ? "warn"
                                : "secondary"
                        }
                        className="shrink-0"
                      >
                        {l.level}
                      </Badge>
                      <span className="min-w-0 flex-1">{l.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummexPaymentsPanel() {
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">Summex Payments · live</h3>
        <Badge variant="success">This location</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Guests pay Summex. Vendors get period payouts minus card fees and the
        host cut. You do not connect Square, Stripe, or another processor.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="In-person" value="2.49% + 15¢" />
        <Stat label="Keyed / online" value="2.9% + 30¢" />
        <Stat label="Deposits" value="Next business day" />
        <Stat label="Bank" value="•••• 4421" />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Landmark className="h-3 w-3" /> Deposit
          </p>
          <p className="text-sm font-semibold tabular">$4,812.40 queued</p>
          <p className="text-[11px] text-muted-foreground">Hits Friday 8am</p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <CreditCard className="h-3 w-3" /> Terminals
          </p>
          <p className="text-sm font-semibold">2 Summex readers online</p>
          <p className="text-[11px] text-muted-foreground">
            Counter + handheld · Wi‑Fi
          </p>
        </div>
        <div className="rounded-xl border border-border bg-surface px-3 py-2">
          <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            <Banknote className="h-3 w-3" /> Disputes
          </p>
          <p className="text-sm font-semibold">0 open</p>
          <p className="text-[11px] text-muted-foreground">
            Processor handles first-loss risk
          </p>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-sm font-medium capitalize",
          warn && "text-danger",
        )}
      >
        {value}
      </p>
    </div>
  );
}
