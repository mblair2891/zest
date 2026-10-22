import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  TENANT_USERS_CIRCLE_COPY,
  TENANT_USERS_EMPTY,
  assertNotPlatformAdminRole,
  canManageVenueUsers,
  demoVenueIsolated,
  formatFloorPinForAdmin,
  generateFloorPin,
  isPlatformAdminEmail,
  assignableAdminScopes,
  canAssignLocationAdmin,
  defaultAdminScope,
  loginRoleLabel,
  parseTenantAdminScope,
  parseTenantFloorRole,
  parseTenantLoginRole,
  resolvePasswordAssignment,
  tenantConsoleLoginUrl,
  tenantLoginRoleForScope,
} from "../src/lib/saas/tenant-users.ts";
import { PIN_VIEWS } from "../src/lib/access/pin-role.ts";

test("entity_admin maps to vendor membership, labeled Entity admin", () => {
  assert.equal(parseTenantLoginRole("entity_admin"), "vendor");
  assert.equal(parseTenantLoginRole("vendor_operator"), "vendor");
  assert.equal(parseTenantAdminScope("entity"), "entity");
  assert.equal(parseTenantAdminScope("location"), "location");
  assert.equal(tenantLoginRoleForScope("entity"), "vendor");
  assert.equal(tenantLoginRoleForScope("location"), "owner");
  assert.equal(loginRoleLabel("vendor"), "Entity owner");
  assert.equal(loginRoleLabel("owner", "op_bar"), "Entity owner");
  assert.equal(loginRoleLabel("manager", "op_bar"), "Entity manager");
  assert.equal(loginRoleLabel("accountant"), "Accountant");
  assert.equal(loginRoleLabel("accountant", "op_bar"), "Entity accountant");
  assert.equal(loginRoleLabel("owner"), "Location admin");
});

test("venue sets entity contact scope and entity admin is not location admin", () => {
  assert.equal(defaultAdminScope(), "entity");
  assert.deepEqual(assignableAdminScopes({ canAssignLocationAdmin: false }), ["entity"]);
  assert.deepEqual(assignableAdminScopes({ canAssignLocationAdmin: true }), ["entity", "location"]);
  assert.equal(canAssignLocationAdmin({ membershipRole: "manager" }), false);
  assert.equal(canAssignLocationAdmin({ membershipRole: "owner" }), true);
  assert.equal(canAssignLocationAdmin({ membershipRole: "owner", operatorId: "op_bar" }), false);
  assert.equal(canAssignLocationAdmin({ isPlatformAdmin: true, membershipRole: "manager" }), true);

  const entityAdmin = resolvePasswordAssignment({
    scope: "entity",
    seat: "owner",
    operatorId: "op_steam",
    allowLocationAdmin: true,
  });
  assert.equal(entityAdmin.role, "vendor");
  assert.equal(entityAdmin.operatorId, "op_steam");
  assert.equal(entityAdmin.scope, "entity");
  assert.notEqual(entityAdmin.role, "owner");

  const entityManager = resolvePasswordAssignment({
    scope: "entity",
    seat: "manager",
    operatorId: "op_steam",
    allowLocationAdmin: false,
  });
  assert.equal(entityManager.role, "manager");
  assert.equal(entityManager.operatorId, "op_steam");

  const entityAccountant = resolvePasswordAssignment({
    scope: "entity",
    seat: "accountant",
    operatorId: "op_steam",
    allowLocationAdmin: false,
  });
  assert.equal(entityAccountant.role, "accountant");
  assert.equal(entityAccountant.operatorId, "op_steam");

  assert.throws(
    () =>
      resolvePasswordAssignment({
        scope: "location",
        seat: "owner",
        allowLocationAdmin: false,
      }),
    /Location admin/,
  );
  assert.throws(
    () =>
      resolvePasswordAssignment({
        scope: "entity",
        seat: "owner",
        operatorId: "",
        allowLocationAdmin: true,
      }),
    /selling entity/,
  );

  const locationAdmin = resolvePasswordAssignment({
    scope: "location",
    seat: "owner",
    allowLocationAdmin: true,
  });
  assert.equal(locationAdmin.role, "owner");
  assert.equal(locationAdmin.operatorId, null);

  const dash = readFileSync("src/lib/saas/password-dash.ts", "utf8");
  assert.match(dash, /if \(op\) \{\s*if \(role === "manager"\) return "entity_manager";/);
  const tabs = dash.slice(dash.indexOf("export function passwordDashTabs"));
  const entityOwnerTabs = tabs.slice(tabs.indexOf('case "entity_owner"'), tabs.indexOf('case "entity_manager"'));
  assert.doesNotMatch(entityOwnerTabs, /\["people", "Users"\]/);
  assert.doesNotMatch(entityOwnerTabs, /\["devices", "Devices"\]/);
  const entityManagerTabs = tabs.slice(
    tabs.indexOf('case "entity_manager"'),
    tabs.indexOf('case "host_manager"'),
  );
  assert.doesNotMatch(entityManagerTabs, /\["people", "Users"\]/);

  const grants = readFileSync("src/lib/access/entity-grants.ts", "utf8");
  assert.match(grants, /if \(emp\.role === "accountant" && !emp\.operatorId\) return null;/);
  assert.match(grants, /if \(emp\.operatorId && emp\.operatorId !== HOST_SCOPE\) return emp\.operatorId;/);
});

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
      hasAdd ? createElement("button", null, "Add password login") : null,
      createElement("p", null, TENANT_USERS_EMPTY),
    );
  }
  const html = renderToString(createElement(Empty, { hasAdd: true }));
  assert.match(html, /Add password login/);
  assert.match(html, /No location admins or floor staff/);
  assert.doesNotMatch(html, new RegExp(TENANT_USERS_CIRCLE_COPY));

  const panel = readFileSync("src/components/platform/TenantUsersPanel.tsx", "utf8");
  assert.match(panel, /Add password login/);
  assert.match(panel, /Entity owner/);
  assert.match(panel, /Entity manager/);
  assert.match(panel, /Accountant/);
  assert.match(panel, /Entity admin \(one selling entity\)/);
  assert.match(panel, /The venue sets the scope/);
  assert.match(panel, /resolvePasswordAssignment/);
  assert.match(panel, /default state is entity|useState<TenantAdminScope>\("entity"\)/);
  assert.match(panel, /Add floor staff/);
  assert.match(panel, /Force password change on first login/);
  assert.match(panel, /never a PIN pad/);
  assert.match(panel, /app.summex.app\/login/);
  assert.match(panel, /Floor staff/);
  assert.match(panel, /data-demo="floor-pin"/);
  assert.match(panel, /Reset PIN/);
  assert.match(panel, /Replace this PIN/);
  assert.match(panel, /Password logins/);
  assert.match(panel, /Account passwords are never shown/);
  assert.match(panel, /Hide PINs/);
  assert.doesNotMatch(panel, /Add people on the platform/);
  assert.doesNotMatch(panel, /better-auth/i);
  assert.doesNotMatch(panel, /password_hash/);

  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /TenantUsersPanel/);
  assert.match(venue, /loginAsEntityAdmin/);
  assert.match(venue, /revenueBasis: "owned_lines"/);
  assert.doesNotMatch(venue, /Add people on the platform/);

  const dash = readFileSync("src/routes/dashboard.tsx", "utf8");
  assert.match(dash, /membershipRole=\{loc.role\}/);
  assert.match(dash, /loc.role === "accountant"/);
});

