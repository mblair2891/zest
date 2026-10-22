import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { contrastInk } from "../src/lib/pos/floor-status.ts";
import {
  DEFAULT_ODS_PHASES,
  nextOdsPhase,
  parseOdsPhases,
  phaseForTicket,
  phasePaint,
} from "../src/lib/pos/ods-phases.ts";
import {
  MENU_SWATCHES,
  categoryButtonPaint,
  otherServerTable,
  tableServicePaint,
  tableServiceTone,
} from "../src/lib/pos/service-colors.ts";

const base = {
  pipeline: "empty",
  selected: false,
  otherServer: false,
  lines: [] as { held?: boolean; sent?: boolean; voided?: boolean }[],
  tickets: [] as { status?: string }[],
};

test("floor service colors follow held, sent, fulfilled, selected, and another server", () => {
  const empty = tableServicePaint({ ...base, scheme: "light" });
  assert.equal(empty.tone, "empty");
  assert.equal(empty.dotted, true);
  assert.equal(empty.fill, "#f7f6f3");
  assert.equal(tableServicePaint({ ...base, scheme: "dark" }).dotted, true);

  const held = tableServicePaint({
    ...base,
    pipeline: "sat_no_order",
    lines: [{ held: true, sent: false }],
    scheme: "light",
  });
  assert.equal(held.tone, "held");
  assert.equal(held.fill, "#b91c1c");

  const sent = tableServicePaint({
    ...base,
    pipeline: "ordered_food",
    lines: [{ sent: true }],
    tickets: [{ status: "in_progress" }],
    scheme: "light",
  });
  assert.equal(sent.tone, "sent");
  assert.equal(sent.fill, "#eab308");

  const ready = tableServicePaint({
    ...base,
    pipeline: "food_delivered",
    lines: [{ sent: true }],
    tickets: [{ status: "ready" }],
    scheme: "light",
  });
  assert.equal(ready.tone, "ready");
  assert.equal(ready.fill, "#15803d");

  assert.equal(
    tableServiceTone({
      ...base,
      selected: true,
      otherServer: true,
      lines: [{ held: true }],
    }),
    "selected",
  );
  assert.equal(tableServicePaint({ ...base, selected: true, scheme: "light" }).fill, "#1d4ed8");

  assert.equal(
    tableServiceTone({
      pipeline: "ordered_food",
      selected: false,
      otherServer: true,
      lines: [{ sent: true }],
      tickets: [{ status: "in_progress" }],
    }),
    "other",
  );
  assert.equal(otherServerTable({ role: "server", employeeId: "a", serverId: "b" }), true);
  assert.equal(otherServerTable({ role: "manager", employeeId: "a", serverId: "b" }), false);

  assert.equal(
    tableServiceTone({
      pipeline: "ordered_food",
      selected: false,
      otherServer: false,
      lines: [{ sent: true }, { sent: false }],
      tickets: [{ status: "ready" }],
    }),
    "held",
  );
});

test("menu swatches and phase colors stay high contrast in light and dark", () => {
  for (const scheme of ["light", "dark"] as const) {
    for (const swatch of MENU_SWATCHES) {
      const paint = categoryButtonPaint(swatch.id, scheme);
      assert.equal(paint.id, swatch.id);
      assert.equal(paint.ink, contrastInk(paint.bg));
      assert.ok(paint.ink === "#0a0a0a" || paint.ink === "#f7f6f3");
    }
    for (const phase of DEFAULT_ODS_PHASES) {
      const paint = phasePaint(phase, scheme);
      assert.equal(paint.ink, contrastInk(paint.bg));
    }
  }
  assert.equal(categoryButtonPaint(undefined, "light").id, "neutral");
  assert.equal(categoryButtonPaint("", "dark").id, "neutral");
  assert.equal(categoryButtonPaint("#112233", "light").id, "custom");
  const fills = new Set(
    MENU_SWATCHES.filter((swatch) => swatch.id !== "neutral").map(
      (swatch) => categoryButtonPaint(swatch.id, "light").bg,
    ),
  );
  assert.equal(fills.size, MENU_SWATCHES.length - 1);
});

test("an order-display ticket advances one phase and the last bump is terminal", () => {
  const phases = parseOdsPhases(undefined);
  let ticket: { status: string; phase?: string } = { status: "new" };
  const seen: string[] = [];
  for (let i = 0; i < 8; i += 1) {
    seen.push(phaseForTicket(ticket, phases).id);
    const next = nextOdsPhase(ticket, phases);
    if (!next) break;
    ticket = { status: next.ticketStatus, phase: next.id };
  }
  assert.deepEqual(seen, ["new", "started", "prep", "ready", "bumped"]);
  assert.equal(nextOdsPhase({ status: "bumped", phase: "bumped" }, phases), null);
  const paints = ["new", "started", "prep", "ready", "bumped"].map((id) => {
    const phase = phases.find((row) => row.id === id);
    assert.ok(phase);
    return phasePaint(phase, "light").bg;
  });
  assert.equal(new Set(paints).size, paints.length);
  assert.equal(phaseForTicket({ status: "ready", phase: "prep" }, phases).id, "ready");
});

test("order buttons, the floor map, and the order display use the service colors", () => {
  const order = readFileSync("src/components/pos/OrderView.tsx", "utf8");
  const menu = readFileSync("src/components/pos/MenuAdminView.tsx", "utf8");
  const ods = readFileSync("src/components/pos/KitchenView.tsx", "utf8");
  const floor = readFileSync("src/components/pos/FloorView.tsx", "utf8");
  assert.match(order, /categoryButtonPaint/);
  assert.match(order, /data-menu-swatch=\{paint\.id\}/);
  assert.match(menu, /data-menu-swatches/);
  assert.match(ods, /advanceTicketPhase/);
  assert.match(ods, /data-ods-phase=\{phase\.id\}/);
  assert.doesNotMatch(ods, /smallForm/);
  assert.match(floor, /tableServicePaint/);
  assert.match(floor, /hollow=\{paint\.dotted\}/);
});
