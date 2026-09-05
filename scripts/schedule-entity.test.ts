import test from "node:test";
import assert from "node:assert/strict";
import {
  canPlaceEmployeeOnEntityBoard,
  defaultScheduleEntity,
  hoursEntityForPunch,
  publishWeekShifts,
  scheduleEntityIds,
} from "../src/lib/labor/schedule-entity.ts";

test("peer venue defaults to first operator, not a host merchant", () => {
  assert.equal(
    defaultScheduleEntity({
      managerOperatorId: null,
      peerVenue: true,
      vendorIds: ["opr_diamond_house", "opr_steam_distillery"],
    }),
    "opr_diamond_house",
  );
  assert.equal(
    defaultScheduleEntity({
      managerOperatorId: "opr_steam_distillery",
      peerVenue: true,
      vendorIds: ["opr_diamond_house", "opr_steam_distillery"],
    }),
    "opr_steam_distillery",
  );
  assert.deepEqual(
    scheduleEntityIds({
      peerVenue: true,
      vendorIds: ["opr_diamond_house", "opr_steam_distillery"],
    }),
    ["opr_diamond_house", "opr_steam_distillery"],
  );
});

test("cannot place Steam staff on Diamond without a grant", () => {
  assert.equal(
    canPlaceEmployeeOnEntityBoard({
      homeOperatorId: "opr_steam_distillery",
      boardOperatorId: "opr_diamond_house",
      employeeId: "emp_steam",
      grants: [],
    }),
    false,
  );
  assert.equal(
    canPlaceEmployeeOnEntityBoard({
      homeOperatorId: "opr_steam_distillery",
      boardOperatorId: "opr_diamond_house",
      employeeId: "emp_steam",
      grants: [{ employeeId: "emp_steam", workOperatorId: "opr_diamond_house" }],
    }),
    true,
  );
  assert.equal(
    canPlaceEmployeeOnEntityBoard({
      homeOperatorId: "opr_diamond_house",
      boardOperatorId: "opr_diamond_house",
      employeeId: "emp_dia",
      grants: [],
    }),
    true,
  );
});

test("hours post to the shift entity, else home", () => {
  assert.equal(
    hoursEntityForPunch({ shiftOperatorId: "opr_diamond_house", homeOperatorId: "opr_steam_distillery" }),
    "opr_diamond_house",
  );
  assert.equal(hoursEntityForPunch({ homeOperatorId: "opr_steam_distillery" }), "opr_steam_distillery");
});

test("publish week does not merge the other calendar", () => {
  const week = 1_000;
  const rows = [
    { start: week + 1, operatorId: "opr_diamond_house", published: false },
    { start: week + 1, operatorId: "opr_steam_distillery", published: false },
  ];
  const next = publishWeekShifts(rows, week, week + 10, "opr_diamond_house");
  assert.equal(next[0]?.published, true);
  assert.equal(next[1]?.published, false);
});
