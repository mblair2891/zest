import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyProfileToLayer,
  parseLayeredOnboarding,
  seedLayeredOnboarding,
  tasksOnSameScreen,
} from "../src/lib/saas/onboarding-checklist.ts";

test("location profile save marks contact, address, and timezone together", () => {
  assert.deepEqual(tasksOnSameScreen("location", "address"), ["contact", "address", "timezone"]);
  const layer = seedLayeredOnboarding({ peer: true, entities: [{ id: "a", name: "Hearth" }] });
  const saved = applyProfileToLayer(
    layer,
    { contact: true, address: true, timezone: true },
    { name: "Ada", email: "ada@hall.test", phone: "555-0100" },
  );
  for (const id of ["contact", "address", "timezone"]) {
    assert.equal(saved.location.items.find((i) => i.id === id)?.status, "done");
  }
  assert.equal(saved.location.contactEmail, "ada@hall.test");
  assert.equal(saved.entities[0]?.items.find((i) => i.id === "menu")?.status, "not_started");

  const partial = applyProfileToLayer(saved, { contact: false, address: true, timezone: true });
  assert.equal(partial.location.items.find((i) => i.id === "contact")?.status, "in_progress");
  assert.equal(partial.location.items.find((i) => i.id === "address")?.status, "done");

  const reloaded = parseLayeredOnboarding(JSON.parse(JSON.stringify(saved)));
  assert.equal(reloaded?.location.items.find((i) => i.id === "timezone")?.status, "done");
  assert.equal(reloaded?.location.items.find((i) => i.id === "contact")?.status, "done");

  const panel = readFileSync("src/components/platform/VenueOnboardingPanel.tsx", "utf8");
  assert.match(panel, /useOnboardingStore/);
  assert.match(panel, /hydrated/);
  const profile = readFileSync("src/components/platform/VenueHouseSettings.tsx", "utf8");
  assert.match(profile, /data-checklist-profile-save/);
  assert.match(profile, /saveLocationProfileChecklist/);
});
