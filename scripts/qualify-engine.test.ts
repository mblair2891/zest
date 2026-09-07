import test from "node:test";
import assert from "node:assert/strict";
import {
  applyChip,
  applyUserText,
  buildAssumptions,
  isReadyToQuote,
  openingTurn,
  qualifyPhase,
  sessionToIntake,
} from "../src/lib/saas/qualify-engine.ts";
import { quoteFromQualifySession } from "../src/lib/saas/qualify-quote.ts";
import { emptyQualifySession } from "../src/lib/saas/qualify-session.ts";

test("single location with 2 entities triggers follow-ups, not a quote", () => {
  const turn = applyUserText(emptyQualifySession(), "single location with 2 entities");
  assert.equal(turn.session.facts.locationCount, 1);
  assert.equal(turn.session.facts.entityCount, 2);
  assert.equal(turn.readyToQuote, false);
  assert.equal(turn.session.showQuote, false);
  assert.match(turn.assistant, /two concepts|same building|tills and reporting/i);
  assert.ok(turn.chips.some((c) => c.id === "rel_concepts"));
  assert.ok(turn.chips.some((c) => c.id === "tills_separate"));
  assert.equal(qualifyPhase(turn.session), "location");
});

test("we're a bar triggers wells + host/kiosk questions", () => {
  const turn = applyUserText(emptyQualifySession(), "we're a bar");
  assert.equal(turn.session.facts.locationCount, 1);
  assert.equal(turn.session.entities[0]?.venueType, "bar_lounge");
  assert.equal(turn.session.entities[0]?.wells, null);
  assert.equal(turn.readyToQuote, false);
  assert.match(turn.assistant, /wells/i);
  assert.match(turn.assistant, /hostess stand|kiosk/i);
  assert.ok(turn.chips.some((c) => c.id.startsWith("wells_")));
  assert.ok(turn.chips.some((c) => c.id.startsWith("front_")));
});

test("quote line items and assumptions match extracted facts", () => {
  let s = emptyQualifySession();
  s = applyUserText(s, "single location with 2 entities").session;
  s = applyChip(s, { id: "rel_concepts", label: "Two concepts, one building" }).session;
  s = applyChip(s, { id: "tills_separate", label: "Own tills each" }).session;
  s = applyChip(s, { id: "type_bar:ent_1", label: "Bar / nightclub" }).session;
  s = applyChip(s, { id: "wells_2:ent_1", label: "2 wells" }).session;
  s = applyChip(s, { id: "front_host:ent_1", label: "Hostess / host stand" }).session;
  s = applyChip(s, { id: "drawers_yes:ent_1", label: "Yes, cash drawers" }).session;
  s = applyChip(s, { id: "type_restaurant:ent_2", label: "Restaurant" }).session;
  s = applyChip(s, { id: "service_tables:ent_2", label: "Tables" }).session;
  s = applyChip(s, { id: "front_kiosk:ent_2", label: "Kiosk" }).session;
  s = applyChip(s, { id: "kds_1:ent_2", label: "1 display / printer" }).session;
  s = applyChip(s, { id: "bar_no:ent_2", label: "No bar" }).session;
  s = applyChip(s, { id: "drawers_yes:ent_2", label: "Yes, cash drawers" }).session;
  s = applyChip(s, { id: "golive_30", label: "About 30 days" }).session;
  assert.equal(isReadyToQuote(s), true);
  const bar = s.entities.find((e) => e.venueType === "bar_lounge");
  const rest = s.entities.find((e) => e.venueType === "restaurant");
  assert.equal(bar?.wells, 2);
  assert.equal(bar?.hostStands, 1);
  assert.equal(rest?.kiosks, 1);
  assert.equal(rest?.kitchenDisplays, 1);
  const assumptions = buildAssumptions(s);
  assert.ok(assumptions.some((a) => /2 wells/i.test(a) && /host stand/i.test(a)));
  assert.ok(assumptions.some((a) => /kiosk/i.test(a)));
  const quote = quoteFromQualifySession(s);
  const intake = sessionToIntake(s);
  assert.equal(intake.volume.orderStations, 2);
  assert.equal(intake.volume.kioskCount, 1);
  assert.equal(intake.volume.odsStations, 1);
  assert.equal(intake.operating.hostStand, true);
  assert.ok(quote.lineItems.some((i) => i.id === "kiosk" && i.qty === 1));
  assert.ok(quote.assumptions.some((a) => /2 wells/i.test(a)));
  assert.ok(quote.monthlyCents >= 0);
});

test("opening is a chat, not a form dump", () => {
  const open = openingTurn();
  assert.equal(open.session.messages.length, 1);
  assert.equal(open.session.messages[0]?.role, "assistant");
  assert.ok(open.chips.length <= 6);
});
