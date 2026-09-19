import test from "node:test";
import assert from "node:assert/strict";
import {
  formatVenueTime,
  guessTimezoneFromAddress,
  parseVenueTimezone,
  venueClockParts,
} from "../src/lib/pos/venue-time.ts";

test("parseVenueTimezone rejects junk", () => {
  assert.equal(parseVenueTimezone("America/New_York"), "America/New_York");
  assert.equal(parseVenueTimezone("not-a-zone"), "America/Los_Angeles");
});

test("guess from address", () => {
  assert.equal(guessTimezoneFromAddress("42 Pier Avenue, Seaport District, NY 10004"), "America/New_York");
  assert.equal(guessTimezoneFromAddress("Los Angeles, CA"), "America/Los_Angeles");
  assert.equal(guessTimezoneFromAddress("Phoenix, AZ"), "America/Phoenix");
});

test("formatVenueTime is venue zone not UTC", () => {
  const ts = Date.UTC(2026, 5, 15, 16, 30, 0);
  const ny = formatVenueTime(ts, "America/New_York");
  const utc = formatVenueTime(ts, "UTC");
  assert.notEqual(ny, utc);
  const parts = venueClockParts(ts, "America/New_York");
  assert.equal(parts.hour, 12);
  assert.equal(parts.minute, 30);
});

test("Pacific afternoon is AM/PM in America/Los_Angeles never UTC", () => {
  const ts = Date.UTC(2026, 8, 19, 21, 30, 0);
  const pacific = formatVenueTime(ts, "America/Los_Angeles");
  const utc = formatVenueTime(ts, "UTC");
  assert.equal(pacific, "2:30 PM");
  assert.equal(utc, "9:30 PM");
  assert.match(pacific, /PM/);
  assert.doesNotMatch(pacific, /[^ -~]/);
});
