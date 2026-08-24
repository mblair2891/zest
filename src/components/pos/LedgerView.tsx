import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { LEDGER_TYPES, ledgerToCsv, type LedgerEntryType } from "@/lib/pos/ledger";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

export function LedgerView() {
  const entries = usePosStore((s) => s.ledgerEntries ?? []);
  const vendors = usePosStore((s) => s.vendors);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const lockedOp = emp?.role === "vendor_operator" ? emp.operatorId ?? null : null;
  const [type, setType] = useState<LedgerEntryType | "all">("all");
  const [operatorId, setOperatorId] = useState<string>(lockedOp || "all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    const fromTs = from ? Date.parse(from) : 0;
    const toTs = to ? Date.parse(to) + 86400000 : Number.MAX_SAFE_INTEGER;
    return entries
      .filter((e) => {
        if (type !== "all" && e.type !== type) return false;
        const opFilter = lockedOp || operatorId;
        if (opFilter !== "all" && e.operatorId !== opFilter) return false;
        if (e.at < fromTs || e.at > toTs) return false;
        return true;
      })
      .slice()
      .sort((a, b) => b.at - a.at);
  }, [entries, type, operatorId, from, to, lockedOp]);

  const exportCsv = () => {
    const blob = new Blob([ledgerToCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "summex-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">System ledger</h2>
          <Badge variant="secondary" className="tabular">
            {filtered.length}
          </Badge>
          <GuideLearnLink topicId="system-ledger" compact>
            Learn
          </GuideLearnLink>
          <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Append-only Quantum Payments book. Positive amounts increase the named
          party’s claim. Sandbox — not live ACH.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <select
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
            value={type}
            onChange={(e) => setType(e.target.value as LedgerEntryType | "all")}
          >
            <option value="all">All types</option>
            {LEDGER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="h-9 rounded-lg border border-border bg-surface px-2 text-xs"
            value={lockedOp || operatorId}
            disabled={Boolean(lockedOp)}
            onChange={(e) => setOperatorId(e.target.value)}
          >
            <option value="all">All operators</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <Input type="date" className="h-9 w-auto text-xs" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" className="h-9 w-auto text-xs" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            No rows yet. Take a Quantum Payments card or cash, then return here.
          </p>
        ) : (
          <table className="w-full min-w-[44rem] text-left text-xs">
            <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Party</th>
                <th className="px-3 py-2 font-medium">Operator</th>
                <th className="px-3 py-2 font-medium text-right">Amount</th>
                <th className="px-3 py-2 font-medium">Check</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {formatDateTime(e.at)}
                  </td>
                  <td className="px-3 py-2 font-medium">{e.type}</td>
                  <td className="px-3 py-2">{e.party}</td>
                  <td className="px-3 py-2">
                    {typeof e.meta.operatorName === "string"
                      ? e.meta.operatorName
                      : e.operatorId ?? "—"}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular ${
                      e.amountCents < 0 ? "text-danger" : "text-foreground"
                    }`}
                  >
                    {formatCurrency(e.amountCents)}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {e.meta.orderNumber != null ? `#${e.meta.orderNumber}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