test("venue admin can view floor PINs; kitchen/server/bartender cannot", () => {
  assert.equal(canManageVenueUsers({ membershipRole: "owner" }), true);
  assert.equal(canManageVenueUsers({ membershipRole: "manager" }), true);
  assert.equal(canManageVenueUsers({ isPlatformAdmin: true }), true);
  assert.equal(canManageVenueUsers({ membershipRole: "owner", operatorId: "host" }), true);
  assert.equal(canManageVenueUsers({ membershipRole: "owner", operatorId: "op_bar" }), false);
  assert.equal(canManageVenueUsers({ membershipRole: "vendor" }), false);
  assert.equal(formatFloorPinForAdmin("2222", false), "2222");
  assert.equal(formatFloorPinForAdmin("2222", true), "••••");
  assert.equal(formatFloorPinForAdmin(null, false), "Reset to view");
  const pin = generateFloorPin(4);
  assert.match(pin, /^\d{4}$/);
  assert.notEqual(pin, "0000");
  const kitchen = PIN_VIEWS.kitchen;
  const server = PIN_VIEWS.server;
  const bartender = PIN_VIEWS.bartender;
  assert.equal(Array.isArray(kitchen) && kitchen.includes("employees"), false);
  assert.equal(Array.isArray(server) && server.includes("employees"), false);
  assert.equal(Array.isArray(bartender) && bartender.includes("employees"), false);
});

test("Devices tab still Add device with QR/code; Users does not pair", () => {
  const devices = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(devices, /Add device/);
  assert.match(devices, /pairQrImageSrc/);
  assert.match(devices, /Show QR/);
  const panel = readFileSync("src/components/platform/TenantUsersPanel.tsx", "utf8");
  assert.doesNotMatch(panel, /Scan QR/);
  assert.doesNotMatch(panel, /pairQrImageSrc/);
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /LocationDeviceRegistry/);
  assert.match(venue, /TenantUsersPanel/);
});

test("location owner and manager password dashboards include Users", () => {
  const dash = readFileSync("src/lib/saas/password-dash.ts", "utf8");
  const tabs = dash.slice(dash.indexOf("export function passwordDashTabs"));
  assert.match(tabs, /case "host_manager":\s*case "venue_manager":[\s\S]*\["people", "Users"\]/);
  assert.match(tabs, /case "venue_admin":[\s\S]*\["people", "Users"\]/);
  assert.match(tabs, /case "host_owner":[\s\S]*\["people", "Users"\]/);
});

test("guide Users topic covers PIN list, reset confirm, disable", () => {
  const roles = readFileSync("src/lib/guide/content/roles.ts", "utf8");
  assert.match(roles, /id: "venue-users"/);
  assert.match(roles, /Reset PIN asks before overwrite/);
  assert.match(roles, /Disable leaves the row visible/);
  assert.match(roles, /kitchen, server, bartender/i);
  assert.match(roles, /The venue sets the scope/);
  assert.match(roles, /does not gain the whole venue/);
  const server = readFileSync("src/lib/saas/tenant-users.server.ts", "utf8");
  assert.match(server, /resolvePasswordAssignment/);
  assert.match(server, /admin_scope/);
  const migration = readFileSync("migrations/0069_membership_admin_scope.sql", "utf8");
  assert.match(migration, /admin_scope/);
});
