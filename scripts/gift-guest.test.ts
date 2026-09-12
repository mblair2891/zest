import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canReactivateGift,
  canReactivateGiftStaff,
  guestKindFromLedger,
  isClosedGiftLife,
  isCurrentGiftLife,
} from "../src/lib/gift/guest-view.ts";
import {
  generateGiftPin,
  hashGiftPan,
  hashGiftPin,
  isFullGiftPan,
  normalizeGiftCode,
  normalizeGiftPin,
} from "../src/lib/gift/hash.ts";
import { isMarketingStayPath } from "../src/lib/auth/post-login-dest.ts";
import { isPlatformPath, marketingToPlatformHref } from "../src/lib/platform/host-split.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("guest activity maps load/redeem/void only", () => {
  assert.equal(guestKindFromLedger("issue", "Issuer liability — not seller merchandise"), "load");
  assert.equal(guestKindFromLedger("issue", "reload"), "load");
  assert.equal(guestKindFromLedger("redeem", null), "redeem");
  assert.equal(guestKindFromLedger("void", null), "void");
  assert.equal(guestKindFromLedger("issue", "reactivate"), null);
  assert.equal(guestKindFromLedger("adjust", "force close: leftover"), null);
  assert.equal(guestKindFromLedger("close", "spent"), null);
  assert.equal(guestKindFromLedger("remit", "redeem"), null);
  assert.equal(guestKindFromLedger("freeze", null), null);
});

test("reactivate requires $0 or force+reason", () => {
  assert.deepEqual(canReactivateGift({ balanceCents: 0 }), { ok: true });
  assert.equal(canReactivateGift({ balanceCents: 500 }).ok, false);
  assert.equal(canReactivateGift({ balanceCents: 500, force: true, reason: "short" }).ok, false);
  assert.deepEqual(
    canReactivateGift({ balanceCents: 500, force: true, reason: "Sleeve reprint after $0 intent" }),
    { ok: true },
  );
  assert.equal(canReactivateGift({ balanceCents: 0, status: "closed" }).ok, false);
  assert.equal(canReactivateGift({ balanceCents: 0, status: "void" }).ok, false);
});

test("reactivate is venue admin / host manager, not entity vendor", () => {
  assert.equal(canReactivateGiftStaff({ role: "owner", operatorId: "host" }), true);
  assert.equal(canReactivateGiftStaff({ role: "manager", operatorId: "host" }), true);
  assert.equal(canReactivateGiftStaff({ role: "manager", operatorId: "op_bar" }), false);
  assert.equal(canReactivateGiftStaff({ role: "vendor", operatorId: "op_bar" }), false);
  assert.equal(canReactivateGiftStaff({ role: "accountant", operatorId: "host" }), false);
  assert.equal(canReactivateGiftStaff({ role: "server", operatorId: "host" }), false);
  assert.equal(canReactivateGiftStaff({ role: "vendor", isPlatformAdmin: true }), true);
});

test("closed life is not current", () => {
  assert.equal(isClosedGiftLife("closed"), true);
  assert.equal(isCurrentGiftLife("zeroed"), true);
  assert.equal(isCurrentGiftLife("closed"), false);
});

test("PAN and PIN hashes are stable; PIN is four digits", () => {
  assert.equal(normalizeGiftCode("  ab-12 34 "), "AB1234");
  assert.equal(isFullGiftPan("12345678"), true);
  assert.equal(isFullGiftPan("1234"), false);
  assert.equal(hashGiftPan("SUMMEX-AB12-9999"), hashGiftPan("summexab129999"));
  assert.equal(hashGiftPin("9999", "1234"), hashGiftPin("9999", "1234"));
  assert.notEqual(hashGiftPin("9999", "1234"), hashGiftPin("9998", "1234"));
  const pin = generateGiftPin();
  assert.match(pin, /^[1-9]\d{3}$/);
  assert.equal(normalizeGiftPin("12 34"), "1234");
});

test("/gift stays on marketing; not a console path", () => {
  assert.equal(isMarketingStayPath("/gift"), true);
  assert.equal(isPlatformPath("/gift"), false);
  assert.equal(marketingToPlatformHref("/gift", "summex.app", "https:"), null);
  const route = readFileSync(join(root, "src/routes/gift.tsx"), "utf8");
  assert.match(route, /createFileRoute\("\/gift"\)/);
  assert.equal(route.includes("SessionGate"), false);
  assert.equal(route.includes("LandingFrame"), false);
  assert.equal(route.includes("authMiddleware"), false);
  const page = readFileSync(join(root, "src/components/gift/GuestGiftPage.tsx"), "utf8");
  assert.equal(page.includes("actor_name"), false);
  assert.equal(page.includes("Get a price"), false);
  assert.match(page, /Look up/);
});
