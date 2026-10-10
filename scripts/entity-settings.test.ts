import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ENTITY_FIELD_PLACEHOLDERS,
  ENTITY_TIP_PLACEHOLDERS,
  canEditEntitySettings,
  locationContactMayEditEntity,
  parsePinLength,
  parseTipPercents,
  readTipPercents,
  tipPercentFields,
} from "../src/lib/saas/entity-settings.ts";

test("entity admin edits own entity; another entity does not; location contact and platform do", () => {
  assert.equal(
    canEditEntitySettings({
      targetOperatorId: "opr_steam_distillery",
      actorOperatorId: "opr_steam_distillery",
      locationContact: false,
      platformAdmin: false,
    }),
    true,
  );
  assert.equal(
    canEditEntitySettings({
      targetOperatorId: "opr_steam_distillery",
      actorOperatorId: "opr_diamond_house",
      locationContact: false,
      platformAdmin: false,
    }),
    false,
  );
  assert.equal(
    canEditEntitySettings({
      targetOperatorId: "opr_steam_distillery",
      actorOperatorId: "opr_diamond_house",
      locationContact: true,
      platformAdmin: false,
    }),
    true,
  );
  assert.equal(
    canEditEntitySettings({
      targetOperatorId: "opr_steam_distillery",
      actorOperatorId: null,
      locationContact: false,
      platformAdmin: true,
    }),
    true,
  );
  assert.equal(
    canEditEntitySettings({
      targetOperatorId: "  ",
      actorOperatorId: "opr_steam_distillery",
      locationContact: true,
      platformAdmin: true,
    }),
    false,
  );
});

test("house owner overrides; a named contact email does; another entity admin does not", () => {
  assert.equal(
    locationContactMayEditEntity({
      email: "owner@venue.test",
      contactEmail: "ada@venue.test",
      checklistEmail: "",
      role: "owner",
      operatorId: null,
    }),
    true,
  );
  assert.equal(
    locationContactMayEditEntity({
      email: "Ada@Venue.test",
      contactEmail: "",
      checklistEmail: "ada@venue.test",
      role: "vendor",
      operatorId: "opr_steam_distillery",
    }),
    true,
  );
  assert.equal(
    locationContactMayEditEntity({
      email: "steam@venue.test",
      contactEmail: "ada@venue.test",
      checklistEmail: "",
      role: "vendor",
      operatorId: "opr_steam_distillery",
    }),
    false,
  );
  assert.equal(
    locationContactMayEditEntity({
      email: "",
      contactEmail: "",
      checklistEmail: "",
      role: "vendor",
      operatorId: "opr_steam_distillery",
    }),
    false,
  );
});

test("empty tip and pin fields stay empty; bad percents are refused", () => {
  assert.deepEqual(parseTipPercents(["", "18", null, "20"]), [18, 20]);
  assert.deepEqual(readTipPercents(null), []);
  assert.deepEqual(tipPercentFields([]), ["", "", "", ""]);
  assert.equal(parsePinLength(""), null);
  assert.equal(parsePinLength("5"), 5);
  assert.equal(parsePinLength(7), null);
  assert.equal(ENTITY_TIP_PLACEHOLDERS[0], "15");
  assert.equal(ENTITY_FIELD_PLACEHOLDERS.legalName, "Legal name");
  assert.throws(() => parseTipPercents(["150"]), /0 to 100/);
});

test("entity settings form is entity-owned and the save does not write the venue", () => {
  const panel = readFileSync("src/components/platform/EntityOwnedSettings.tsx", "utf8");
  assert.match(panel, /data-entity-legal/);
  assert.match(panel, /data-entity-dba/);
  assert.match(panel, /data-entity-logo/);
  assert.match(panel, /data-entity-menu-name/);
  assert.match(panel, /data-entity-pin-length/);
  assert.match(panel, /data-entity-tips/);
  assert.match(panel, /placeholder=\{ENTITY_FIELD_PLACEHOLDERS\.legalName\}/);
  assert.match(panel, /placeholder=\{ENTITY_TIP_PLACEHOLDERS\[i\]\}/);
  assert.match(panel, /ENTITY_FIELD_PLACEHOLDERS\.pinLength/);
  assert.match(panel, /saveEntitySettingsFn/);
  assert.doesNotMatch(panel, /updateSettings/);
  assert.doesNotMatch(panel, /Quantum Payments|taxRate|cash discount|EIN|bank account/);

  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.match(
    venue,
    /tab === "settings"[\s\S]{0,220}isEntityPasswordKind\(kind\)[\s\S]{0,400}EntityOwnedSettings/,
  );

  const server = readFileSync("src/lib/saas/entity-settings.server.ts", "utf8");
  const save = server.slice(server.indexOf("export async function saveEntitySettingsForUser"));
  assert.match(save, /update operators/);
  assert.match(save, /legal_name =/);
  assert.match(save, /menu_display_name =/);
  assert.match(save, /pin_length =/);
  assert.doesNotMatch(save, /update locations/);
  assert.doesNotMatch(save, /taxRate|paymentsMode/);
});
