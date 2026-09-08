import test from "node:test";
import assert from "node:assert/strict";
import {
  consoleLoginUrl,
  generateOneTimePassword,
  subscriberInviteCopy,
  usernameFromEmail,
} from "../src/lib/saas/subscriber-login.ts";

test("username is the billing email", () => {
  assert.equal(usernameFromEmail(" Jane@Cafe.com "), "jane@cafe.com");
  assert.equal(usernameFromEmail("owner"), "owner@venue.summex.app");
});

test("one-time password is 12 chars and not the bootstrap secret", () => {
  const a = generateOneTimePassword(Uint8Array.from({ length: 12 }, (_, i) => i + 3));
  const b = generateOneTimePassword(Uint8Array.from({ length: 12 }, (_, i) => i + 9));
  assert.equal(a.length, 12);
  assert.notEqual(a.toLowerCase(), "password");
  assert.notEqual(a, b);
});

test("login URL is the console host, not marketing www", () => {
  assert.equal(consoleLoginUrl("https://www.summex.app"), "https://app.summex.app/login");
  assert.equal(consoleLoginUrl("https://summex.app"), "https://app.summex.app/login");
  assert.equal(consoleLoginUrl("https://app.summex.app"), "https://app.summex.app/login");
  assert.equal(consoleLoginUrl("http://127.0.0.1:8080"), "http://127.0.0.1:8080/login");
});

test("invite copy names venue setup, not the control plane", () => {
  const mail = subscriberInviteCopy({
    companyName: "Steam Distillery",
    username: "poc@steam.example",
    password: "TmpPass12ab",
    loginUrl: "https://app.summex.app/login",
  });
  assert.match(mail.subject, /Steam Distillery/);
  assert.match(mail.text, /app\.summex\.app\/login/);
  assert.match(mail.text, /poc@steam\.example/);
  assert.match(mail.text, /TmpPass12ab/);
  assert.match(mail.text, /not the Summex control plane/);
  assert.match(mail.text, /change this password/);
});
