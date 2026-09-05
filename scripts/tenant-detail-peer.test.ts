import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  buildTenantDetailModel,
  hostMerchantName,
} from "../src/lib/saas/tenant-detail.ts";

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
    venueName: "The Laundry",
    operatingModel: "peer_venue",
    peerVenue: true,
    operators: [
      { id: "opr_diamond_house", dba: "Diamond House BBQ" },
      { id: "opr_steam_distillery", dba: "Steam Distillery" },
    ],
  });
  assert.equal(model.host, null);
  assert.equal(hostMerchantName(model.host), null);
  assert.deepEqual(
    model.entities.map((e) => e.name),
    ["Diamond House BBQ", "Steam Distillery"],
  );
  const html = renderToString(
    createElement(Overview, {
      venueName: model.venueName,
      host: model.host,
      entities: model.entities,
    }),
  );
  assert.match(html, /The Laundry/);
  assert.match(html, /Diamond House BBQ/);
  assert.match(html, /Steam Distillery/);
  assert.match(html, /no host merchant/);
  assert.doesNotMatch(html, /Host merchant/);
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
