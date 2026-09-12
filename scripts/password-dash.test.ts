import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  filterPasswordDashTiles,
  passwordDashKind,
  passwordDashTabs,
  passwordDashTiles,
} from "../src/lib/saas/password-dash.ts";

test("password kinds: platform, host, peer, entity owner/manager, accountant", () => {
  assert.equal(passwordDashKind({ isPlatformAdmin: true }), "platform_admin");
  assert.equal(
    passwordDashKind({ role: "owner", operatingModel: "host_operators" }),
    "host_owner",
  );
  assert.equal(
    passwordDashKind({ role: "manager", operatingModel: "host_operators" }),
    "host_manager",
  );
  assert.equal(
    passwordDashKind({ role: "owner", operatingModel: "peer_venue", peerVenue: true }),
    "venue_admin",
  );
  assert.equal(
    passwordDashKind({ role: "vendor", operatorId: "op_bar" }),
    "entity_owner",
  );
  assert.equal(
    passwordDashKind({ role: "manager", operatorId: "op_bar" }),
    "entity_manager",
  );
  assert.equal(passwordDashKind({ role: "accountant" }), "accountant");
});

test("host owner tiles include Devices, Publish, reports; peer has no grants chrome", () => {
  const host = passwordDashTiles("host_owner").map((t) => t.id);
  for (const id of ["health", "entities", "devices", "publish", "reports", "grants"]) {
    assert.ok(host.includes(id), `host missing ${id}`);
  }
  const peer = passwordDashTiles("venue_admin").map((t) => t.id);
  assert.ok(peer.includes("devices"));
  assert.ok(peer.includes("reports"));
  assert.ok(!peer.includes("grants"));
});

test("entity owner has payments, manager has floor, accountant has no Devices or 86", () => {
  const owner = passwordDashTiles("entity_owner").map((t) => t.id);
  const mgr = passwordDashTiles("entity_manager").map((t) => t.id);
  const acc = passwordDashTiles("accountant").map((t) => t.id);
  assert.ok(owner.includes("payments"));
  assert.ok(!owner.includes("floor"));
  assert.ok(mgr.includes("floor"));
  assert.ok(!mgr.includes("payments"));
  assert.ok(acc.includes("gift"));
  assert.ok(acc.includes("reports"));
  assert.ok(!acc.includes("devices"));
  assert.ok(!acc.includes("86"));
  assert.ok(!passwordDashTabs("accountant").some(([id]) => id === "devices"));
});

test("tiles hide unsubscribed modules", () => {
  const tiles = passwordDashTiles("host_owner");
  const filtered = filterPasswordDashTiles(tiles, ["pos_core", "menu_admin"]);
  const ids = filtered.map((t) => t.id);
  assert.ok(ids.includes("devices"));
  assert.ok(ids.includes("menu"));
  assert.ok(!ids.includes("labor"));
});

test("password dashboards never land on the PIN pad", () => {
  const dest = readFileSync("src/lib/auth/post-login-dest.ts", "utf8");
  assert.match(dest, /Never the staff PIN pad/);
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(venue, /pinGate: false/);
  assert.match(venue, /PasswordDashHome/);
  assert.match(venue, /loginAsBackOffice/);
});
