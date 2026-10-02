import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_MAIL_FROM,
  SYSTEM_REPLY_TO,
  emailFromAddress,
  emailStatusLabel,
  locationAdminMail,
  noteUnsentEmail,
  passwordResetMail,
  resendPayload,
} from "../src/lib/saas/email-notices.ts";

test("system mail uses the noreply mailbox and support reply-to", () => {
  const prev = {
    MAIL_FROM: process.env.MAIL_FROM,
    EMAIL_FROM: process.env.EMAIL_FROM,
    RESEND_FROM: process.env.RESEND_FROM,
  };
  delete process.env.MAIL_FROM;
  delete process.env.EMAIL_FROM;
  delete process.env.RESEND_FROM;
  assert.equal(emailFromAddress(), DEFAULT_MAIL_FROM);
  assert.match(DEFAULT_MAIL_FROM, /noreply@mail\.summex\.app/);
  process.env.MAIL_FROM = "Summex <noreply@mail.summex.app>";
  assert.equal(emailFromAddress(), "Summex <noreply@mail.summex.app>");
  process.env.MAIL_FROM = "Pat Manager";
  assert.equal(emailFromAddress(), DEFAULT_MAIL_FROM);
  const payload = resendPayload({
    to: "owner@venue.example",
    subject: "Summex — your location login",
    text: "Temporary password: secret",
  });
  assert.equal(payload.from, DEFAULT_MAIL_FROM);
  assert.equal(payload.reply_to, SYSTEM_REPLY_TO);
  assert.deepEqual(payload.to, ["owner@venue.example"]);
  assert.equal(emailStatusLabel("sent"), "email sent");
  assert.equal(emailStatusLabel("logged_only"), "email not sent");
  assert.equal(emailStatusLabel("failed"), "email not sent");
  for (const [key, value] of Object.entries(prev)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("location admin and password reset include login, username, and temp password", () => {
  const admin = locationAdminMail({
    name: "Ada",
    username: "ada@venue.example",
    loginUrl: "https://app.summex.app/login",
    tempPassword: "TempPass1234",
    forceChange: true,
  });
  assert.match(admin.text, /https:\/\/app\.summex\.app\/login/);
  assert.match(admin.text, /ada@venue\.example/);
  assert.match(admin.text, /TempPass1234/);
  assert.match(admin.text, /support@summex\.app/);
  const reset = passwordResetMail({
    name: "Ada",
    username: "ada@venue.example",
    loginUrl: "https://app.summex.app/login",
    tempPassword: "NextPass1234",
  });
  assert.match(reset.subject, /password reset/i);
  assert.match(reset.text, /NextPass1234/);
});

test("a missing mail key logs the message and does not claim it sent", () => {
  const lines: string[] = [];
  const orig = console.info;
  console.info = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    noteUnsentEmail("location_admin_created", "ada@venue.example", "Summex — your location login", "Temporary password: TempPass1234");
  } finally {
    console.info = orig;
  }
  assert.match(lines.join("\n"), /\[email:not-sent\].*location_admin_created.*TempPass1234/);
  const server = readFileSync("src/lib/saas/email.server.ts", "utf8");
  assert.match(server, /noteUnsentEmail/);
  assert.match(server, /resendPayload/);
  assert.doesNotMatch(server, /status === "sent" \|\| result\.status === "logged_only"/);
  const invite = readFileSync("src/lib/saas/subscriber-login.server.ts", "utf8");
  assert.match(invite, /sent = result\.status === "sent"/);
  assert.doesNotMatch(invite, /logged_only/);
  const users = readFileSync("src/components/platform/TenantUsersPanel.tsx", "utf8");
  assert.match(users, /Email not sent/);
  const panel = readFileSync("src/components/pos/TenantInvitesPanel.tsx", "utf8");
  assert.match(panel, /Email not sent/);
});
