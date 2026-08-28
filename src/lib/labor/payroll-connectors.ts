/**
 * Payroll *feed* connectors. Summex never runs payroll, files taxes, or prints checks.
 * Missing vendor keys → CSV fallback. Prefer provider employee id; never send SSN.
 */
import { readServerEnv } from "@/lib/database-url";
import {
  genericPayrollCsv,
  payrollExportFileName,
  type PayrollExportBatch,
  type PayrollProviderId,
  type PayrollPushResult,
} from "./payroll-export";

export type PayrollConnectorStatus = {
  id: PayrollProviderId;
  label: string;
  apiConfigured: boolean;
  connectHint: string;
};

function csvResult(batch: PayrollExportBatch, message: string): PayrollPushResult {
  return {
    ok: true,
    mode: "csv_fallback",
    message,
    csv: genericPayrollCsv(batch),
    fileName: payrollExportFileName(batch),
  };
}

export function intuitStatus(): PayrollConnectorStatus {
  const token = readServerEnv("INTUIT_ACCESS_TOKEN");
  const realm = readServerEnv("INTUIT_REALM_ID");
  const client = readServerEnv("INTUIT_CLIENT_ID");
  const secret = readServerEnv("INTUIT_CLIENT_SECRET");
  const apiConfigured = Boolean(token && realm);
  let connectHint =
    "Connect Intuit QuickBooks Payroll: set INTUIT_CLIENT_ID, INTUIT_CLIENT_SECRET, INTUIT_REALM_ID, and INTUIT_ACCESS_TOKEN. Until then, download CSV.";
  if (apiConfigured) {
    connectHint = "Intuit QuickBooks Payroll keys are present. Hours push uses provider employee ids — not SSN.";
  } else if (client && secret) {
    connectHint =
      "Intuit app keys are set. Add INTUIT_ACCESS_TOKEN and INTUIT_REALM_ID to push hours, or download CSV.";
  }
  return { id: "intuit", label: "Intuit (QuickBooks Payroll)", apiConfigured, connectHint };
}

export function adpStatus(): PayrollConnectorStatus {
  const token = readServerEnv("ADP_ACCESS_TOKEN");
  const client = readServerEnv("ADP_CLIENT_ID");
  const secret = readServerEnv("ADP_CLIENT_SECRET");
  const apiConfigured = Boolean(token && client && secret);
  let connectHint =
    "Connect ADP: set ADP_CLIENT_ID, ADP_CLIENT_SECRET, and ADP_ACCESS_TOKEN. Until then, download CSV.";
  if (apiConfigured) {
    connectHint = "ADP keys are present. Hours push uses provider employee ids — not SSN.";
  } else if (client && secret) {
    connectHint = "ADP app keys are set. Add ADP_ACCESS_TOKEN to push hours, or download CSV.";
  }
  return { id: "adp", label: "ADP", apiConfigured, connectHint };
}

export function connectorStatus(provider: PayrollProviderId): PayrollConnectorStatus {
  if (provider === "intuit") return intuitStatus();
  if (provider === "adp") return adpStatus();
  if (provider === "csv" || provider === "other") {
    return {
      id: provider,
      label: provider === "other" ? "Other (generic CSV)" : "CSV only",
      apiConfigured: false,
      connectHint: "Download the generic hours CSV and import it in your payroll product.",
    };
  }
  return {
    id: "none",
    label: "None",
    apiConfigured: false,
    connectHint: "Pick CSV, Intuit, ADP, or Other on HR → Flags. Manual CSV download still works.",
  };
}

async function pushIntuit(batch: PayrollExportBatch): Promise<PayrollPushResult> {
  const st = intuitStatus();
  if (!st.apiConfigured) return csvResult(batch, st.connectHint);
  const token = readServerEnv("INTUIT_ACCESS_TOKEN")!;
  const realm = readServerEnv("INTUIT_REALM_ID")!;
  const base =
    readServerEnv("INTUIT_API_BASE")?.replace(/\/$/, "") ||
    "https://quickbooks.api.intuit.com";
  const missing = batch.lines.filter((l) => !l.providerEmployeeId).length;
  try {
    const res = await fetch(
      `${base}/v3/company/${encodeURIComponent(realm)}/batch?minorversion=65`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          BatchItemRequest: batch.lines
            .filter((l) => l.providerEmployeeId)
            .slice(0, 25)
            .map((l, i) => ({
              bId: `t${i + 1}`,
              operation: "create",
              TimeActivity: {
                NameOf: "Employee",
                EmployeeRef: { value: l.providerEmployeeId },
                TxnDate: batch.periodEnd,
                Hours: Math.floor(l.regularHours),
                Minutes: Math.round((l.regularHours % 1) * 60),
                Description: `Summex hours ${batch.periodStart}–${batch.periodEnd} OT ${l.otHours.toFixed(2)}`,
              },
            })),
        }),
      },
    );
    if (!res.ok) {
      return csvResult(
        batch,
        `Intuit returned ${res.status}. Hours CSV is ready to import. ${missing ? `${missing} staff need a provider employee id.` : ""}`.trim(),
      );
    }
    return {
      ok: true,
      mode: "api",
      message: `Hours sent to Intuit QuickBooks Payroll for ${batch.lines.filter((l) => l.providerEmployeeId).length} mapped staff. Summex did not run payroll.`,
      csv: genericPayrollCsv(batch),
      fileName: payrollExportFileName(batch),
    };
  } catch {
    return csvResult(batch, "Intuit unreachable. Download CSV and import in QuickBooks Payroll.");
  }
}

async function pushAdp(batch: PayrollExportBatch): Promise<PayrollPushResult> {
  const st = adpStatus();
  if (!st.apiConfigured) return csvResult(batch, st.connectHint);
  const token = readServerEnv("ADP_ACCESS_TOKEN")!;
  const base = readServerEnv("ADP_API_BASE")?.replace(/\/$/, "") || "https://api.adp.com";
  const missing = batch.lines.filter((l) => !l.providerEmployeeId).length;
  const payload = {
    timeCards: batch.lines
      .filter((l) => l.providerEmployeeId)
      .map((l) => ({
        associateOID: l.providerEmployeeId,
        timePeriod: { startDate: batch.periodStart, endDate: batch.periodEnd },
        regularHours: Number(l.regularHours.toFixed(2)),
        overtimeHours: Number(l.otHours.toFixed(2)),
        reportedTips: Number((l.declaredTipsCents / 100).toFixed(2)),
        creditCardTips: Number((l.ccTipsCents / 100).toFixed(2)),
      })),
  };
  try {
    const res = await fetch(`${base}/time/v2/time-cards`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return csvResult(
        batch,
        `ADP returned ${res.status}. Hours CSV is ready to import. ${missing ? `${missing} staff need a provider employee id.` : ""}`.trim(),
      );
    }
    return {
      ok: true,
      mode: "api",
      message: `Hours sent to ADP for ${payload.timeCards.length} mapped staff. Summex did not run payroll.`,
      csv: genericPayrollCsv(batch),
      fileName: payrollExportFileName(batch),
    };
  } catch {
    return csvResult(batch, "ADP unreachable. Download CSV and import in ADP.");
  }
}

export async function pushPayrollBatch(batch: PayrollExportBatch): Promise<PayrollPushResult> {
  if (batch.provider === "intuit") return pushIntuit(batch);
  if (batch.provider === "adp") return pushAdp(batch);
  const st = connectorStatus(batch.provider);
  return csvResult(batch, st.connectHint);
}
