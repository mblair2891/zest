import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

const INTERNAL = [
  "DATABASE_URL",
  "TWILIO_ACCOUNT",
  "TWILIO_AUTH",
  "XAI_API_KEY",
  "PLATFORM_ADMIN",
  "process.env",
  "VITE_",
  "PGLite",
  "factory reset",
  "tenant wipe",
];

test("terms and privacy are public marketing pages with no login", () => {
  const terms = read("src/routes/terms.tsx");
  const privacy = read("src/routes/privacy.tsx");
  const legal = read("src/components/marketing/LegalDocument.tsx");

  assert.match(terms, /createFileRoute\("\/terms"\)/);
  assert.match(privacy, /createFileRoute\("\/privacy"\)/);
  assert.match(legal, /LandingFrame/);
  assert.equal(terms.includes("SessionGate"), false);
  assert.equal(privacy.includes("SessionGate"), false);
  assert.equal(terms.includes("authMiddleware"), false);
  assert.equal(privacy.includes("authMiddleware"), false);
  assert.equal(terms.includes("RedirectToSignIn"), false);
  assert.equal(privacy.includes("RedirectToSignIn"), false);

  for (const needle of INTERNAL) {
    assert.equal(terms.includes(needle), false, `terms must not mention ${needle}`);
    assert.equal(privacy.includes(needle), false, `privacy must not mention ${needle}`);
    assert.equal(legal.includes(needle), false, `legal shell must not mention ${needle}`);
  }
});

test("terms copy covers subscriber, payments, hardware, and Oregon law", () => {
  const terms = read("src/routes/terms.tsx").replace(/\s+/g, " ");
  assert.match(terms, /Quantum Reach/);
  assert.match(terms, /Summex Station/);
  assert.match(terms, /hosted page/);
  assert.match(terms, /Quantum Payments/);
  assert.match(terms, /Finix/);
  assert.match(terms, /not a bank/i);
  assert.match(terms, /split check/i);
  assert.match(terms, /Cash-discount/);
  assert.match(terms, /Android tablets/);
  assert.match(terms, /SMS overage/);
  assert.match(terms, /sandbox/);
  assert.match(terms, /staff PIN/);
  assert.match(terms, /escheat/);
  assert.match(terms, /PAN/);
  assert.match(terms, /Oregon/);
  assert.match(terms, /as is/i);
  assert.match(terms, /support@summex\.app/);
});

test("privacy copy covers guests, cards, SMS, cookies, and CCPA-style rights", () => {
  const privacy = read("src/routes/privacy.tsx").replace(/\s+/g, " ");
  assert.match(privacy, /PIN hashes/);
  assert.match(privacy, /waitlist/);
  assert.match(privacy, /do not sell guest lists/i);
  assert.match(privacy, /PAN and CVV are never stored/i);
  assert.match(privacy, /last four/i);
  assert.match(privacy, /Twilio or a successor/);
  assert.match(privacy, /STOP/);
  assert.match(privacy, /session cookies/);
  assert.match(privacy, /Vercel/);
  assert.match(privacy, /do not sell personal information/i);
  assert.match(privacy, /CCPA/);
  assert.match(privacy, /encryption in transit/i);
  assert.match(privacy, /not directed at children/i);
  assert.match(privacy, /support@summex\.app/);
  assert.match(privacy, /No advertising SDKs/);
});

test("marketing header and footer link Terms and Privacy; PIN pad does not", () => {
  const frame = read("src/components/marketing/LandingFrame.tsx");
  const shell = read("src/components/marketing/MarketingShell.tsx");
  const ctas = read("src/components/marketing/AuthCtas.tsx");
  const pin = read("src/components/pos/PinKeypad.tsx");
  const gate = read("src/components/pos/SessionGate.tsx");
  const hosts = read("src/lib/platform/hosts.ts");
  const venue = read("src/lib/platform/venue-host.ts");
  const split = read("src/lib/platform/host-split.ts");

  assert.match(ctas, /to="\/terms"/);
  assert.match(ctas, /to="\/privacy"/);
  assert.match(frame, /to="\/terms"/);
  assert.match(frame, /to="\/privacy"/);
  assert.match(shell, /to="\/terms"/);
  assert.match(shell, /to="\/privacy"/);
  assert.match(hosts, /"\/terms"/);
  assert.match(venue, /"terms"/);
  assert.equal(split.includes('"/terms"'), false);
  assert.equal(pin.includes("/terms"), false);
  assert.equal(pin.includes("/privacy"), false);
  assert.equal(gate.includes("/terms"), false);
  assert.equal(gate.includes("/privacy"), false);
});
