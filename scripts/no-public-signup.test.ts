import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("login shows username, password, guide, and back — no create-account link", () => {
  const login = read("../src/routes/login.tsx");
  const auth = read("../src/components/saas/AuthScreen.tsx");
  assert.match(login, /Username or email and password/);
  assert.match(login, /mode="signin"/);
  assert.match(login, /Back to Summex/);
  assert.match(auth, /placeholder="Password"/);
  assert.match(auth, /Operators Guide/);
  assert.doesNotMatch(auth, /Create an account/);
  assert.doesNotMatch(auth, /to="\/signup"/);
  assert.doesNotMatch(login, /Create an account/);
  assert.doesNotMatch(login, /\/signup/);
});

test("/signup and /register redirect to login", () => {
  for (const file of ["../src/routes/signup.tsx", "../src/routes/register.tsx"]) {
    const src = read(file);
    assert.match(src, /redirect\(\{\s*to:\s*"\/login"\s*\}\)/);
    assert.doesNotMatch(src, /mode="signup"/);
    assert.doesNotMatch(src, /AuthScreen/);
  }
  const tree = read("../src/routeTree.gen.ts");
  assert.match(tree, /'\/register'/);
  assert.match(tree, /'\/signup'/);
});

test("public shells do not offer account creation", () => {
  for (const file of [
    "../src/components/pos/PosApp.tsx",
    "../src/components/pos/PlatformApp.tsx",
    "../src/routes/pricing.tsx",
  ]) {
    const src = read(file);
    assert.doesNotMatch(src, /\/signup/);
    assert.doesNotMatch(src, /Create an account/);
    assert.doesNotMatch(src, /Create account/);
  }
});

test("invite email still creates the invited account", () => {
  assert.match(read("../src/routes/invite.$token.tsx"), /mode="signup"/);
  assert.match(read("../src/routes/tenant.$token.tsx"), /mode="signup"/);
});
