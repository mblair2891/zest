import { PRODUCT_NAME } from "@/lib/platform/brand";
import { formatCurrency } from "@/lib/utils";
import { appPublicUrl } from "./flags";
import { sendEmail } from "./email.server";
import { loadCommunicationsSettings, loadGeneral } from "./platform-settings.server";
import type { ProspectRecord, QuoteSnapshot } from "./prospect-types";

type Vars = Record<string, string>;

function apply(template: string, vars: Vars): string {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

function quoteUrl(token: string): string {
  const base = (appPublicUrl() || "https://www.summex.app").replace(/\/$/, "");
  return `${base}/quote/${encodeURIComponent(token)}`;
}

function varsFor(prospect: ProspectRecord, extra?: Partial<Vars>): Vars {
  const q = prospect.quote;
  return {
    companyName: prospect.answers.company.legalName || prospect.email || "there",
    planName: q?.planName || q?.planSlug?.replaceAll("_", " ") || "Summex",
    monthly: formatCurrency(q?.softwareMonthlyCents ?? q?.monthlyCents ?? 0),
    setup: formatCurrency(q?.onboardingFeeCents ?? q?.setupFeeCents ?? 0),
    hardwareMonthly: formatCurrency(q?.hardwareMonthlyCents ?? 0),
    hardwareOnce: formatCurrency(q?.hardwareOneTimeCents ?? 0),
    byo:
      (q?.byoChecklist ?? []).length > 0
        ? `You provide (BYO):\n${(q?.byoChecklist ?? []).map((x) => `• ${x}`).join("\n")}\nLive cards require Finix/Quantum readers supplied through Summex.`
        : "BYO tablets, printers, drawers, stands. Live cards require Finix/Quantum readers supplied through Summex.",
    locationCount: String(q?.locationCount ?? prospect.answers.portfolio.locationsNow ?? 1),
    features: (q?.featureList ?? []).map((f) => `• ${f}`).join("\n") || "• POS core + kitchen display",
    expires: q?.expiresAt ? new Date(q.expiresAt).toLocaleDateString() : "see proposal",
    processingNote:
      q?.processingNote ||
      "Guest card processing is Quantum Payments, billed separately from software.",
    commsNote:
      q?.commsNote ||
      "Email included. SMS: 500/mo included, extra at cost. AI reports in Ops pack.",
    quoteUrl: quoteUrl(prospect.publicToken),
    supportEmail: extra?.supportEmail ?? "support@summex.app",
    platformName: extra?.platformName ?? PRODUCT_NAME,
    fromName: extra?.fromName ?? PRODUCT_NAME,
    ...extra,
  };
}

function htmlFromText(subject: string, text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p).replaceAll("\n", "<br/>")}</p>`)
    .join("");
  return `<!doctype html><html><body style="font-family:Inter,Helvetica,Arial,sans-serif;color:#0a0a0a;background:#f7f6f3;padding:24px">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e8e6e1;border-radius:12px;padding:24px">
    <p style="letter-spacing:.16em;font-size:11px;text-transform:uppercase;color:#5c5c5c;margin:0 0 8px">${escapeHtml(PRODUCT_NAME)}</p>
    <h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(subject)}</h1>
    ${paras}
  </div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function contextVars(): Promise<Pick<Vars, "supportEmail" | "platformName" | "fromName">> {
  const [comms, general] = await Promise.all([loadCommunicationsSettings(), loadGeneral()]);
  return {
    supportEmail: general.supportEmail || "support@summex.app",
    platformName: general.displayName || PRODUCT_NAME,
    fromName: comms.fromName || PRODUCT_NAME,
  };
}

export async function emailQuoteRequestReceived(prospect: ProspectRecord): Promise<void> {
  const comms = await loadCommunicationsSettings();
  const ctx = await contextVars();
  const to = prospect.answers.company.billingEmail || prospect.email;
  if (!to) return;
  const v = varsFor(prospect, ctx);
  const subject = apply(comms.quoteRequestSubject, v);
  const text = apply(comms.quoteRequestBody, v);
  await sendEmail({
    to,
    subject,
    text,
    html: htmlFromText(subject, text),
    kind: "quote_request_received",
    prospectId: prospect.id,
  });
}

export async function emailNewQuoteRequestInternal(prospect: ProspectRecord): Promise<void> {
  const comms = await loadCommunicationsSettings();
  const ctx = await contextVars();
  const to = ctx.supportEmail;
  if (!to || !to.includes("@")) return;
  const v = varsFor(prospect, ctx);
  const subject = apply(comms.quoteInternalSubject, v);
  const text = apply(comms.quoteInternalBody, v);
  await sendEmail({
    to,
    subject,
    text,
    html: htmlFromText(subject, text),
    kind: "quote_request_internal",
    prospectId: prospect.id,
  });
}

export async function emailQuoteSent(prospect: ProspectRecord, quote: QuoteSnapshot): Promise<void> {
  const comms = await loadCommunicationsSettings();
  const ctx = await contextVars();
  const to = prospect.answers.company.billingEmail || prospect.email;
  if (!to) return;
  const v = varsFor({ ...prospect, quote }, ctx);
  const subject = apply(comms.quoteSentSubject, v);
  const text = apply(comms.quoteSentBody, v);
  await sendEmail({
    to,
    subject,
    text,
    html: htmlFromText(subject, text),
    kind: "quote_sent",
    prospectId: prospect.id,
  });
}

export async function emailQuoteAccepted(prospect: ProspectRecord): Promise<void> {
  const comms = await loadCommunicationsSettings();
  const ctx = await contextVars();
  const v = varsFor(prospect, ctx);
  const prospectTo = prospect.answers.company.billingEmail || prospect.email;
  const subject = apply(comms.quoteAcceptedSubject, v);
  const text = apply(comms.quoteAcceptedBody, v);
  if (prospectTo) {
    await sendEmail({
      to: prospectTo,
      subject,
      text,
      html: htmlFromText(subject, text),
      kind: "quote_accepted",
      prospectId: prospect.id,
    });
  }
  if (ctx.supportEmail && ctx.supportEmail.toLowerCase() !== prospectTo?.toLowerCase()) {
    await sendEmail({
      to: ctx.supportEmail,
      subject: `Accepted: ${v.companyName} · ${v.planName}`,
      text: `${v.companyName} accepted ${v.planName} at ${v.monthly} / mo.\n${v.quoteUrl}\n`,
      html: htmlFromText(`Accepted: ${v.companyName}`, `${v.companyName} accepted ${v.planName} at ${v.monthly} / mo.\n\n${v.quoteUrl}`),
      kind: "quote_accepted_internal",
      prospectId: prospect.id,
    });
  }
}

export async function emailQuoteChangesRequested(
  prospect: ProspectRecord,
  message: string,
): Promise<void> {
  const ctx = await contextVars();
  const to = ctx.supportEmail;
  if (!to || !to.includes("@")) return;
  const v = varsFor(prospect, ctx);
  const text = `${v.companyName} requested changes to ${v.planName} (${v.monthly} / mo).\n\n${message}\n\n${v.quoteUrl}\n`;
  await sendEmail({
    to,
    subject: `Quote changes: ${v.companyName}`,
    text,
    html: htmlFromText(`Quote changes: ${v.companyName}`, text),
    kind: "quote_changes_requested",
    prospectId: prospect.id,
  });
}

export { quoteUrl };
