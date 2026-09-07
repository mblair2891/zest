import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import type { Employee } from "@/lib/pos/types";
import { formatCurrency } from "@/lib/utils";
import {
  cashRoleFromSession,
  parseCashHandling,
} from "@/lib/pos/cash-handling";
import {
  currentCashSink,
  useCashSessionStore,
} from "@/lib/pos/cash-session";
import { useStationSessionStore } from "@/lib/pos/station-session";
import { useNotifyStore } from "@/lib/pos/notify-store";
import {
  TILL_DENOMS,
  countedFromDenoms,
  denomsHaveEntries,
  isManagerTillRole,
  parseDenomCounts,
  type DenomCounts,
} from "@/lib/pos/till-closeout";
import {
  formatDenomMix,
  formatTransferLine,
  listOpenTills,
  type OpenTillRef,
  type TillTransfer,
} from "@/lib/pos/till-transfer";
import { useTillTransferStore } from "@/lib/pos/till-transfer-store";
import { useTillCloseoutStore } from "@/lib/pos/till-closeout-store";
import { printTillTransferSlips } from "@/lib/print/till-transfer";

function currentTill(emp: Employee | undefined): OpenTillRef | null {
  if (!emp) return null;
  const cfg = parseCashHandling(usePosStore.getState().settings.cashHandling);
  const kind = useStationSessionStore.getState().assignment.kind;
  const sink = currentCashSink({
    cfg,
    emp,
    deviceRole: cashRoleFromSession(kind),
    deviceId: usePosStore.getState().activeDeviceId,
  });
  const counting = useTillCloseoutStore.getState().cashBlockedFor(
    sink.type === "drawer" ? sink.drawer.id : sink.type === "bank" ? `bank:${emp.id}` : "",
    sink.type === "bank" ? emp.id : null,
  );
  if (sink.type === "drawer") {
    return {
      drawerId: sink.drawer.id,
      drawerName: sink.drawer.name,
      employeeId: emp.id,
      employeeName: emp.name,
      sinkType: "drawer",
      closed: Boolean(useCashSessionStore.getState().drawers[sink.drawer.id]?.closedAt),
      counting,
    };
  }
  if (sink.type === "bank") {
    return {
      drawerId: `bank:${emp.id}`,
      drawerName: "Server bank",
      employeeId: emp.id,
      employeeName: emp.name,
      sinkType: "bank",
      closed: Boolean(useCashSessionStore.getState().banks[emp.id]?.closedAt),
      counting,
    };
  }
  return null;
}

function notifyPeer(opts: {
  title: string;
  body: string;
  employeeId: string;
  employeeName: string;
}) {
  useNotifyStore.getState().pushNotice({
    kind: "till_transfer",
    title: opts.title,
    body: opts.body,
    serverId: opts.employeeId,
    serverName: opts.employeeName,
  });
}

async function printSlips(transfer: TillTransfer, copy = false) {
  const pos = usePosStore.getState();
  try {
    await printTillTransferSlips({
      transfer,
      locationId: pos.tenantLocationId || "loc",
      locationName: pos.settings.name || "Store",
      devices: pos.locationDevices,
      copy,
    });
  } catch {
    /* print is best-effort; the transfer already moved cash */
  }
}

