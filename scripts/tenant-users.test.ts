import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  TENANT_USERS_CIRCLE_COPY,
  TENANT_USERS_EMPTY,
  assertNotPlatformAdminRole,
  demoVenueIsolated,
  isPlatformAdminEmail,
  loginRoleLabel,
  parseTenantFloorRole,
  parseTenantLoginRole,
  tenantConsoleLoginUrl,
} from "../src/lib/saas/tenant-users.ts";

test("venue_owner maps to location admin owner, never platform_admin", () => {
  assert.equal(parseTenantLoginRole("venue_owner"), "owner");
  assert.equal(parseTenantLoginRole("location_admin"), "owner");
  assert.equal(parseTenantLoginRole("manager"), "manager");
  assert.equal(loginRoleLabel("owner"), "Location admin");
  assert.throws(() => parseTenantLoginRole("platform_admin"), /second platform Admin/);
  assert.throws(() => assertNotPlatformAdminRole("platform_admin"), /second platform Admin/);
});

test("floor staff cannot be platform Admin", () => {
  assert.equal(parseTenantFloorRole("server"), "server");
  assert.equal(parseTenantFloorRole("bartender"), "bartender");
  assert.throws(() => parseTenantFloorRole("platform_admin"), /not platform Admin/);
});

test("platform admin email cannot be reused as a location admin", () => {
  assert.equal(isPlatformAdminEmail("admin@summex.local"), true);
  assert.equal(isPlatformAdminEmail("Admin@Summex.local"), true);
  assert.equal(isPlatformAdminEmail("owner@venue.example"), false);
});

test("location admin login URL is the console, not marketing www", () => {
  assert.equal(tenantConsoleLoginUrl("https://www.summex.app"), "https://app.summex.app/login");
  assert.equal(tenantConsoleLoginUrl(), "https://app.summex.app/login");
});

test("demo house is isolated from other tenants but members may sign in", () => {
  assert.equal(
    demoVenueIsolated({ isDemo: true, isPlatformAdmin: false, hasOrgMembership: false }),
    true,
  );
  assert.equal(
    demoVenueIsolated({ isDemo: true, isPlatformAdmin: true, hasOrgMembership: false }),
    false,
  );
  assert.equal(
    demoVenueIsolated({ isDemo: true, isPlatformAdmin: false, hasOrgMembership: true }),
    false,
  );
  assert.equal(
    demoVenueIsolated({ isDemo: false, isPlatformAdmin: false, hasOrgMembership: false }),
    false,
  );
});

test("Users tab copy is an add form, not a circle back to the platform", () => {
  function Empty({ hasAdd }: { hasAdd: boolean }) {
    return createElement(
      "div",
      { "data-demo": "tenant-users" },
      hasAdd ? createElement("button", null, "Add location admin") : null,
      createElement("p", null, TENANT_USERS_EMPTY),
    );
  }
  const html = renderToString(createElement(Empty, { hasAdd: true }));
  assert.match(html, /Add location admin/);
  assert.match(html, /No location admins or floor staff/);
  assert.doesNotMatch(html, new RegExp(TENANT_USERS_CIRCLE_COPY));

  const panel = readFileSync("src/components/platform/TenantUsersPanel.tsx", "utf8");
  assert.match(panel, /Add location admin/);
  assert.match(panel, /Add floor staff/);
  assert.match(panel, /Force password change on first login/);
  assert.doesNotMatch(panel, /Add people on the platform/);

  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /TenantUsersPanel/);
  assert.doesNotMatch(venue, /Add people on the platform/);
});
