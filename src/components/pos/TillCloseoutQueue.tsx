import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { isManagerCash } from "@/lib/pos/cash-handling";
import { usePosStore } from "@/lib/pos/store";
import { useTillCloseoutStore } from "@/lib/pos/till-closeout-store";
import {
  COUNTERFEIT_REASONS,
  COUNTERFEIT_REASON_LABEL,
  TILL_CLOSE_STATUS_LABEL,
  dollars,
  parseMoneyToCents,
  type TillCloseRecord,
  type TillCloseStatus,
} from "@/lib/pos/till-closeout";
import { useCashSessionStore } from "@/lib/pos/cash-session";
import {
  acceptTillCloseoutFn,
  addTillManagerNoteFn,
  correctTillOpeningBankFn,
  listTillAuditFn,
  pullTillCounterfeitFn,
  requireTillRecountFn,
} from "@/lib/pos/till-closeout-api";
import { readTenantPosContext } from "@/lib/saas/pos-context";
import { isProspectDemo } from "@/lib/demo/session";

type Filter = "all" | "needs_review" | "counting" | "accepted";

export function TillCloseoutQueue() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const records = useTillCloseoutStore((s) => s.records);
  const events = useCashSessionStore((s) => s.events);
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinAction, setPinAction] = useState<null | "recount" | "accept" | "bank" | "pull">(null);
  const [note, setNote] = useState("");
  const [bankStr, setBankStr] = useState("");
  const [pullStr, setPullStr] = useState("");
  const [pullReason, setPullReason] = useState<(typeof COUNTERFEIT_REASONS)[number]>("counterfeit");
  const [flash, setFlash] = useState<string | null>(null);
  const daily = useMemo(() => dailyOverShort(records), [records]);

  if (!isManagerCash(emp?.role)) return null;

  const list = records.filter((r) => {
    if (filter === "all") return r.status !== "voided";
    if (filter === "accepted") return r.status === "accepted" || r.status === "auto_accepted" || r.status === "dropped";
    if (filter === "counting")
      return r.status === "counting" || r.status === "recounting" || r.status === "denom_required";
    return r.status === "needs_review" || r.status === "pending_review" || r.status === "submitted";
  });

  const rec = records.find((r) => r.id === openId) ?? null;
  const tender = rec
    ? events.filter(
        (e) =>
          (e.drawerId && e.drawerId === rec.drawerId) ||
          (rec.sinkType === "bank" && e.bankEmployeeId === rec.employeeId),
      )
    : [];

  const tenant = () => {
    if (isProspectDemo()) return null;
    const ctx = readTenantPosContext();
    const locationId = usePosStore.getState().tenantLocationId || ctx?.locationId || "";
    const orgId = ctx?.orgId || "";
    if (!orgId || !locationId) return null;
    return { orgId, locationId };
  };

  const run = async (kind: NonNullable<typeof pinAction>) => {
    if (!emp || !rec) return;
    const ids = tenant();
    if (kind === "recount") {
      if (ids) {
        try {
          await requireTillRecountFn({
            data: {
              ...ids,
              closeoutId: rec.id,
              actor: { id: emp.id, name: emp.name, role: emp.role },
              note,
            },
          });
        } catch {
          /* local */
        }
      }
      useTillCloseoutStore.getState().recountLocal(rec.id, emp);
      setFlash("Count voided. Cashier recounts blind — do not tell them the expected amount.");
    }
    if (kind === "accept") {
      if (ids) {
        try {
          await acceptTillCloseoutFn({
            data: {
              ...ids,
              closeoutId: rec.id,
              actor: { id: emp.id, name: emp.name, role: emp.role },
              note,
            },
          });
        } catch {
          /* local */
        }
      }
      useTillCloseoutStore.getState().acceptLocal(rec.id, emp, note);
      setFlash("Variance accepted.");
    }
    if (kind === "bank") {
      const cents = parseMoneyToCents(bankStr);
      if (cents == null) {
        setFlash("Enter the corrected opening bank.");
        return;
      }
      if (ids) {
        try {
          await correctTillOpeningBankFn({
            data: {
              ...ids,
              closeoutId: rec.id,
              actor: { id: emp.id, name: emp.name, role: emp.role },
              openingBankCents: cents,
              reason: note || "Opening bank correction",
            },
          });
        } catch {
          /* local */
        }
      }
      useTillCloseoutStore.getState().correctBankLocal(rec.id, cents, emp, note || "Opening bank correction");
      setFlash("Opening bank corrected and audited.");
    }
    if (kind === "pull") {
      const cents = parseMoneyToCents(pullStr);
      if (cents == null || cents <= 0) {
        setFlash("Enter the amount pulled.");
        return;
      }
      if (ids) {
        try {
          await pullTillCounterfeitFn({
            data: {
              ...ids,
              closeoutId: rec.id,
              actor: { id: emp.id, name: emp.name, role: emp.role },
              cents,
              reason: COUNTERFEIT_REASON_LABEL[pullReason],
            },
          });
        } catch {
          /* local */
        }
      }
      useTillCloseoutStore.getState().pullLocal(rec.id, cents, emp, COUNTERFEIT_REASON_LABEL[pullReason]);
      setFlash("Pulled from counted cash.");
    }
    if (note.trim() && (kind === "accept" || kind === "recount")) {
      if (ids) {
        try {
          await addTillManagerNoteFn({
            data: {
              ...ids,
              closeoutId: rec.id,
              actor: { id: emp.id, name: emp.name, role: emp.role },
              note,
            },
          });
        } catch {
          /* */
        }
      }
    }
    setPinAction(null);
  };

  const statusVariant = (s: TillCloseStatus) => {
    if (s === "needs_review" || s === "pending_review") return "danger" as const;
    if (s === "counting" || s === "recounting") return "warn" as const;
    if (s === "accepted" || s === "auto_accepted" || s === "dropped") return "success" as const;
    return "info" as const;
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Till closeouts</p>
        {(["all", "needs_review", "counting", "accepted"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
            {f === "needs_review" ? "over / short" : f.replace("_", " ")}
          </Button>
        ))}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">
        Blind until the cashier submits. Do not tell them expected cash before their first submitted
        count. No force-balance.
      </p>
      {flash && <p className="mb-2 text-sm text-muted-foreground">{flash}</p>}
      {daily.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2 text-xs">
          {daily.map((d) => (
            <li key={d.key} className="rounded-full border border-border px-2 py-0.5 tabular">
              {d.label} {formatCurrency(d.cents)}
            </li>
          ))}
        </ul>
      )}
      <ul className="max-h-56 space-y-1 overflow-y-auto text-sm">
        {list.slice(0, 40).map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-2 border-b border-border/60 py-1.5 last:border-0"
          >
            <span className="min-w-28 truncate">{r.employeeName}</span>
            <span className="text-xs text-muted-foreground">{r.drawerName}</span>
            <Badge variant={statusVariant(r.status)}>{TILL_CLOSE_STATUS_LABEL[r.status]}</Badge>
            <span className="tabular text-xs text-muted-foreground">{formatDateTime(r.startedAt)}</span>
            {r.overShortCents != null && (
              <span className="tabular text-xs">O/S {formatCurrency(r.overShortCents)}</span>
            )}
            {r.bagNumber && <span className="text-xs">bag {r.bagNumber}</span>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpenId(r.id)}>
              Review
            </Button>
          </li>
        ))}
        {list.length === 0 && <li className="text-xs text-muted-foreground">None.</li>}
      </ul>

      {rec && (
        <div className="mt-3 space-y-3 rounded-xl border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">
              {rec.employeeName} · {rec.drawerName}
            </p>
            <Button size="sm" variant="ghost" onClick={() => setOpenId(null)}>
              Hide
            </Button>
          </div>
          {isBlindForCashier(rec) ? (
            <p className="text-sm text-muted-foreground">
              Cashier has not submitted. You can see the expected snapshot; do not tell them the
              amount.
            </p>
          ) : null}
          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <Stat label="Expected" value={rec.expected ? formatCurrency(rec.expected.expectedCents) : "—"} />
            <Stat
              label="Counted"
              value={rec.countedCents != null ? formatCurrency(rec.countedCents) : "not submitted"}
            />
            <Stat
              label="Over/short"
              value={rec.overShortCents != null ? formatCurrency(rec.overShortCents) : "—"}
            />
            <Stat
              label="Turn-in"
              value={rec.turnInCents != null ? formatCurrency(rec.turnInCents) : "—"}
            />
          </dl>
          {rec.expected && (
            <ul className="text-xs text-muted-foreground">
              <li>
                Opening {formatCurrency(rec.expected.openingBankCents)} · sales{" "}
                {formatCurrency(rec.expected.cashSalesCents)} · refunds{" "}
                {formatCurrency(rec.expected.cashRefundsCents)} · paid-out{" "}
                {formatCurrency(rec.expected.paidOutsCents)} · drops{" "}
                {formatCurrency(rec.expected.dropsCents)}
                {rec.expected.paidInsCents
                  ? ` · paid-in ${formatCurrency(rec.expected.paidInsCents)}`
                  : ""}
              </li>
            </ul>
          )}
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Tender audit
            </p>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
              {tender.slice(0, 30).map((e) => (
                <li key={e.id} className="flex gap-2">
                  <span className="w-16 tabular text-muted-foreground">
                    {new Date(e.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </span>
                  <span className="capitalize">{e.kind.replace("_", " ")}</span>
                  <span className="tabular">{e.amountCents ? formatCurrency(e.amountCents) : ""}</span>
                  <span className="truncate text-muted-foreground">{e.reason || e.note || ""}</span>
                </li>
              ))}
              {tender.length === 0 && <li className="text-muted-foreground">No cash events on this till.</li>}
            </ul>
          </div>
          <Input
            placeholder="Manager note"
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 240))}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={rec.countedCents == null}
              onClick={() => setPinAction("accept")}
            >
              Accept
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPinAction("recount")}>
              Require recount
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Correct opening bank</span>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  placeholder={rec.expected ? dollars(rec.expected.openingBankCents) : "0.00"}
                  value={bankStr}
                  onChange={(e) => setBankStr(e.target.value)}
                />
                <Button size="sm" variant="outline" onClick={() => setPinAction("bank")}>
                  Correct
                </Button>
              </div>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">Pull counterfeit / bill</span>
              <div className="flex gap-2">
                <Input
                  inputMode="decimal"
                  placeholder="Amount"
                  value={pullStr}
                  onChange={(e) => setPullStr(e.target.value)}
                />
                <select
                  className="h-11 rounded-lg border border-border bg-bg px-2 text-sm"
                  value={pullReason}
                  onChange={(e) => setPullReason(e.target.value as typeof pullReason)}
                >
                  {COUNTERFEIT_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {COUNTERFEIT_REASON_LABEL[r]}
                    </option>
                  ))}
                </select>
                <Button size="sm" variant="outline" onClick={() => setPinAction("pull")}>
                  Pull
                </Button>
              </div>
            </label>
          </div>
          <AuditPeek closeoutId={rec.id} role={emp?.role ?? ""} />
        </div>
      )}

      <ManagerPinDialog
        open={!!pinAction}
        onOpenChange={(o) => {
          if (!o) setPinAction(null);
        }}
        title={
          pinAction === "recount"
            ? "Void count and recount"
            : pinAction === "accept"
              ? "Accept variance"
              : pinAction === "bank"
                ? "Correct opening bank"
                : "Pull from count"
        }
        description={
          pinAction === "recount"
            ? "Clears the cashier’s submitted amount. The recount screen stays blind."
            : undefined
        }
        onVerified={() => {
          if (pinAction) void run(pinAction);
        }}
      />
    </div>
  );
}

