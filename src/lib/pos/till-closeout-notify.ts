import { formatCurrency } from "@/lib/utils";
import { parseCashHandling } from "./cash-handling";
import { parseLossPrevention } from "./loss-prevention";
import { usePosStore } from "./store";
import { useNotifyStore } from "./notify-store";
import type { TillCloseRecord } from "./till-closeout";

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
  const tillName = row.drawerName;
  const title = `Till over/short · ${tillName}`;
  const os = formatCurrency(row.overShortCents ?? 0);
  const first = formatCurrency(row.firstCountedCents ?? 0);
  const second = formatCurrency(row.denomCountedCents ?? row.countedCents ?? 0);
  const expected = formatCurrency(row.expected?.expectedCents ?? 0);
  const body = [
    storeName,
    `Till ${tillName}`,
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

  if (cfg.notifyInApp) {
    useNotifyStore.getState().pushNotice({
      kind: "till_mismatch",
      title: msg.title,
      body: msg.body,
      serverId: row.employeeId,
      serverName: row.employeeName,
      audience: ["manager"],
      tableLabel: row.drawerName,
    });
  }

  if (cfg.notifyPush && typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(msg.title, { body: msg.body });
    } catch {
      /* */
    }
  }

  const phones = [
    ...(lp.onCallList || []).map((c) => c.phone.replace(/[^\d+]/g, "")),
  ].filter((p) => p.length >= 8);

  if (cfg.notifySms && phones.length) {
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

  const emails = cfg.notifyEmails.filter((e) => e.includes("@"));
  if (cfg.notifyEmail && emails.length) {
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
