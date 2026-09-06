import assert from "node:assert/strict";
import test from "node:test";
import {
  heuristicInterviewTurn,
  heuristicRecommendation,
  inferNarrativeFacts,
  normalizeInterviewTurn,
  overlayNarrativeModel,
} from "../src/lib/saas/interview-narrative.ts";
import {
  catalogSoftwareLines,
  DEFAULT_QUOTE_CATALOG,
  tenantEntityCount,
} from "../src/lib/saas/quote-catalog.ts";
import type { IntakeAnswers, InterviewRecommendation } from "../src/lib/saas/prospect-types.ts";

const STEAM =
  "single location, two entities, Steam Distillery bar + Diamond House BBQ kitchen.";

function recFrom(text: string): InterviewRecommendation {
  return heuristicRecommendation(text.toLowerCase(), text);
}

function softwareMonthly(answers: IntakeAnswers): { ids: string[]; cents: number } {
  const items = catalogSoftwareLines(answers, DEFAULT_QUOTE_CATALOG, 1, "food_hall");
  const software = items.filter((i) => !i.oneTime);
  return {
    ids: software.map((i) => i.id),
    cents: software.reduce((s, i) => s + i.totalCents, 0),
  };
}

function answersFromRec(rec: InterviewRecommendation): IntakeAnswers {
  const peer = rec.operatingModel === "peer_venue";
  const host = rec.operatingModel === "host_multi_operator";
  const typeCounts: IntakeAnswers["portfolio"]["typeCounts"] = {};
  for (const t of rec.venueTypes) typeCounts[t] = rec.estimates.locations;
  const has = (id: InterviewRecommendation["modules"][number]) => rec.modules.includes(id);
  return {
    company: {
      legalName: "",
      dba: "",
      billingEmail: "",
      phone: "",
      hqAddress: "",
      taxId: "",
    },
    portfolio: {
      locationsNow: rec.estimates.locations,
      locations12mo: rec.estimates.locations,
      typeCounts,
    },
    operating: {
      model: peer ? "peer_venue" : host ? "host_operators" : "single",
      operatorsPerLocation: peer || host ? Math.max(2, rec.estimates.operators) : 1,
      guestPaysHostCheck: peer || host,
      barKitchenSplit: true,
      hostStand: peer || host || has("tableService"),
    },
    modules: {
      tableService: has("tableService"),
      counterQsr: has("counterQsr"),
      kiosk: has("kiosk"),
      online: has("online"),
      kds: has("kds"),
      inventory: has("inventory"),
      labor: has("labor"),
      giftCards: has("giftCards"),
      crm: has("crm"),
      marketing: has("marketing"),
      vendorPortal: has("vendorPortal"),
      multiLocationReporting: has("multiLocationReporting"),
    },
    volume: {
      volumeKind: "gmv",
      monthlyChecks: 2000,
      gmvBand: "50_150k",
      peakDevices: rec.estimates.devices,
      staffSeats: rec.estimates.seats,
      orderStations: Math.max(1, Math.ceil(rec.estimates.devices / 2)),
      odsStations: has("kds") ? 1 : 0,
      kioskCount: has("kiosk") ? 1 : 0,
      terminalNeed: "none",
    },
    hardware: {
      ownsTabletsPrintersDrawers: true,
      shipReaders: true,
      readerQty: 1,
      readerPay: "purchase",
      shipPartnerDevices: false,
      partnerSkuQty: {},
    },
    payments: {
      quantumPaymentsAck: false,
      tips: true,
      splitTenders: true,
      roomCharge: false,
      payoutFrequency: "weekly",
    },
    timeline: { goLiveDate: "", notes: "" },
  };
}

test("Steam Distillery + Diamond House BBQ → shared venue peers, two entities", () => {
  const facts = inferNarrativeFacts(STEAM.toLowerCase());
  assert.equal(facts.peerLikely, true);
  assert.equal(facts.hostCompanyLikely, false);
  assert.equal(facts.operatorCount, 2);
  assert.equal(facts.locCount, 1);
  assert.equal(facts.fullServiceFloor, false);

  const rec = recFrom(STEAM);
  assert.equal(rec.operatingModel, "peer_venue");
  assert.equal(rec.pricingHints.suggestedPlan, "food_hall");
  assert.deepEqual(rec.venueTypes, ["food_hall"]);
  assert.equal(rec.estimates.operators, 2);
  assert.equal(rec.estimates.locations, 1);
  assert.equal(rec.modules.includes("tableService"), false);
  assert.equal(rec.modules.includes("vendorPortal"), true);

  const turn = heuristicInterviewTurn({ freeText: STEAM, messages: [] });
  assert.equal(turn.type, "recommendation");
  if (turn.type === "recommendation") {
    assert.equal(turn.recommendation.operatingModel, "peer_venue");
  }
});

test("single location is not single operator", () => {
  const rec = recFrom(STEAM);
  assert.notEqual(rec.operatingModel, "single_operator");
  assert.notEqual(rec.operatingModel, "host_multi_operator");
});

