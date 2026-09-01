import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HOST_SCOPE, subjectIdForEmployee } from "@/lib/access/entity-grants";
import { executeOpsJob, reportHtml } from "@/lib/ops-jobs/run";
import { useOpsJobsStore } from "@/lib/ops-jobs/store";
import {
  JOB_CADENCE_LABEL,
  JOB_CADENCES,
  type JobCadence,
  type OpsJobReport,
} from "@/lib/ops-jobs/types";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

function printReport(rep: OpsJobReport) {
  const html = reportHtml(rep);
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=1100");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}

export function OpsJobsInbox({ compact = false }: { compact?: boolean }) {
  const inbox = useOpsJobsStore((s) => s.inbox);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId));
  const [busy, setBusy] = useState<JobCadence | null>(null);
  const [openId, setOpenId] = useState<string | null>(inbox[0]?.id ?? null);
  const scope = subjectIdForEmployee(emp);
  const isHost = scope === HOST_SCOPE;
  const visible = inbox.filter((r) => {
    if (isHost || emp?.role === "owner" || emp?.role === "manager" || emp?.role === "accountant") {
      return true;
    }
    if (emp?.role === "host") return true;
    const rows = r.rows.filter((row) => !row.entityId || row.entityId === scope);
    return rows.length > 0 || !r.rows.some((row) => row.entityId);
  });
  const active = visible.find((r) => r.id === openId) ?? visible[0];

  const run = async (cadence: JobCadence) => {
    setBusy(cadence);
    try {
      const rep = await executeOpsJob(cadence, { force: true });
      setOpenId(rep.id);
    } finally {
      setBusy(null);
    }
  };

  if (compact) {
    const latest = visible[0];
    if (!latest) {
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Scheduled ops jobs</p>
          <p className="mt-1 text-xs text-muted-foreground">
            No packs yet. Hourly runs while open; nightly after close.
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            {JOB_CADENCE_LABEL[latest.cadence]}
            {latest.status === "skipped" ? " · skipped" : ""}
          </p>
          <Badge variant={latest.status === "ok" ? "info" : "secondary"}>{latest.status}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{latest.narrative}</p>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {latest.rows.length} row{latest.rows.length === 1 ? "" : "s"} · {latest.delivered}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">Scheduled ops jobs</h3>
        <GuideLearnLink topicId="ops-jobs" compact>
          Learn
        </GuideLearnLink>
        {JOB_CADENCES.map((c) => (
          <Button key={c} size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(c)}>
            {busy === c ? "Running…" : `Run ${JOB_CADENCE_LABEL[c]}`}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Real xAI when keyed. Missing key queues skipped — no invented insights. Never auto
        clock-out. Never invent Quantum/Finix charges. Exceptions are a review queue.
      </p>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[220px_1fr]">
        <ul className="space-y-1 overflow-y-auto rounded-xl border border-border p-2">
          {visible.length === 0 && (
            <li className="p-2 text-xs text-muted-foreground">Inbox empty. Run a cadence or wait for the schedule.</li>
          )}
          {visible.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                  active?.id === r.id ? "bg-surface-2" : ""
                }`}
                onClick={() => setOpenId(r.id)}
              >
                <span className="font-medium">{JOB_CADENCE_LABEL[r.cadence]}</span>
                <span className="ml-1 text-muted-foreground">{r.status}</span>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(r.at).toLocaleString()}
                </div>
              </button>
            </li>
          ))}
        </ul>
        {active ? (
          <div className="min-h-0 overflow-y-auto rounded-xl border border-border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge variant={active.status === "ok" ? "info" : "secondary"}>{active.status}</Badge>
              <Badge variant="secondary">{active.delivered}</Badge>
              {active.skipReason && (
                <span className="text-xs text-muted-foreground">{active.skipReason}</span>
              )}
              <Button size="sm" variant="outline" onClick={() => printReport(active)}>
                Print / PDF
              </Button>
            </div>
            <p className="text-sm">{active.narrative}</p>
            <table className="mt-3 w-full text-left text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="py-1">Type</th>
                  <th>Sev</th>
                  <th>Subject</th>
                  <th>$ / %</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {active.rows
                  .filter((row) => isHost || !row.entityId || row.entityId === scope)
                  .map((row, i) => (
                    <tr key={`${row.type}-${i}`} className="border-t border-border align-top">
                      <td className="py-1 pr-2">{row.type.replace(/_/g, " ")}</td>
                      <td className="pr-2">{row.severity}</td>
                      <td className="pr-2">{row.subject}</td>
                      <td className="pr-2 tabular">
                        {row.amountCents != null ? formatCurrency(row.amountCents) : "—"}
                        {row.pct != null ? ` · ${row.pct.toFixed(1)}%` : ""}
                      </td>
                      <td>{row.suggestedAction}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {active.dataGaps.length > 0 && (
              <ul className="mt-3 list-disc pl-4 text-xs text-muted-foreground">
                {active.dataGaps.map((g) => (
                  <li key={g}>{g}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