function DenomMixEditor({
  value,
  onChange,
  targetCents,
}: {
  value: DenomCounts;
  onChange: (next: DenomCounts) => void;
  targetCents: number;
}) {
  const sum = countedFromDenoms(value);
  const bills = TILL_DENOMS.filter((d) => d.kind === "bill" && Number(d.id) <= 20);
  const setQty = (id: string, qty: number) => {
    const next = { ...value };
    const n = Math.max(0, Math.min(999, Math.round(qty)));
    if (n === 0) delete next[id];
    else next[id] = n;
    onChange(next);
  };
  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">Optional mix (must equal the total if entered)</p>
      <ul className="grid grid-cols-2 gap-2">
        {bills.map((d) => {
          const qty = value[d.id] ?? 0;
          return (
            <li key={d.id} className="flex items-center justify-between rounded-xl border border-border bg-bg px-3 py-2">
              <span className="text-sm">{d.label}</span>
              <span className="flex items-center gap-1">
                <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setQty(d.id, qty - 1)}>
                  −
                </Button>
                <span className="w-6 text-center tabular text-sm">{qty || "—"}</span>
                <Button type="button" size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => setQty(d.id, qty + 1)}>
                  +
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className={`mt-2 text-xs tabular ${sum && targetCents && sum !== targetCents ? "text-danger" : "text-muted-foreground"}`}>
        Mix {formatCurrency(sum)}
        {targetCents ? ` of ${formatCurrency(targetCents)}` : ""}
      </p>
    </div>
  );
}

export function TillTransferBanner() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const transfers = useTillTransferStore((s) => s.transfers);
  useCashSessionStore((s) => s.drawers);
  useCashSessionStore((s) => s.banks);
  useTillCloseoutStore((s) => s.records);
  useStationSessionStore((s) => s.assignment.kind);
  const till = currentTill(emp);
  const incoming = till
    ? transfers.filter((t) => t.status === "pending" && t.fromDrawerId === till.drawerId)
    : [];
  const outgoing = till
    ? transfers.filter((t) => t.status === "pending" && t.toDrawerId === till.drawerId)
    : [];
  const [active, setActive] = useState<TillTransfer | null>(null);
  const [snoozedId, setSnoozedId] = useState<string | null>(null);

  useEffect(() => {
    const first = incoming[0];
    if (first && first.id !== snoozedId && !active) setActive(first);
  }, [incoming, snoozedId, active]);

  if (!emp || !till || (incoming.length === 0 && outgoing.length === 0 && !active)) return null;

  return (
    <>
      <div className="border-b border-warn/40 bg-warn/10 px-3 py-2 text-sm" role="status">
        <div className="flex flex-wrap items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 shrink-0" />
          {incoming[0] && (
            <>
              <span>
                {incoming[0].toDrawerName} requests {formatCurrency(incoming[0].amountCents)}. Accept or decline.
              </span>
              <Button size="sm" onClick={() => setActive(incoming[0]!)}>
                Review
              </Button>
            </>
          )}
          {!incoming[0] && outgoing[0] && (
            <span>
              Pending transfer {outgoing[0].id}: waiting on {outgoing[0].fromDrawerName} for{" "}
              {formatCurrency(outgoing[0].amountCents)}.
            </span>
          )}
        </div>
      </div>
      {active && emp && till && (
        <IncomingDialog
          transfer={active}
          emp={emp}
          till={till}
          onClose={() => {
            setSnoozedId(active.id);
            setActive(null);
          }}
        />
      )}
    </>
  );
}

