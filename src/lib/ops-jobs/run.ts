import { deliverAiReportFn } from "@/lib/reports/api";
import { isProspectDemo } from "@/lib/demo/session";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { usePosStore } from "@/lib/pos/store";
import { uid } from "@/lib/utils";
import { runOpsJobFn } from "./api";
import { collectOpsJobFacts, resolvedOpsJobsConfig } from "./collect";
import { fireKeyFor } from "./config";
import { useOpsJobsStore } from "./store";
import type { JobCadence, OpsJobReport } from "./types";
import { JOB_CADENCE_LABEL } from "./types";

function reportText(rep: OpsJobReport): string {
  const lines = [
    `${JOB_CADENCE_LABEL[rep.cadence]} · ${rep.locationName}`,
    rep.narrative,
    "",
    ...rep.rows.map((r) => {
      const money =
        r.amountCents != null ? ` $${(r.amountCents / 100).toFixed(2)}` : "";
      const pct = r.pct != null ? ` ${r.pct.toFixed(1)}%` : "";
      return `• [${r.severity}] ${r.subject}${money}${pct} — ${r.suggestedAction}`;
    }),
    "",
    ...rep.dataGaps.map((g) => `Gap: ${g}`),
  ];
  return lines.join("\n");
}

function reportHtml(rep: OpsJobReport): string {
  const rows = rep.rows
    .map((r) => {
      const money =
        r.amountCents != null ? `$${(r.amountCents / 100).toFixed(2)}` : "—";
      const pct = r.pct != null ? `${r.pct.toFixed(1)}%` : "—";
      return `<tr><td>${r.type}</td><td>${r.severity}</td><td>${escapeHtml(r.subject)}</td><td>${money}</td><td>${pct}</td><td>${escapeHtml(r.suggestedAction)}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html><body style="font-family:sans-serif;padding:24px">
<h1>Summex ${JOB_CADENCE_LABEL[rep.cadence]} pack</h1>
<p>${escapeHtml(rep.locationName)} · ${new Date(rep.at).toLocaleString()}</p>
<p><strong>${rep.status === "skipped" ? "Skipped" : "Report"}</strong> — ${escapeHtml(rep.narrative)}</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px">
<thead><tr><th>Type</th><th>Sev</th><th>Subject</th><th>$</th><th>%</th><th>Suggested action</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p style="font-size:12px;color:#555">Print this page for a PDF. Guest cards are Quantum Payments. Gift is the Summex ledger. Exceptions are a review queue — never a theft verdict. Staffing recs never auto clock-out.</p>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function executeOpsJob(
  cadence: JobCadence,
  opts?: { force?: boolean; fireKey?: string },
): Promise<OpsJobReport> {
  const pos = usePosStore.getState();
  const cfg = resolvedOpsJobsConfig();
  const key = opts?.fireKey || fireKeyFor(cadence);
  if (!opts?.force && useOpsJobsStore.getState().lastFired[cadence] === key) {
    const existing = useOpsJobsStore.getState().inbox.find((r) => r.fireKey === key);
    if (existing) return existing;
  }
  const facts = collectOpsJobFacts(cadence);
  const locId = pos.tenantLocationId || facts.location.id;
  let result: Awaited<ReturnType<typeof runOpsJobFn>>;
  try {
    result = await runOpsJobFn({
      data: {
        facts,
        locationId: locId,
        isDemo: isProspectDemo(),
      },
    });
  } catch {
    result = {
      status: "error",
      skipReason: "Job runner unavailable",
      narrative: "Could not reach the job runner. House fact rows only.",
      rows: facts.seedRows,
      dataGaps: facts.dataGaps,
    };
  }

  const email = (cfg.notifyEmail || pos.settings.aiReportEmail || "").trim();
  let delivered: OpsJobReport["delivered"] = "inbox";
  const report: OpsJobReport = {
    id: uid("ojb"),
    cadence,
    at: Date.now(),
    locationId: locId,
    locationName: facts.location.name,
    fireKey: key,
    status: result.status,
    skipReason: result.skipReason,
    narrative: result.narrative,
    rows: result.rows,
    dataGaps: result.dataGaps,
    delivered: "inbox",
    entityId: null,
  };

  if (email && !isProspectDemo() && locId) {
    try {
      const mail = await deliverAiReportFn({
        data: {
          to: email,
          subject: `Summex ${JOB_CADENCE_LABEL[cadence]} · ${facts.location.name}`,
          text: reportText(report),
          html: reportHtml(report),
          locationId: locId,
        },
      });
      if (mail.status === "sent") delivered = "email";
      else if (mail.status === "logged_only") delivered = "outbox";
    } catch {
      delivered = "inbox";
    }
  }
  report.delivered = delivered;

  useOpsJobsStore.getState().push(report);
  useOpsJobsStore.getState().markFired(cadence, key);
  if (facts.daypartBaselines?.length) {
    useOpsJobsStore.getState().setBaselines(
      facts.daypartBaselines.map((b) => ({ ...b, updatedAt: Date.now() })),
    );
  }

  if (cfg.notifyRoles.length) {
    const title =
      report.status === "skipped"
        ? `${JOB_CADENCE_LABEL[cadence]} skipped`
        : `${JOB_CADENCE_LABEL[cadence]} pack`;
    useNotifyStore.getState().pushNotice({
      kind: "ops_job",
      title,
      body: report.narrative.slice(0, 220),
    });
  }
  return report;
}

export { reportHtml, reportText };
