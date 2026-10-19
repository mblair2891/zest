import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  qboConnectTestFn,
  qboDisconnectFn,
  qboOverviewFn,
  qboRefreshAccountsFn,
  qboRetryFn,
  qboSaveClassMapFn,
  qboSaveMapFn,
  qboSetAutoSyncFn,
  qboStartOAuthFn,
  qboSyncNowFn,
} from "@/lib/quickbooks/api";
import type { QboConnectionView, QboOverview, QboSyncResult } from "@/lib/quickbooks/types";
import { formatCurrency } from "@/lib/utils";

function todayInput(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function errText(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  return "QuickBooks could not be reached.";
}

function envLabel(environment: QboConnectionView["environment"]): string {
  if (environment === "test") return "Test company";
  if (environment === "production") return "Production";
  return "Sandbox";
}

export function QuickBooksPanel({ locationId }: { locationId: string | null }) {
  const [overview, setOverview] = useState<QboOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState(todayInput);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) {
      setOverview(null);
      setError("Open a location, then connect QuickBooks.");
      return;
    }
    setError(null);
    try {
      const next = await qboOverviewFn({ data: { locationId } });
      setOverview(next);
      setOpenId((current) => current ?? next.connections[0]?.id ?? null);
    } catch (err) {
      setOverview(null);
      setError(errText(err));
    }
  }, [locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type !== "qbo") return;
      void load();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [load]);

  const targets = useMemo(() => {
    if (!overview) return [];
    const rows: Array<{ entityId: string; name: string }> = [];
    if (!overview.scopeEntityId) rows.push({ entityId: "", name: "Whole venue" });
    for (const entity of overview.entities) rows.push({ entityId: entity.id, name: entity.name });
    return rows;
  }, [overview]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(errText(err));
    } finally {
      setBusy(false);
    }
  }

  async function connectLive(entityId: string) {
    if (!locationId) return;
    await run(async () => {
      const { url } = await qboStartOAuthFn({
        data: { locationId, entityId, origin: window.location.origin },
      });
      const popup = window.open(url, "qbo", "width=520,height=720");
      if (!popup) setNotice("Allow the popup, then connect QuickBooks again.");
    });
  }

  async function connectTest(entityId: string) {
    if (!locationId) return;
    await run(async () => {
      const result = await qboConnectTestFn({ data: { locationId, entityId } });
      setNotice(result.message);
      await load();
    });
  }

  if (!overview) {
    return (
      <section className="rounded-2xl border border-border bg-surface p-4">
        <h4 className="text-sm font-semibold">QuickBooks companies</h4>
        <p className="mt-2 text-sm text-muted-foreground">{error ?? "Loading companies…"}</p>
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold">Companies</h4>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              One company for the venue, or one company for each selling entity. A peer venue with no host uses the same choice. Sales, tenders, gift-card liability, and the due-to between entities post as a journal.
            </p>
          </div>
          <label className="text-xs text-muted-foreground">
            Business date
            <input
              type="date"
              className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
        </div>
        {!overview.intuitConfigured && (
          <p className="mt-3 text-xs text-muted-foreground">
            Intuit app keys are not on this server. Connect a test company to review the journal. A live company connects when those keys are set.
          </p>
        )}
        {overview.intuitConfigured && (
          <p className="mt-3 text-xs text-muted-foreground">
            Live connect uses the {overview.intuitEnvironment} QuickBooks environment.
          </p>
        )}
        {(error || notice) && (
          <p className={`mt-3 text-sm ${error ? "text-danger" : "text-foreground"}`}>{error ?? notice}</p>
        )}
        <div className="mt-4 space-y-2">
          {targets.map((target) => {
            const conn = overview.connections.find((row) => row.entityId === target.entityId);
            return (
              <div key={target.entityId || "venue"} className="rounded-xl border border-border px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{target.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {conn ? `${conn.companyName} · ${envLabel(conn.environment)}` : "Not connected"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {conn ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => setOpenId(conn.id)}>
                        Review
                      </Button>
                    ) : (
                      <>
                        {overview.intuitConfigured && (
                          <Button size="sm" disabled={busy} onClick={() => void connectLive(target.entityId)}>
                            Connect QuickBooks
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={busy} onClick={() => void connectTest(target.entityId)}>
                          Connect test company
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {overview.connections.map((conn) =>
        conn.id === openId ? (
          <CompanyCard
            key={conn.id}
            locationId={locationId ?? ""}
            overview={overview}
            conn={conn}
            date={date}
            busy={busy}
            onRun={run}
            onReload={load}
            onNotice={setNotice}
          />
        ) : null,
      )}
    </div>
  );
}

function CompanyCard({
  locationId,
  overview,
  conn,
  date,
  busy,
  onRun,
  onReload,
  onNotice,
}: {
  locationId: string;
  overview: QboOverview;
  conn: QboConnectionView;
  date: string;
  busy: boolean;
  onRun: (work: () => Promise<void>) => Promise<void>;
  onReload: () => Promise<void>;
  onNotice: (message: string) => void;
}) {
  const accounts = overview.accounts.filter((row) => row.connectionId === conn.id);
  const maps = overview.maps.filter((row) => row.connectionId === conn.id);
  const classes = overview.classes.filter((row) => row.connectionId === conn.id);
  const classMaps = overview.classMaps.filter((row) => row.connectionId === conn.id);
  const logs = overview.logs.filter((row) => row.connectionId === conn.id);
  const posted = overview.posted.filter((row) => row.connectionId === conn.id);
  const venue = conn.entityId === "";

  function mapped(code: string): string {
    return maps.find((row) => row.code === code)?.qboAccountId ?? "";
  }

  async function saveAccount(code: string, qboAccountId: string) {
    const account = accounts.find((row) => row.id === qboAccountId);
    await onRun(async () => {
      await qboSaveMapFn({
        data: {
          locationId,
          connectionId: conn.id,
          maps: [{ code, qboAccountId, qboAccountName: account?.name ?? "" }],
        },
      });
      await onReload();
    });
  }

  async function saveClass(entityId: string, classId: string) {
    const klass = classes.find((row) => row.id === classId);
    await onRun(async () => {
      await qboSaveClassMapFn({
        data: {
          locationId,
          connectionId: conn.id,
          maps: [{ entityId, classId, className: klass?.name ?? "" }],
        },
      });
      await onReload();
    });
  }

  function showResult(result: QboSyncResult) {
    onNotice(result.message);
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{conn.companyName}</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            {venue ? "Venue company" : "Entity company"} · {envLabel(conn.environment)}
            {conn.realmId ? ` · ${conn.realmId}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={conn.status === "error" ? "danger" : "secondary"}>{conn.status}</Badge>
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void onRun(async () => {
                const result = await qboSyncNowFn({
                  data: { locationId, connectionId: conn.id, businessDate: date },
                });
                showResult(result);
                await onReload();
              })
            }
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync now
          </Button>
          {conn.environment !== "test" && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void onRun(async () => {
                  await qboRefreshAccountsFn({ data: { locationId, connectionId: conn.id } });
                  onNotice("Accounts refreshed.");
                  await onReload();
                })
              }
            >
              Refresh accounts
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => {
              if (!window.confirm(`Disconnect ${conn.companyName}? Posted logs stay. The account map is removed.`)) return;
              void onRun(async () => {
                await qboDisconnectFn({ data: { locationId, connectionId: conn.id } });
                onNotice("Disconnected.");
                await onReload();
              });
            }}
          >
            Disconnect
          </Button>
        </div>
      </div>
      {conn.lastError && (
        <p className="mt-2 flex items-center gap-1 text-xs text-danger">
          <AlertTriangle className="h-3.5 w-3.5" />
          {conn.lastError}
        </p>
      )}
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={conn.autoSync}
          disabled={busy}
          onChange={(event) =>
            void onRun(async () => {
              await qboSetAutoSyncFn({
                data: { locationId, connectionId: conn.id, autoSync: event.target.checked },
              });
              await onReload();
            })
          }
        />
        Nightly auto-sync with the nightly pack
      </label>

      <h5 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account map</h5>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {overview.requiredAccounts.map((account) => (
          <label key={account.code} className="text-xs text-muted-foreground">
            {account.code} {account.name}
            <select
              className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              value={mapped(account.code)}
              disabled={busy}
              onChange={(event) => void saveAccount(account.code, event.target.value)}
            >
              <option value="">Not mapped</option>
              {accounts.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {venue && (
        <>
          <h5 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class per entity</h5>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {overview.entities.map((entity) => (
              <label key={entity.id} className="text-xs text-muted-foreground">
                {entity.name}
                <select
                  className="mt-1 w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
                  value={classMaps.find((row) => row.entityId === entity.id)?.classId ?? ""}
                  disabled={busy}
                  onChange={(event) => void saveClass(entity.id, event.target.value)}
                >
                  <option value="">No class</option>
                  {classes.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </>
      )}

      <h5 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sync log</h5>
      {logs.length === 0 && <p className="mt-2 text-sm text-muted-foreground">No sync yet for this company.</p>}
      <ul className="mt-2 space-y-2">
        {logs.map((row) => (
          <li key={row.id} className="rounded-xl border border-border px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {row.businessDate} · {row.trigger} · {row.status}
                {row.attempt > 1 ? ` · attempt ${row.attempt}` : ""}
              </span>
              {row.status === "error" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void onRun(async () => {
                      const result = await qboRetryFn({ data: { locationId, logId: row.id } });
                      showResult(result);
                      await onReload();
                    })
                  }
                >
                  Retry
                </Button>
              )}
            </div>
            {(row.error || row.summary) && (
              <p className={`mt-1 text-xs ${row.error ? "text-danger" : "text-muted-foreground"}`}>
                {row.error || row.summary}
              </p>
            )}
          </li>
        ))}
      </ul>

      <h5 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Posted journals</h5>
      {posted.length === 0 && <p className="mt-2 text-sm text-muted-foreground">Nothing posted yet.</p>}
      {posted.map((row) => (
        <div key={row.id} className="mt-2 overflow-x-auto rounded-xl border border-border">
          <p className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            {row.businessDate} · {row.docNumber}
            {row.qboId ? ` · ${row.qboId}` : ""}
          </p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="px-3 py-1 font-medium">Account</th>
                <th className="px-3 py-1 font-medium">Debit</th>
                <th className="px-3 py-1 font-medium">Credit</th>
                <th className="px-3 py-1 font-medium">Line</th>
              </tr>
            </thead>
            <tbody>
              {row.lines.map((line, index) => (
                <tr key={`${row.id}-${index}`} className="border-t border-border">
                  <td className="px-3 py-1">{line.accountCode}</td>
                  <td className="px-3 py-1">{line.debitCents ? formatCurrency(line.debitCents) : ""}</td>
                  <td className="px-3 py-1">{line.creditCents ? formatCurrency(line.creditCents) : ""}</td>
                  <td className="px-3 py-1 text-muted-foreground">{line.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
