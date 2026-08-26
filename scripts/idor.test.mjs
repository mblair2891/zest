import test from "node:test";
import assert from "node:assert/strict";

/** Mirrors src/lib/saas/tenancy-rules.ts */
class TenancyDenied extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "TenancyDenied";
  }
}

function assertMembershipScope(opts) {
  const requestedOrg = String(opts.requestedOrgId ?? "").trim();
  const requestedLoc = String(opts.requestedLocationId ?? "").trim();
  const locationOrg = String(opts.locationOrgId ?? "").trim();
  if (opts.isPlatformAdmin) {
    return { orgId: locationOrg || requestedOrg || "platform", role: "platform_admin" };
  }
  const active = opts.memberships.filter((m) => m.status === "active" && m.orgId);
  if (requestedLoc) {
    if (!locationOrg) throw new TenancyDenied("Location not found");
    if (requestedOrg && requestedOrg !== locationOrg) {
      throw new TenancyDenied("Organization mismatch");
    }
    const mem = active.find(
      (m) => m.orgId === locationOrg && (m.locationId === requestedLoc || !m.locationId),
    );
    if (!mem) throw new TenancyDenied("Forbidden");
    return { orgId: locationOrg, role: mem.role };
  }
  if (requestedOrg) {
    const mem = active.find((m) => m.orgId === requestedOrg);
    if (!mem) throw new TenancyDenied("Forbidden");
    return { orgId: requestedOrg, role: mem.role };
  }
  throw new TenancyDenied("Select an organization");
}

const HOST_SCOPE = "host";
const HOST_WRITE = new Set(["owner", "manager", "platform_admin"]);

function defaultEditMenu(subject, target) {
  if (subject === HOST_SCOPE) return true;
  if (subject === target) return true;
  return false;
}

/** Mirrors src/lib/access/entity-write-rules.ts + default grants */
function canWriteEntityResource(opts) {
  if (opts.isPlatformAdmin) return true;
  const grant = opts.grant ?? "edit_menu";
  const subject = (opts.operatorId || HOST_SCOPE).trim() || HOST_SCOPE;
  const target = (opts.resourceOperatorId || HOST_SCOPE).trim() || HOST_SCOPE;
  if (opts.role !== "vendor" && HOST_WRITE.has(opts.role) && subject === HOST_SCOPE) {
    return true;
  }
  if (subject === target && grant !== "manage_devices") return true;
  const matrix = Array.isArray(opts.matrix) ? opts.matrix : [];
  const row = matrix.find((r) => r.subjectOperatorId === subject && r.targetOperatorId === target);
  if (row && typeof row[grant] === "boolean") return row[grant];
  if (grant === "edit_menu") return defaultEditMenu(subject, target);
  if (grant === "manage_devices") return subject === HOST_SCOPE;
  return false;
}

/** Mirrors src/lib/pos/qr-table.ts location binding */
function locationQrFingerprint(locationId) {
  const s = String(locationId ?? "").trim();
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(4, "0").slice(0, 4);
}

function makeTableQrToken(tableId, label, locationId) {
  const fp = locationId ? locationQrFingerprint(locationId) : "xxxx";
  const seed = `${tableId}:${label}`.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const tail = tableId.replace(/[^a-z0-9]/gi, "").slice(-4);
  return `t${fp}${seed}${tail}`.slice(0, 24).toLowerCase();
}

function qrTokenMatchesLocation(token, locationId) {
  const t = String(token ?? "").trim().toLowerCase();
  const loc = String(locationId ?? "").trim();
  if (!t || t[0] !== "t" || t.length < 5 || !loc) return false;
  return t.slice(1, 5) === locationQrFingerprint(loc);
}

const orgA = "org_alpha";
const orgB = "org_bravo";
const locA = "loc_alpha_1";
const locB = "loc_bravo_1";
const steam = "op_steam";
const diamond = "op_diamond";

function throwsDenied(fn) {
  assert.throws(fn, (err) => err instanceof TenancyDenied);
}

test("user A cannot get user B location checks", () => {
  throwsDenied(() =>
    assertMembershipScope({
      isPlatformAdmin: false,
      memberships: [{ orgId: orgA, locationId: locA, role: "owner", status: "active" }],
      requestedLocationId: locB,
      locationOrgId: orgB,
    }),
  );
});

test("client orgId cannot retarget another tenant’s location", () => {
  throwsDenied(() =>
    assertMembershipScope({
      isPlatformAdmin: false,
      memberships: [{ orgId: orgA, locationId: locA, role: "manager", status: "active" }],
      requestedOrgId: orgA,
      requestedLocationId: locB,
      locationOrgId: orgB,
    }),
  );
});

test("org A owner can read their own location checks", () => {
  const got = assertMembershipScope({
    isPlatformAdmin: false,
    memberships: [{ orgId: orgA, locationId: locA, role: "owner", status: "active" }],
    requestedLocationId: locA,
    locationOrgId: orgA,
  });
  assert.equal(got.orgId, orgA);
  assert.equal(got.role, "owner");
});

test("platform admin remains global across orgs", () => {
  const got = assertMembershipScope({
    isPlatformAdmin: true,
    memberships: [],
    requestedLocationId: locB,
    locationOrgId: orgB,
  });
  assert.equal(got.role, "platform_admin");
  assert.equal(got.orgId, orgB);
});

test("vendor_operator cannot PATCH other operator menu", () => {
  assert.equal(
    canWriteEntityResource({
      isPlatformAdmin: false,
      role: "vendor",
      operatorId: steam,
      resourceOperatorId: steam,
      grant: "edit_menu",
    }),
    true,
  );
  assert.equal(
    canWriteEntityResource({
      isPlatformAdmin: false,
      role: "vendor",
      operatorId: steam,
      resourceOperatorId: diamond,
      grant: "edit_menu",
    }),
    false,
  );
});

test("host matrix can allow Steam to edit Diamond menu", () => {
  assert.equal(
    canWriteEntityResource({
      isPlatformAdmin: false,
      role: "vendor",
      operatorId: steam,
      resourceOperatorId: diamond,
      grant: "edit_menu",
      matrix: [
        {
          subjectOperatorId: steam,
          targetOperatorId: diamond,
          edit_menu: true,
        },
      ],
    }),
    true,
  );
});

test("QR/table token cannot open another location", () => {
  const tokenA = makeTableQrToken("tbl_1", "12", locA);
  const tokenB = makeTableQrToken("tbl_1", "12", locB);
  assert.equal(qrTokenMatchesLocation(tokenA, locA), true);
  assert.equal(qrTokenMatchesLocation(tokenA, locB), false);
  assert.equal(qrTokenMatchesLocation(tokenB, locA), false);
  assert.notEqual(tokenA, tokenB);
});
