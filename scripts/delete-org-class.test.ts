import test from "node:test";
import assert from "node:assert/strict";
import { classifyCrmDelete } from "../src/lib/saas/delete-org.ts";

test("quote-not-accepted is a lead", () => {
  assert.equal(classifyCrmDelete({ prospectStatus: "prospect" }), "lead");
  assert.equal(classifyCrmDelete({ prospectStatus: "quoted" }), "lead");
  assert.equal(classifyCrmDelete({ prospectStatus: "rejected" }), "lead");
  assert.equal(classifyCrmDelete({ prospectStatus: "accepted" }), "lead");
  assert.equal(classifyCrmDelete({ crmStage: "lead" }), "lead");
  assert.equal(classifyCrmDelete({ crmStage: "qualified" }), "lead");
  assert.equal(classifyCrmDelete({ crmStage: "proposal" }), "lead");
  assert.equal(classifyCrmDelete({ crmStage: "contract" }), "lead");
});

test("onboarding / training venue is training", () => {
  assert.equal(classifyCrmDelete({ prospectStatus: "onboarding" }), "training");
  assert.equal(classifyCrmDelete({ crmStage: "onboarding" }), "training");
  assert.equal(
    classifyCrmDelete({ orgId: "org_the_laundry", locationCount: 2, locationLifecycles: ["training"] }),
    "training",
  );
  assert.equal(
    classifyCrmDelete({
      prospectStatus: "contracted",
      orgId: "org_x",
      locationCount: 1,
      locationLifecycles: ["scheduled_live"],
    }),
    "training",
  );
});

test("live tenant is live", () => {
  assert.equal(classifyCrmDelete({ prospectStatus: "live" }), "live");
  assert.equal(
    classifyCrmDelete({ orgId: "org_x", locationCount: 1, locationLifecycles: ["live"] }),
    "live",
  );
});
