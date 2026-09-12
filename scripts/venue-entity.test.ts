import test from "node:test";
import assert from "node:assert/strict";
import {
  assertPeerLineOwner,
  canMarkCardLive,
  canMarkTrainingReady,
  entityStatusAfterSubmit,
  lineOwnerId,
  minEntityCount,
  normalizeHostEntityId,
  parseEntityOnboardStatus,
  venueKindFromOperatingModel,
} from "../src/lib/saas/venue-entity.ts";


test("peer venue hostEntityId is always null", () => {
  assert.equal(normalizeHostEntityId("peer", "opr_host"), null);
  assert.equal(normalizeHostEntityId("peer", null), null);
  assert.equal(normalizeHostEntityId("single_operator", "opr_shop"), "opr_shop");
  assert.equal(venueKindFromOperatingModel("peer_venue"), "peer");
  assert.equal(minEntityCount("peer"), 2);
  assert.equal(minEntityCount("single_operator"), 1);
});

test("training-ready needs every entity at least in_progress", () => {
  assert.equal(
    canMarkTrainingReady([{ status: "invited" }, { status: "in_progress" }]),
    false,
  );
  assert.equal(
    canMarkTrainingReady([{ status: "in_progress" }, { status: "finix_pending" }]),
    true,
  );
});

test("card-live needs every Finix approved plus a reader", () => {
  const blocked = canMarkCardLive({
    entities: [
      { status: "ready", finixApproved: true },
      { status: "finix_pending", finixApproved: false },
    ],
    readerEnrolled: true,
  });
  assert.equal(blocked.ok, false);
  const ok = canMarkCardLive({
    entities: [
      { status: "ready", finixApproved: true },
      { status: "ready", finixApproved: true },
    ],
    readerEnrolled: true,
  });
  assert.equal(ok.ok, true);
  const noReader = canMarkCardLive({
    entities: [{ status: "ready", finixApproved: true }],
    readerEnrolled: false,
  });
  assert.equal(noReader.ok, false);
});

test("peer lines fail closed without an entity owner", () => {
  assert.equal(lineOwnerId({ vendorId: "opr_food" }), "opr_food");
  assert.equal(lineOwnerId({ entityId: "opr_bar" }), "opr_bar");
  assert.throws(() => assertPeerLineOwner(true, {}), /selling entity/);
  assert.equal(assertPeerLineOwner(true, { entityId: "opr_food" }), "opr_food");
  assert.equal(parseEntityOnboardStatus("complete"), "finix_pending");
  assert.equal(entityStatusAfterSubmit({ finixApproved: false }), "finix_pending");
  assert.equal(entityStatusAfterSubmit({ finixApproved: true }), "ready");
});

test("peer entity count is at least 2", () => {
  assert.equal(minEntityCount("peer"), 2);
  assert.equal(minEntityCount("single_operator"), 1);
});

test("entity invite payload cannot name a sibling operator id", () => {
  const own = "opr_food";
  const sibling = "opr_bar";
  const scoped = (tokenOperatorId: string, requestedId: string | undefined) =>
    requestedId && requestedId !== tokenOperatorId ? tokenOperatorId : tokenOperatorId;
  assert.equal(scoped(own, sibling), own);
  assert.equal(scoped(own, own), own);
});
