import { formatCurrency } from "@/lib/utils";
import { parseCashHandling } from "./cash-handling";
import { parseLossPrevention } from "./loss-prevention";
import { usePosStore } from "./store";
import { useNotifyStore } from "./notify-store";
import type { TillCloseRecord } from "./till-closeout";

function splitList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tillReviewDeepLink(): string {
  try {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/station?view=cash`;
  } catch {
    return "";
  }
}

export function tillMismatchMessage(row: TillCloseRecord, storeName: string): {
  title: string;
  body: string;
  sms: string;
} {
  const title = `Till over/short · ${row.tillName}`;
  const os = formatCurrency(row.overShortCents ?? 0);
  const first = formatCurrency(row.firstTotalCents ?? 0);
  const second = formatCurrency(row.secondCountedCents ?? row.countedCents ?? 0);
  const expected = formatCurrency(row.sealed.expectedCents);
  const body = [
    storeName,
    `Till ${row.tillName}`,
    `${row.employeeName} (${row.employeeId})`,
    `1st total ${first}`,
    `2nd denom ${second}`,
    `Expected ${expected}`,
    `Over/short ${os}`,
    `Close ${row.id}`,
  ].join(" · ");
  const sms = `${title}: ${row.employeeName} ${os}. Open Cash → Till closeouts. ${row.id}`.slice(0, 460);
  return { title, body, sms };
}

export function dispatchTillMismatchAlerts(row: TillCloseRecord): void {
  const pos = usePosStore.getState();
  const cfg = parseCashHandling(pos.settings.cashHandling);
  const lp = parseLossPrevention(pos.settings.lossPrevention);
  const storeName = pos.settings.name || "Store";
  const loc = pos.tenantLocationId || row.locationId;
  const msg = tillMismatchMessage(row, storeName);
  const link = tillReviewDeepLink();

  if (cfg.tillNotifyInApp) {
    useNotifyStore.getState().pushNotice({
      kind: "till_over_short",
      title: msg.title,
      body: msg.body,
      serverId: row.employeeId,
      serverName: row.employeeName,
      audience: ["manager"],
      tableLabel: row.tillName,
    });
  }

  if (cfg.tillNotifyPush && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(msg.title, { body: msg.body });
    } catch {
      /* */
    }
  }

  const phones = [
    ...splitList(cfg.tillNotifyPhones).map((p) => p.replace(/[^\d+]/g, "")),
    ...(lp.onCallList || []).map((c) => c.phone.replace(/[^\d+]/g, "")),
  ].filter((p) => p.length >= 8);

  if (cfg.tillNotifySms && phones.length) {
    void import("./approval-api")
      .then((m) =>
        m.notifyOnCallFn({
          data: {
            locationId: loc,
            phones,
            body: `${msg.sms}${link ? ` ${link}` : ""}`.slice(0, 480),
          },
        }),
      )
      .catch(() => undefined);
  }

  const emails = splitList(cfg.tillNotifyEmails);
  if (cfg.tillNotifyEmail && emails.length) {
    void import("./till-closeout-api")
      .then((m) =>
        m.notifyTillMismatchFn({
          data: {
            locationId: loc,
            emails,
            subject: msg.title,
            text: `${msg.body}\n${link}\nOpen Cash → Till closeouts.`,
          },
        }),
      )
      .catch(() => undefined);
  }
}
