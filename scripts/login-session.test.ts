import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PLATFORM_ADMIN_EMAIL } from "../src/lib/platform/brand.ts";
import { loginLookup } from "../src/lib/auth/login-identifier.ts";
import {
  hostOnlySetCookie,
  splitSetCookieList,
  withHostOnlySessionCookies,
} from "../src/lib/auth/session-cookie.ts";

test("Admin and venue usernames resolve to lookup keys", () => {
  assert.deepEqual(loginLookup("Admin"), {
    platformAdmin: true,
    keys: [PLATFORM_ADMIN_EMAIL],
  });
  assert.equal(loginLookup(" ADMIN ").platformAdmin, true);
  assert.deepEqual(loginLookup("ada@Cafe.com").keys, ["ada@cafe.com"]);
  assert.equal(loginLookup("ada@Cafe.com").platformAdmin, false);
  const venue = loginLookup("harbor.owner");
  assert.equal(venue.platformAdmin, false);
  assert.ok(venue.keys.includes("harbor.owner"));
  assert.ok(venue.keys.includes("harbor.owner@venue.summex.app"));
  assert.equal(loginLookup("").keys.length, 0);
});

test("session cookie is Secure, SameSite=Lax, Path=/, and has no Domain", () => {
  const raw =
    "__Host-grok-auth.session_token=abc.def%3D; Max-Age=604800; Domain=www.summex.app; Path=/api; HttpOnly; SameSite=Strict";
  const fixed = hostOnlySetCookie(raw);
  assert.match(fixed, /^__Host-grok-auth\.session_token=abc\.def%3D;/);
  assert.match(fixed, /Path=\//);
  assert.match(fixed, /Secure/);
  assert.match(fixed, /SameSite=Lax/);
  assert.match(fixed, /HttpOnly/);
  assert.doesNotMatch(fixed, /Domain/i);
  assert.doesNotMatch(fixed, /Path=\/api/);
});

test("comma-joined Set-Cookie headers stay separate and host-only", () => {
  const joined = [
    "__Host-grok-auth.session_token=tok; Max-Age=604800; Domain=summex.app; Path=/",
    "__Host-grok-auth.session_data=data; Max-Age=300; Path=/; Secure; SameSite=Lax",
  ].join(", ");
  const parts = splitSetCookieList(joined);
  assert.equal(parts.length, 2);
  const headers = new Headers();
  headers.append("set-cookie", joined);
  headers.set("content-type", "application/json");
  const response = withHostOnlySessionCookies(
    new Response("{}", { status: 200, headers }),
  );
  const cookies = response.headers.getSetCookie();
  assert.equal(cookies.length, 2);
  for (const cookie of cookies) {
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    assert.doesNotMatch(cookie, /Domain/i);
  }
  assert.equal(response.headers.get("content-type"), "application/json");
});

test("auth config trusts both console and marketing origins", () => {
  const server = readFileSync(new URL("../src/lib/auth/server.ts", import.meta.url), "utf8");
  assert.match(server, /https:\/\/app\.summex\.app/);
  assert.match(server, /https:\/\/www\.summex\.app/);
  assert.match(server, /fallback:\s*"https:\/\/app\.summex\.app"/);
  assert.match(server, /sameSite:\s*"lax"/);
  assert.match(server, /path:\s*"\/"/);
  assert.match(server, /secure:\s*true/);
  assert.doesNotMatch(server, /const baseURL = explicitBaseURL/);
  assert.doesNotMatch(server, /domain:\s*["'.]/);
});