function IncomingDialog({
  transfer,
  emp,
  till,
  onClose,
}: {
  transfer: TillTransfer;
  emp: { id: string; name: string };
  till: OpenTillRef;
  onClose: () => void;
}) {
  const [handing, setHanding] = useState(false);
  const [handed, setHanded] = useState<DenomCounts>({});
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mix = formatDenomMix(transfer.requestedDenoms);

  const act = (action: "accept" | "decline") => {
    setErr(null);
    if (action === "accept" && !handing) {
      setErr("Confirm you are handing this cash now.");
      return;
    }
    setBusy(true);
    const res = useTillTransferStore.getState().respond({
      transferId: transfer.id,
      actor: emp,
      actorTillId: till.drawerId,
      action,
      handedDenoms: action === "accept" && denomsHaveEntries(handed) ? handed : null,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    if (action === "decline") {
      notifyPeer({
        title: "Till transfer declined",
        body: `${till.drawerName} declined ${formatCurrency(transfer.amountCents)}.`,
        employeeId: transfer.toEmployeeId,
        employeeName: transfer.toEmployeeName,
      });
    } else {
      void printSlips(res.transfer);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Till transfer request</DialogTitle>
          <DialogDescription>
            {transfer.toDrawerName} ({transfer.toEmployeeName}) requests{" "}
            {formatCurrency(transfer.amountCents)} from {transfer.fromDrawerName}.
          </DialogDescription>
        </DialogHeader>
        {transfer.note && <p className="text-sm">{transfer.note}</p>}
        {mix && <p className="text-sm text-muted-foreground">Requested mix: {mix}</p>}
        <label className="flex items-start gap-3 rounded-xl border border-border bg-bg p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded border-border"
            checked={handing}
            onChange={(e) => setHanding(e.target.checked)}
          />
          <span>I am handing this cash now.</span>
        </label>
        <DenomMixEditor value={handed} onChange={setHanded} targetCents={transfer.amountCents} />
        {err && (
          <p className="text-sm text-danger" role="alert">
            {err}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => act("decline")}>
            Decline
          </Button>
          <Button disabled={busy} onClick={() => act("accept")}>
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TillTransferSection() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const employees = usePosStore((s) => s.employees);
  const cfg = parseCashHandling(usePosStore((s) => s.settings.cashHandling));
  const drawers = useCashSessionStore((s) => s.drawers);
  const banks = useCashSessionStore((s) => s.banks);
  const transfers = useTillTransferStore((s) => s.transfers);
  const till = currentTill(emp);
  const manager = isManagerTillRole(emp?.role);
  const [open, setOpen] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [reqMix, setReqMix] = useState<DenomCounts>({});
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [reverseId, setReverseId] = useState<string | null>(null);
  const [review, setReview] = useState<TillTransfer | null>(null);

  const countingIds = useTillCloseoutStore((s) =>
    s.records.filter((r) => r.cashBlocked).map((r) => r.drawerId),
  );

  const sources = useMemo(
    () =>
      listOpenTills({
        excludeDrawerId: till?.drawerId,
        employees,
        drawers,
        banks,
        drawerMeta: cfg.drawers.map((d) => ({
          id: d.id,
          name: d.name,
          assignedEmployeeIds: d.assignedEmployeeIds,
        })),
        countingIds,
      }),
    [till?.drawerId, employees, drawers, banks, cfg.drawers, countingIds],
  );

  const pendingHere = till
    ? transfers.filter((t) => t.status === "pending" && (t.fromDrawerId === till.drawerId || t.toDrawerId === till.drawerId))
    : [];
  const acceptedMine = till
    ? useTillTransferStore.getState().acceptedFor(till.drawerId).lines
    : [];
  const reversible = manager
    ? transfers.filter((t) => t.status === "accepted" && !t.reverseOfId)
    : [];

  const request = () => {
    setErr(null);
    if (!emp || !till) {
      setErr("Sign on to a till first.");
      return;
    }
    if (till.closed || till.counting) {
      setErr("Cannot transfer after close started.");
      return;
    }
    const from = sources.find((s) => s.drawerId === sourceId);
    if (!from) {
      setErr("Pick an open till to request cash from.");
      return;
    }
    const amountCents = Math.round(parseFloat(amt || "0") * 100) || 0;
    const mix = parseDenomCounts(reqMix);
    const res = useTillTransferStore.getState().request({
      amountCents,
      from,
      to: till,
      requestedDenoms: denomsHaveEntries(mix) ? mix : null,
      note,
    });
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    notifyPeer({
      title: "Till transfer requested",
      body: `${till.drawerName} requests ${formatCurrency(res.transfer.amountCents)}.`,
      employeeId: from.employeeId,
      employeeName: from.employeeName,
    });
    setFlash(`Requested ${formatCurrency(res.transfer.amountCents)} from ${from.drawerName}.`);
    setOpen(false);
    setAmt("");
    setNote("");
    setReqMix({});
  };

  const cancel = (id: string) => {
    if (!emp) return;
    const res = useTillTransferStore.getState().cancel(id, emp.id);
    if (!res.ok) setErr(res.error);
    else setFlash("Transfer cancelled.");
  };

  const reverse = (id: string) => {
    if (!emp) return;
    const res = useTillTransferStore.getState().reverse({
      transferId: id,
      manager: emp,
    });
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    const orig = transfers.find((t) => t.id === id);
    if (orig) {
      notifyPeer({
        title: "Till transfer reversed",
        body: `Manager reversed ${formatCurrency(orig.amountCents)} (${orig.id}).`,
        employeeId: orig.fromEmployeeId,
        employeeName: orig.fromEmployeeName,
      });
      notifyPeer({
        title: "Till transfer reversed",
        body: `Manager reversed ${formatCurrency(orig.amountCents)} (${orig.id}).`,
        employeeId: orig.toEmployeeId,
        employeeName: orig.toEmployeeName,
      });
      void printSlips(res.reverse);
    }
    setReverseId(null);
    setFlash("Reverse transfer recorded. Cash expected on both tills is updated.");
  };

  const reprint = (t: TillTransfer) => {
    if (!emp) return;
    useTillTransferStore.getState().logReprint(t.id, emp);
    void printSlips(t, true);
    setFlash("Reprint sent.");
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium">Till-to-till transfer</p>
        <Button
          size="sm"
          variant="outline"
          disabled={!till || till.closed || till.counting}
          onClick={() => {
            setErr(null);
            if (till?.sinkType === "drawer") {
              const d = cfg.drawers.find((x) => x.id === till.drawerId);
              useCashSessionStore.getState().ensureDrawer(till.drawerId, d?.startingBankCents ?? 0);
            } else if (till?.sinkType === "bank" && emp) {
              useCashSessionStore.getState().ensureBank(emp.id, cfg.serverBankStartingCents);
            }
            setOpen(true);
          }}
        >
          Transfer cash
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Request small bills from another open till. Cash moves when they accept — not when you
        request. No manager needed. Transfers change expected cash, not sales.
      </p>
      {flash && <p className="mb-2 text-sm text-muted-foreground">{flash}</p>}
      {err && (
        <p className="mb-2 text-sm text-danger" role="alert">
          {err}
        </p>
      )}
      {review && emp && till && (
        <IncomingDialog transfer={review} emp={emp} till={till} onClose={() => setReview(null)} />
      )}
      {pendingHere.length > 0 && (
        <ul className="mb-3 space-y-2 text-sm">
          {pendingHere.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2">
              <span>
                Pending {t.id}: {formatCurrency(t.amountCents)} from {t.fromDrawerName} to {t.toDrawerName}
              </span>
              <span className="flex gap-1">
                {emp && till && t.fromDrawerId === till.drawerId && (
                  <Button size="sm" onClick={() => setReview(t)}>
                    Review
                  </Button>
                )}
                {emp && t.toEmployeeId === emp.id && (
                  <Button size="sm" variant="ghost" onClick={() => cancel(t.id)}>
                    Cancel
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {acceptedMine.length > 0 && (
        <ul className="mb-3 space-y-1 text-sm">
          {acceptedMine.map((line) => (
            <li key={line.id}>{formatTransferLine(line)}</li>
          ))}
        </ul>
      )}
      {manager && reversible.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Manager reverse
          </p>
          <ul className="space-y-2 text-sm">
            {reversible.slice(0, 12).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {t.id} · {formatCurrency(t.amountCents)} · {t.fromDrawerName} → {t.toDrawerName}
                </span>
                <span className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => reprint(t)}>
                    Reprint
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setReverseId(t.id)}>
                    Reverse
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer cash</DialogTitle>
            <DialogDescription>
              Destination is your till{till ? ` (${till.drawerName})` : ""}. Pick who you are
              requesting cash from.
            </DialogDescription>
          </DialogHeader>
          {sources.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other tills are open.</p>
          ) : (
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-muted-foreground">From till</span>
              <select
                className="h-10 w-full rounded-lg border border-border bg-bg px-2 text-sm"
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                <option value="">Select an open till</option>
                {sources.map((s) => (
                  <option key={s.drawerId} value={s.drawerId}>
                    {s.drawerName} · {s.employeeName}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Amount</span>
            <Input
              inputMode="decimal"
              placeholder="20.00"
              value={amt}
              onChange={(e) => setAmt(e.target.value)}
            />
          </label>
          <DenomMixEditor
            value={reqMix}
            onChange={setReqMix}
            targetCents={Math.round(parseFloat(amt || "0") * 100) || 0}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">Note (optional)</span>
            <Input
              placeholder="Need ones and fives"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 120))}
            />
          </label>
          {err && (
            <p className="text-sm text-danger" role="alert">
              {err}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={request} disabled={!sources.length}>
              Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reverseId)} onOpenChange={(o) => !o && setReverseId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse this transfer?</DialogTitle>
            <DialogDescription>
              Creates an opposite accepted transfer and updates both expected cash amounts. Both
              employees are notified.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReverseId(null)}>
              Keep
            </Button>
            <Button onClick={() => reverseId && reverse(reverseId)}>Reverse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


