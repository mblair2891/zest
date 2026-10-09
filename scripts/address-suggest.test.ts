import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  applyAddressPick,
  suggestionsFromCensus,
  suggestionsFromNominatim,
  titlePlace,
} from "../src/lib/pos/address-suggest.ts";
import { commitPlaceText, livePlace, parseJurisdiction } from "../src/lib/pos/jurisdiction.ts";

test("city, name, and street keep the space on type and on save", () => {
  assert.equal(livePlace("Grants "), "Grants ");
  assert.equal(livePlace("Grants Pass"), "Grants Pass");
  assert.equal(parseJurisdiction({ city: "Grants " }).city, "Grants ");
  assert.equal(parseJurisdiction({ city: "Grants Pass" }).city, "Grants Pass");
  assert.equal(commitPlaceText("Grants Pass"), "Grants Pass");
  assert.equal(commitPlaceText("  Grants Pass  "), "Grants Pass");
  assert.equal(commitPlaceText("Blue Heron"), "Blue Heron");
  assert.equal(commitPlaceText("100 NE 6th St"), "100 NE 6th St");
  const saved = parseJurisdiction({
    city: commitPlaceText("Grants Pass"),
    state: "OR",
  });
  assert.equal(saved.city, "Grants Pass");
  assert.equal(saved.state, "OR");
});

test("a picked suggestion fills street, city, state, and timezone", () => {
  const census = suggestionsFromCensus({
    result: {
      addressMatches: [
        {
          tigerLine: { tigerLineId: "156572109" },
          addressComponents: {
            toAddress: "100",
            preDirection: "NE",
            streetName: "6TH",
            suffixType: "ST",
            city: "GRANTS PASS",
            state: "OR",
          },
        },
      ],
    },
  });
  assert.equal(census[0]?.city, "Grants Pass");
  assert.equal(census[0]?.state, "OR");
  assert.equal(census[0]?.street, "100 NE 6th St");
  assert.equal(census[0]?.timezone, "America/Los_Angeles");

  const nominatim = suggestionsFromNominatim([
    {
      place_id: 323619473,
      address: {
        road: "Northeast 6th Street",
        town: "Grants Pass",
        state: "Oregon",
        country_code: "us",
      },
    },
  ]);
  const picked = applyAddressPick(nominatim[0]!);
  assert.equal(picked.street, "Northeast 6th Street");
  assert.equal(picked.city, "Grants Pass");
  assert.equal(picked.state, "OR");
  assert.equal(picked.timezone, "America/Los_Angeles");
  assert.equal(titlePlace("GRANTS PASS"), "Grants Pass");
});

test("venue settings type the street and city without stripping spaces", () => {
  const panel = readFileSync("src/components/platform/VenueProfileSettings.tsx", "utf8");
  assert.match(panel, /data-venue-city/);
  assert.match(panel, /StreetSuggest/);
  assert.match(panel, /onChange=\{\(e\) => writeLocal\(\{ city: e\.target\.value \}\)\}/);
  assert.match(panel, /onChange=\{\(e\) => writeLocal\(\{ name: e\.target\.value \}\)\}/);
  assert.match(panel, /onChange=\{\(street\) => writeLocal\(\{ address: street \}\)\}/);
  assert.match(panel, /commitPlaceText/);
  assert.doesNotMatch(panel, /replace\([\s\S]*\\s/);

  const street = readFileSync("src/components/pos/StreetSuggest.tsx", "utf8");
  assert.match(street, /data-address-suggest/);
  assert.match(street, /data-address-suggestion/);
  assert.match(street, /onChange\(e\.target\.value\)/);
  assert.match(street, /onPick\(row\)/);

  const settings = readFileSync("src/components/pos/SettingsView.tsx", "utf8");
  assert.match(settings, /data-venue-city/);
  assert.match(settings, /StreetSuggest/);
  assert.match(settings, /persistVenueProfile/);

  const save = readFileSync("src/lib/saas/tenancy.server.ts", "utf8");
  const fn = save.slice(
    save.indexOf("export async function saveVenueProfileForUser"),
    save.indexOf("export async function listLocationsForOrg"),
  );
  assert.match(fn, /commitPlaceText\(input\.city\)/);
  assert.match(fn, /commitPlaceText\(input\.name\)/);
  assert.match(fn, /commitPlaceText\(input\.address\)/);
  assert.match(fn, /city,/);
});
