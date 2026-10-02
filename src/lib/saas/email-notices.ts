import { readServerEnv } from "../database-url.ts";

/** System From. MAIL_FROM overrides this. Never a person's name. */
export const DEFAULT_MAIL_FROM = "Summex <noreply@mail.summex.app>";

export const SYSTEM_REPLY_TO = "support@summex.app";

export function emailFromAddress(): string {
  const env =
    readServerEnv("MAIL_FROM") || readServerEnv("EMAIL_FROM") || readServerEnv("RESEND_FROM");
  if (!env || !env.includes("@")) return DEFAULT_MAIL_FROM;
  return env;
}

export function emailStatusLabel(status: string | null | undefined): "email sent" | "email not sent" {
  return status === "sent" ? "email sent" : "email not sent";
}

export function noteUnsentEmail(kind: string, to: string, subject: string, text: string): void {
  console.info("[email:not-sent]", kind, to, subject, text);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function plainTextHtml(text: string): string {
  const paras = text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p).replaceAll("\n", "<br/>")}</p>`,
    )
    .join("");
  return `<!doctype html><html><body style="font-family:Inter,Helvetica,Arial,sans-serif;color:#0a0a0a">${paras}</body></html>`;
}

export function locationAdminMail(opts: {
  name: string;
  username: string;
  loginUrl: string;
  tempPassword: string;
  forceChange: boolean;
}): { subject: string; text: string } {
  return {
    subject: "Summex — your location login",
    text: [
      `Hello ${opts.name.trim() || "there"},`,
      "",
      "A location login was created for you. This is not a staff PIN.",
      `Log in: ${opts.loginUrl}`,
      `Username: ${opts.username}`,
      `Temporary password: ${opts.tempPassword}`,
      "",
      opts.forceChange
        ? "Sign in and set a new password. You must change this password on first login."
        : "Sign in with this password. You can change it after login.",
      "",
      `Questions: ${SYSTEM_REPLY_TO}`,
    ].join("\n"),
  };
}

export function passwordResetMail(opts: {
  name: string;
  username: string;
  loginUrl: string;
  tempPassword: string;
}): { subject: string; text: string } {
  return {
    subject: "Summex — password reset",
    text: [
      `Hello ${opts.name.trim() || "there"},`,
      "",
      "Your location password was reset. This is not a staff PIN.",
      `Log in: ${opts.loginUrl}`,
      `Username: ${opts.username}`,
      `Temporary password: ${opts.tempPassword}`,
      "",
      "Sign in and set a new password. You must change this password on next login.",
      "",
      `Questions: ${SYSTEM_REPLY_TO}`,
    ].join("\n"),
  };
}

/** Resend JSON. From is the system mailbox. Reply-To is support. */
export function resendPayload(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string | null;
  from?: string;
}): {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  html?: string;
} {
  const body: {
    from: string;
    to: string[];
    reply_to: string;
    subject: string;
    text: string;
    html?: string;
  } = {
    from: opts.from || emailFromAddress(),
    to: [opts.to],
    reply_to: SYSTEM_REPLY_TO,
    subject: opts.subject,
    text: opts.text,
  };
  if (opts.html) body.html = opts.html;
  return body;
}