test("AI single-operator draft is overlaid to peer venue", () => {
  const corpus = STEAM.toLowerCase();
  const ai: InterviewRecommendation = {
    summary: "One restaurant",
    operatingModel: "single_operator",
    venueTypes: ["restaurant", "bar_lounge"],
    modules: ["tableService", "kds"],
    estimates: { locations: 1, operators: 1, seats: 40, devices: 6 },
    rationale: ["Single house"],
    pricingHints: { suggestedPlan: "full_service", notes: "" },
  };
  const over = overlayNarrativeModel(ai, corpus, STEAM);
  assert.equal(over.operatingModel, "peer_venue");
  assert.equal(over.estimates.operators, 2);
  assert.equal(over.pricingHints.suggestedPlan, "food_hall");
  assert.deepEqual(over.venueTypes, ["food_hall"]);
  assert.equal(over.modules.includes("tableService"), false);
});

test("AI canned follow-ups are dropped when the two-entity story is complete", () => {
  const turn = normalizeInterviewTurn(
    {
      type: "questions",
      source: "ai",
      questions: [
        { id: "model", prompt: "Single operator, host, or shared venue?" },
        { id: "tenants", prompt: "How many tenants?" },
        { id: "wells", prompt: "How many bar wells?" },
      ],
      draftRecommendation: {
        summary: STEAM,
        operatingModel: "single_operator",
        venueTypes: ["restaurant"],
        modules: ["kds"],
        estimates: { locations: 1, operators: 1, seats: 12, devices: 4 },
        rationale: [],
        pricingHints: { suggestedPlan: "starter", notes: "" },
      },
    },
    { freeText: STEAM, messages: [] },
  );
  assert.equal(turn.type, "recommendation");
  if (turn.type === "recommendation") {
    assert.equal(turn.recommendation.operatingModel, "peer_venue");
    assert.equal(turn.recommendation.estimates.operators, 2);
  }
});

test("peer quote is shared venue $299 + $49 × 2, not full service unless dining was said", () => {
  const rec = recFrom(STEAM);
  const answers = answersFromRec(rec);
  assert.equal(answers.operating.model, "peer_venue");
  assert.equal(tenantEntityCount(answers), 2);
  const q = softwareMonthly(answers);
  assert.ok(q.ids.includes("multi_op"));
  assert.ok(q.ids.includes("tenants"));
  assert.equal(q.ids.includes("full_service"), false);
  assert.equal(q.cents, 29900 + 4900 * 2);
});

test("full bar + dining + seats stacks full service on the peer package", () => {
  const text =
    "single location, two entities, Steam Distillery bar + Diamond House BBQ kitchen, 40 seats, full bar and dining.";
  const rec = recFrom(text);
  assert.equal(rec.operatingModel, "peer_venue");
  assert.equal(rec.modules.includes("tableService"), true);
  const q = softwareMonthly(answersFromRec(rec));
  assert.ok(q.ids.includes("multi_op"));
  assert.ok(q.ids.includes("full_service"));
  assert.equal(q.cents, 29900 + 4900 * 2 + 14900);
});

test("a single restaurant with a bar and a kitchen is not a peer venue", () => {
  const text = "We have a bar and a kitchen, 40 seats, one team.";
  const facts = inferNarrativeFacts(text.toLowerCase());
  assert.equal(facts.peerLikely, false);
  assert.equal(recFrom(text).operatingModel, "single_operator");
});

test("landlord / host company language stays host + tenants", () => {
  const text = "We are the host company with two tenants in our food hall. Tenants pay us.";
  const rec = recFrom(text);
  assert.equal(rec.operatingModel, "host_multi_operator");
});

test("food hall two kitchens → tenant/card gaps, not wells", () => {
  const turn = heuristicInterviewTurn({
    freeText: "We run a food hall with two kitchens",
    messages: [],
  });
  assert.equal(turn.type, "questions");
  if (turn.type === "questions") {
    const ids = turn.questions.map((q) => q.id);
    assert.ok(ids.includes("tenants"));
    assert.ok(ids.includes("one_check"));
    assert.equal(ids.includes("wells"), false);
    assert.equal(turn.draftRecommendation?.operatingModel, "host_multi_operator");
  }
});

test("coffee counter one iPad → not host stand, wells, or tip pools", () => {
  const turn = heuristicInterviewTurn({
    freeText: "Coffee counter, one iPad, we are a cafe",
    messages: [],
  });
  assert.equal(turn.type, "questions");
  if (turn.type === "questions") {
    const ids = turn.questions.map((q) => q.id);
    assert.equal(ids.some((id) => ["wells", "host_stand", "tip_pools", "sections"].includes(id)), false);
  }
  const rec = recFrom("Coffee counter, one iPad, we are a cafe");
  assert.equal(rec.operatingModel, "single_operator");
});

test("80 seats, servers, no bar → skip wells; ask sections/reservations/cash", () => {
  const turn = heuristicInterviewTurn({
    freeText: "80 seats, servers, no bar",
    messages: [],
  });
  assert.equal(turn.type, "questions");
  if (turn.type === "questions") {
    const ids = turn.questions.map((q) => q.id);
    assert.equal(ids.includes("wells"), false);
    assert.ok(ids.includes("sections"));
    assert.ok(ids.includes("reservations"));
    assert.ok(ids.includes("cash_card"));
  }
});
