import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors catalogSoftwareLines peer vs host labeling. */
function softwareLines({ peer, tenants, locN = 1 }) {
  const multiOpHostCents = 29900;
  const tenantCents = 4900;
  const items = [
    { id: "base", label: "Base counter + 1 ODS", qty: locN, totalCents: 0 },
  ];
  items.push({
    id: "multi_op",
    label: peer ? "Shared venue" : "Multi-operator / hall host",
    qty: locN,
    totalCents: multiOpHostCents * locN,
  });
  items.push({
    id: "tenants",
    label: peer ? "Venue entity" : "Tenant operator entity",
    qty: tenants,
    totalCents: tenantCents * tenants,
  });
  return items;
}

test("peer venue quote is shared venue + entities, not a third host operator", () => {
  const items = softwareLines({ peer: true, tenants: 2 });
  const multi = items.find((i) => i.id === "multi_op");
  const ents = items.find((i) => i.id === "tenants");
  assert.equal(multi.label, "Shared venue");
  assert.equal(ents.label, "Venue entity");
  assert.equal(ents.qty, 2);
  assert.equal(multi.totalCents + ents.totalCents, 29900 + 4900 * 2);
  assert.equal(items.filter((i) => /host operator/i.test(i.label)).length, 0);
});

test("host + tenants still prices host package plus tenants", () => {
  const items = softwareLines({ peer: false, tenants: 2 });
  assert.equal(items.find((i) => i.id === "multi_op").label, "Multi-operator / hall host");
  assert.equal(items.find((i) => i.id === "tenants").qty, 2);
});