function isBlindForCashier(rec: TillCloseRecord): boolean {
  return rec.status === "counting" || rec.status === "recounting";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border p-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function dailyOverShort(records: TillCloseRecord[]): { key: string; label: string; cents: number }[] {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const from = start.getTime();
  const byEmp = new Map<string, { name: string; cents: number }>();
  const byTill = new Map<string, { name: string; cents: number }>();
  for (const r of records) {
    if (r.startedAt < from || r.overShortCents == null) continue;
    const e = byEmp.get(r.employeeId) ?? { name: r.employeeName, cents: 0 };
    e.cents += r.overShortCents;
    byEmp.set(r.employeeId, e);
    const t = byTill.get(r.drawerId) ?? { name: r.drawerName, cents: 0 };
    t.cents += r.overShortCents;
    byTill.set(r.drawerId, t);
  }
  const out: { key: string; label: string; cents: number }[] = [];
  for (const [k, v] of byEmp) out.push({ key: `e-${k}`, label: v.name, cents: v.cents });
  for (const [k, v] of byTill) out.push({ key: `t-${k}`, label: v.name, cents: v.cents });
  return out.slice(0, 8);
}

function AuditPeek({ closeoutId, role }: { closeoutId: string; role: string }) {
  const local = useTillCloseoutStore((s) => s.audit.filter((a) => a.closeoutId === closeoutId));
  const [rows, setRows] = useState(local);
  useEffect(() => {
    const ctx = readTenantPosContext();
    const locationId = usePosStore.getState().tenantLocationId || ctx?.locationId || "";
    const orgId = ctx?.orgId || "";
    if (!orgId || !locationId || isProspectDemo()) {
      setRows(local);
      return;
    }
    void listTillAuditFn({
      data: { orgId, locationId, closeoutId, employeeRole: role },
    })
      .then((res) => {
        if (res && typeof res === "object" && "ok" in res && res.ok && "rows" in res && Array.isArray(res.rows)) {
          setRows(res.rows);
        }
      })
      .catch(() => setRows(local));
  }, [closeoutId, role]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!rows.length) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Audit</p>
      <ul className="max-h-28 space-y-1 overflow-y-auto text-xs text-muted-foreground">
        {rows.slice(0, 20).map((a) => (
          <li key={a.id}>
            {formatDateTime(a.at)} · {a.actorName} · {a.action}
            {a.detail ? ` — ${a.detail}` : ""}
            {a.ip ? ` · ${a.ip}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
