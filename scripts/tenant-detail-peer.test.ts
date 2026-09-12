import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  buildTenantDetailModel,
  hostMerchantName,
} from "../src/lib/saas/tenant-detail.ts";
import { tenantConsoleTabs } from "../src/lib/saas/venue-dashboard-tabs.ts";

function Overview({
  venueName,
  host,
  entities,
}: {
  venueName: string;
  host: { name: string; merchant: boolean } | null;
  entities: { id: string; name: string }[];
}) {
  const hostLabel = hostMerchantName(host);
  return createElement(
    "div",
    { "data-demo": "platform-tenant-overview" },
    createElement("h1", null, venueName),
    createElement(
      "p",
      null,
      hostLabel ? `Host merchant · ${hostLabel}` : "Shared venue — no host merchant",
    ),
    ...entities.map((e) => createElement("li", { key: e.id }, e.name)),
  );
}

test("peer_venue with no host does not throw when reading host", () => {
  const model = buildTenantDetailModel({
    venueName: "Shared Building",
    operatingModel: "peer_venue",
    peerVenue: true,
    hostEntityId: null,
    operators: [
      { id: "opr_food", dba: "Food operator" },
      { id: "opr_bar", dba: "Bar operator" },
    ],
  });
  assert.equal(model.host, null);
  assert.equal(model.hostEntityId, null);
  assert.equal(hostMerchantName(model.host), null);
  assert.deepEqual(
    model.entities.map((e) => e.name),
    ["Food operator", "Bar operator"],
  );
  const html = renderToString(
    createElement(Overview, {
      venueName: model.venueName,
      host: model.host,
      entities: model.entities,
    }),
  );
  assert.match(html, /Shared Building/);
  assert.match(html, /Food operator/);
  assert.match(html, /Bar operator/);
  assert.match(html, /no host merchant/);
  assert.doesNotMatch(html, /Host merchant/);
});

test("tenant console tabs never include CRM or pipeline", () => {
  const ids = tenantConsoleTabs().map(([id]) => id);
  assert.ok(ids.includes("devices"));
  assert.ok(ids.includes("people"));
  assert.ok(!ids.includes("crm" as never));
});

test("host_operators still exposes a host merchant", () => {
  const model = buildTenantDetailModel({
    venueName: "Hall",
    operatingModel: "host_operators",
    operators: [{ id: "op1", dba: "Stall A" }],
  });
  assert.equal(model.host?.merchant, true);
  assert.equal(hostMerchantName(model.host), "Hall");
});
