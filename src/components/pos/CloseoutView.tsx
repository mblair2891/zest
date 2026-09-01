import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PinKeypad } from "./PinKeypad";
import { ManagerPinDialog } from "./ManagerPinDialog";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency, uid } from "@/lib/utils";
import { pinMatches } from "@/lib/pos/pin";
import { cashRoleFromSession, parseCashHandling } from "@/lib/pos/cash-handling";
import {
  bankExpected,
  currentCashSink,
  drawerExpected,
  useCashSessionStore,
} from "@/lib/pos/cash-session";
import { useStationSessionStore } from "@/lib/pos/station-session";
import {
  ordersForServer,
  recommendTipOuts,
  blindCountEnabled,
  shouldCountCashOnCloseout,
  summarizeServerSales,
  type TipOutLine,
} from "@/lib/pos/closeout";
import { useCloseoutStore } from "@/lib/pos/closeout-store";
import { dispatchPrintJob } from "@/lib/print/dispatch";
import type { PrintJob } from "@/lib/print/types";

const STEPS = [
  "Checks",
  "Sales",
  "Tenders",
  "Cash",
  "Tips",
  "Tip-out",
  "Drops",
  "Confirm",
] as const;

export function CloseoutView({ onDone }: { onDone: () => void }) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const orders = usePosStore((s) => s.orders);
  const settings = usePosStore((s) => s.settings);
  const locId = usePosStore((s) => s.tenantLocationId) || "";
  const devices = usePosStore((s) => s.locationDevices ?? []);
  const kind = useStationSessionStore((s) => s.assignment.kind);
  const cfg = parseCashHandling(settings.cashHandling);
  const sink = currentCashSink({
    cfg,
    emp: emp ?? null,
    deviceRole: cashRoleFromSession(kind),
    deviceId: usePosStore.getState().activeDeviceId,
  });
  const cash = useCashSessionStore();
  const [step, setStep] = useState(0);
  const [mgrOpen, setMgrOpen] = useState(false);
  const [pinErr, setPinErr] = useState<string | null>(null);
  const [countStr, setCountStr] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [overNote, setOverNote] = useState("");
  const [cashTips, setCashTips] = useState("");
  const [cardTipsAdj, setCardTipsAdj] = useState<string | null>(null);
  const [tipLines, setTipLines] = useState<TipOutLine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const sales = useMemo(
    () => (emp ? summarizeServerSales(orders, emp.id) : summarizeServerSales([], "")),
    [emp, orders],
  );
  const openMine = emp
    ? ordersForServer(orders, emp.id).filter((o) => o.status === "open")
    : [];
  const counting = emp ? shouldCountCashOnCloseout({ sink, emp, cfg }) : false;
  const blind = blindCountEnabled(cfg, counting);
  const expected =
    sink.type === "drawer"
      ? drawerExpected(
          cash.drawers[sink.drawer.id] ?? {
            drawerId: sink.drawer.id,
            openedAt: 0,
            startCents: sink.drawer.startingBankCents,
            cashSalesCents: 0,
            cashRefundsCents: 0,
            dropsCents: 0,
            paidInCents: 0,
            paidOutCents: 0,
            salesByEmployee: {},
          },
        )
      : sink.type === "bank" && emp
        ? bankExpected(
            cash.banks[emp.id] ?? {
              employeeId: emp.id,
              issuedAt: 0,
              startCents: cfg.serverBankStartingCents,
              cashSalesCents: 0,
              cashRefundsCents: 0,
              dropsCents: 0,
              paidInCents: 0,
              paidOutCents: 0,
            },
          )
        : null;

  const counted = countStr.trim() === "" ? null : Math.round(parseFloat(countStr) * 100) || 0;
  const variance = counted != null && expected != null ? counted - expected : null;
  const cardTips =
    cardTipsAdj != null && cardTipsAdj !== ""
      ? Math.max(0, Math.round(parseFloat(cardTipsAdj) * 100) || 0)
      : sales.cardTipsCents;
  const declared = Math.max(0, Math.round(parseFloat(cashTips || "0") * 100) || 0);
  const recs = useMemo(
    () =>
      cfg.tipOutEnabled
        ? recommendTipOuts({
            sales: { ...sales, cardTipsCents: cardTips },
            pools: cfg.tipOutPools,
            basis: cfg.tipOutBasis,
            tipPoolCents: cardTips + declared,
          })
        : [],
    [cfg.tipOutEnabled, cfg.tipOutPools, cfg.tipOutBasis, sales, cardTips, declared],
  );
  const lines = tipLines ?? recs;
  const drops = emp
    ? cash.events.filter((e) => e.kind === "drop" && (e.employeeId === emp.id || e.bankEmployeeId === emp.id))
    : [];
  const paid = emp
    ? cash.events.filter(
        (e) =>
          (e.kind === "paid_in" || e.kind === "paid_out") &&
          (e.employeeId === emp.id || e.bankEmployeeId === emp.id),
      )
    : [];

  if (!emp) return null;

  const next = () => {
    setErr(null);
    if (step === 0 && openMine.length && cfg.blockOpenChecks) {
      setErr(
        `${openMine.length} open check(s). Close or transfer them, or a manager can allow pending closeout.`,
      );
      return;
    }
    if (step === 3 && counting) {
      if (counted == null) {
        setErr("Enter cash on hand first.");
        return;
      }
      if (!revealed) {
        setRevealed(true);
        return;
      }
      if (
        variance != null &&
        Math.abs(variance) >= cfg.overShortRequireNoteCents &&
        cfg.overShortRequireNoteCents > 0 &&
        !overNote.trim()
      ) {
        setErr(`Note required for over/short over ${formatCurrency(cfg.overShortRequireNoteCents)}.`);
        return;
      }
    }
    if (step === 5 && !tipLines) setTipLines(recs.map((r) => ({ ...r })));
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = (statusOverride?: "pending") => {
    const over =
      variance != null && cfg.overShortWarnCents > 0 && Math.abs(variance) >= cfg.overShortWarnCents;
    const status = over
      ? "over_short"
      : (statusOverride ?? (openMine.length ? "pending" : "closed"));
    const rec = useCloseoutStore.getState().submit({
      employeeId: emp.id,
      employeeName: emp.name,
      role: emp.role,
      status,
      sales,
      cardTipsCents: cardTips,
      cardTipsAdjusted: cardTipsAdj != null,
      cashTipsDeclaredCents: declared,
      countedCents: counting ? counted : null,
      expectedCents: counting ? expected : null,
      overShortCents: counting ? variance : null,
      overShortNote: overNote || undefined,
      countedBlind: blind,
      skippedDrawerCount: !counting,
      tipOuts: lines,
      tipOutBasis: cfg.tipOutBasis,
      dropsCents: drops.reduce((s, e) => s + e.amountCents, 0),
      paidInCents: paid.filter((e) => e.kind === "paid_in").reduce((s, e) => s + e.amountCents, 0),
      paidOutCents: paid.filter((e) => e.kind === "paid_out").reduce((s, e) => s + e.amountCents, 0),
      openCheckCount: openMine.length,
      pendingReason: status === "pending" ? "Open checks or manager pending" : undefined,
      pinConfirmed: true,
    });
    if (counting && counted != null && sink.type === "bank") {
      useCashSessionStore.getState().countBank({
        employeeId: emp.id,
        countedById: emp.id,
        countedByName: emp.name,
        countedCents: counted,
        note: overNote,
        close: status === "closed" || status === "over_short",
      });
    }
    if (counting && counted != null && sink.type === "drawer") {
      useCashSessionStore.getState().countDrawer({
        drawerId: sink.drawer.id,
        employeeId: emp.id,
        employeeName: emp.name,
        countedCents: counted,
        note: overNote,
        close: false,
      });
    }
    if (cfg.printCheckoutSlip) {
      const job: PrintJob = {
        id: uid("prn"),
        kind: "receipt",
        station: "receipt",
        locationId: locId,
        locationName: settings.name,
        checkId: rec.id,
        checkNumber: "OUT",
        tableLabel: emp.name,
        serverName: emp.name,
        copy: "merchant",
        items: [
          { qty: 1, name: `Guests ${sales.guests} · items ${sales.itemQty}` },
          { qty: 1, name: `Food ${formatCurrency(sales.foodSalesCents)}` },
          { qty: 1, name: `Drink ${formatCurrency(sales.drinkSalesCents)}` },
          { qty: 1, name: `Card tips ${formatCurrency(cardTips)}` },
          { qty: 1, name: `Cash tips declared ${formatCurrency(declared)}` },
          ...lines.map((l) => ({
            qty: 1,
            name: `${l.label} rec ${formatCurrency(l.recommendedCents)} → ${formatCurrency(l.actualCents)}`,
          })),
        ],
        totals:
          expected != null
            ? {
                subtotalCents: expected,
                taxCents: 0,
                totalCents: counted ?? expected,
                tender: variance != null ? `Over/short ${formatCurrency(variance)}` : undefined,
              }
            : undefined,
        at: Date.now(),
      };
      void dispatchPrintJob(job, devices);
    }
    onDone();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="text-sm font-semibold">End of shift</h2>
        <Badge variant="info">
          {STEPS[step]} · {emp.name}
        </Badge>
        <GuideLearnLink topicId="server-closeout" compact>
          Learn
        </GuideLearnLink>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {err && (
          <p className="mb-3 text-sm text-danger" role="alert">
            {err}
          </p>
        )}
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm">
              {openMine.length
                ? `${openMine.length} open check(s) on this PIN.`
                : "No open checks."}
            </p>
            {openMine.length > 0 && (
              <ul className="space-y-1 text-sm">
                {openMine.map((o) => (
                  <li key={o.id}>
                    #{o.number} · {o.guestCount} guests
                  </li>
                ))}
              </ul>
            )}
            {openMine.length > 0 && cfg.pendingCloseoutNeedsManager && (
              <Button size="sm" variant="outline" onClick={() => setMgrOpen(true)}>
                Manager: allow pending
              </Button>
            )}
          </div>
        )}
        {step === 1 && (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[
              ["Guests", String(sales.guests)],
              ["Items", String(sales.itemQty)],
              ["Food", formatCurrency(sales.foodSalesCents)],
              ["Drink", formatCurrency(sales.drinkSalesCents)],
              ["Comps", formatCurrency(sales.compsCents)],
              ["Voids", formatCurrency(sales.voidsCents)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-border bg-surface p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-semibold tabular">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {step === 2 && (
          <dl className="grid grid-cols-3 gap-3 text-sm">
            {[
              ["Card", sales.cardCents],
              ["Cash", sales.cashCents],
              ["Gift", sales.giftCents],
            ].map(([k, v]) => (
              <div key={String(k)} className="rounded-xl border border-border bg-surface p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="mt-1 font-semibold tabular">{formatCurrency(v as number)}</dd>
              </div>
            ))}
          </dl>
        )}
        {step === 3 && (
          <div className="max-w-sm space-y-3">
            {!counting ? (
              <p className="text-sm text-muted-foreground">
                Shared well — you are not the well closer. Skip drawer count. House close is a
                separate manager screen. Declare cash tips and tip-outs next.
              </p>
            ) : (
              <>
                <p className="text-sm">
                  {blind
                    ? "Blind count: enter cash on hand first. Expected shows after."
                    : "Enter cash on hand."}
                </p>
                <Input
                  inputMode="decimal"
                  placeholder="Cash on hand"
                  value={countStr}
                  onChange={(e) => {
                    setCountStr(e.target.value);
                    if (blind) setRevealed(false);
                  }}
                />
                {(!blind || revealed) && expected != null && (
                  <p className="text-sm">
                    Expected {formatCurrency(expected)}
                    {variance != null ? ` · over/short ${formatCurrency(variance)}` : ""}
                  </p>
                )}
                {variance != null && Math.abs(variance) >= cfg.overShortWarnCents && (
                  <Input
                    placeholder="Over/short note"
                    value={overNote}
                    onChange={(e) => setOverNote(e.target.value)}
                  />
                )}
              </>
            )}
          </div>
        )}
        {step === 4 && (
          <div className="max-w-sm space-y-3">
            <p className="text-sm">
              Card tips from payments: {formatCurrency(sales.cardTipsCents)}
            </p>
            {(emp.role === "manager" || emp.role === "owner") && (
              <label className="block text-xs text-muted-foreground">
                Manager adjust card tips
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  value={cardTipsAdj ?? (sales.cardTipsCents / 100).toFixed(2)}
                  onChange={(e) => setCardTipsAdj(e.target.value)}
                />
              </label>
            )}
            <label className="block text-xs text-muted-foreground">
              Cash tips declared
              <Input
                className="mt-1"
                inputMode="decimal"
                value={cashTips}
                onChange={(e) => setCashTips(e.target.value)}
              />
            </label>
          </div>
        )}
        {step === 5 && (
          <div className="space-y-3">
            {!cfg.tipOutEnabled ? (
              <p className="text-sm text-muted-foreground">Tip-out recommendations are off.</p>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Mix: food {formatCurrency(sales.foodSalesCents)} · drink{" "}
                  {formatCurrency(sales.drinkSalesCents)}. Basis:{" "}
                  {cfg.tipOutBasis === "tips_by_mix" ? "% of tips by mix" : "% of category sales"}.
                  Not payroll — accept or override.
                </p>
                <ul className="space-y-2">
                  {lines.map((l, i) => (
                    <li key={l.poolId} className="grid gap-1 rounded-xl border border-border p-3 sm:grid-cols-[1fr_8rem]">
                      <div>
                        <p className="text-sm font-medium">{l.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {l.percent}% of {l.category} · rec {formatCurrency(l.recommendedCents)}
                          {l.role ? ` · ${l.role}` : ""}
                        </p>
                      </div>
                      <Input
                        inputMode="decimal"
                        value={(l.actualCents / 100).toFixed(2)}
                        onChange={(e) => {
                          const cents = Math.max(0, Math.round(parseFloat(e.target.value || "0") * 100) || 0);
                          const nextLines = lines.map((x, j) =>
                            j === i ? { ...x, actualCents: cents } : x,
                          );
                          setTipLines(nextLines);
                        }}
                      />
                      {l.actualCents !== l.recommendedCents && (
                        <Input
                          className="sm:col-span-2"
                          placeholder="Override note (optional)"
                          value={l.note ?? ""}
                          onChange={(e) => {
                            const nextLines = lines.map((x, j) =>
                              j === i ? { ...x, note: e.target.value.slice(0, 120) } : x,
                            );
                            setTipLines(nextLines);
                          }}
                        />
                      )}
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    Total rec {formatCurrency(lines.reduce((s, l) => s + l.recommendedCents, 0))} ·
                    actual {formatCurrency(lines.reduce((s, l) => s + l.actualCents, 0))}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTipLines(recs.map((r) => ({ ...r, actualCents: r.recommendedCents })))}
                  >
                    Accept recommendations
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
        {step === 6 && (
          <div className="space-y-2 text-sm">
            <p>
              Drops {formatCurrency(drops.reduce((s, e) => s + e.amountCents, 0))} · paid-in{" "}
              {formatCurrency(paid.filter((e) => e.kind === "paid_in").reduce((s, e) => s + e.amountCents, 0))}{" "}
              · paid-out{" "}
              {formatCurrency(paid.filter((e) => e.kind === "paid_out").reduce((s, e) => s + e.amountCents, 0))}
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {[...drops, ...paid].slice(0, 30).map((e) => (
                <li key={e.id}>
                  {e.kind.replace("_", " ")} {formatCurrency(e.amountCents)} {e.reason || ""}
                </li>
              ))}
              {drops.length + paid.length === 0 && <li>None this shift.</li>}
            </ul>
          </div>
        )}
        {step === 7 && (
          <div className="mx-auto max-w-xs">
            <p className="mb-3 text-center text-sm">Confirm with your PIN. Not clock-out.</p>
            <PinKeypad
              error={pinErr}
              onClearError={() => setPinErr(null)}
              onComplete={(pin) => {
                const loc = locId || "loc";
                if (!pinMatches(emp, pin, loc)) {
                  setPinErr("PIN does not match this user.");
                  return;
                }
                submit(openMine.length ? "pending" : undefined);
              }}
            />
          </div>
        )}
      </div>
      {step < 7 && (
        <div className="flex gap-2 border-t border-border p-3">
          <Button size="sm" variant="outline" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          <Button size="sm" className="ml-auto" onClick={next}>
            {step === 3 && counting && blind && !revealed && counted != null ? "Show expected" : "Continue"}
          </Button>
        </div>
      )}
      <ManagerPinDialog
        open={mgrOpen}
        onOpenChange={setMgrOpen}
        title="Allow pending closeout"
        onVerified={() => {
          setStep(1);
          setErr(null);
        }}
      />
    </div>
  );
}
