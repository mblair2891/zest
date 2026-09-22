import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canEntitySignIn,
  deleteSellingEntity,
  stripEntityCatalog,
  type VenueEntitySnap,
} from "../src/lib/saas/entity-delete.ts";
import {
  checklistTaskTarget,
  goLiveChecklistBlock,
  peerContactBlock,
  progressLine,
  seedLayeredOnboarding,
  setItemStatus,
} from "../src/lib/saas/onboarding-checklist.ts";
import { noteChecklistSave, useChecklistLink } from "../src/lib/saas/checklist-link.ts";

const trainingPeer = (): VenueEntitySnap => ({
  archived: false,
  entities: [
    { id: "kit", name: "Kitchen Co", lifecycle: "training", hasCardHistory: false, archived: false },
    { id: "bar", name: "Bar Co", lifecycle: "training", hasCardHistory: false, archived: false },
  ],
});

test("platform hard-deletes a training entity and the sibling still signs in", () => {
  const res = deleteSellingEntity(trainingPeer(), "kit", "Kitchen Co");
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.mode, "hard");
  assert.equal(res.venue.entities.some((e) => e.id === "kit"), false);
  assert.equal(canEntitySignIn(res.venue, "bar"), true);
  assert.equal(canEntitySignIn(res.venue, "kit"), false);
});

test("live or card history archives; last entity is blocked", () => {
  const live = trainingPeer();
  live.entities[0] = { ...live.entities[0]!, lifecycle: "live", hasCardHistory: true };
  const archived = deleteSellingEntity(live, "kit", "Kitchen Co");
  assert.equal(archived.ok, true);
  if (!archived.ok) return;
  assert.equal(archived.mode, "archive");
  assert.equal(canEntitySignIn(archived.venue, "bar"), true);
  assert.equal(canEntitySignIn(archived.venue, "kit"), false);
  const last = deleteSellingEntity(archived.venue, "bar", "Bar Co");
  assert.equal(last.ok, false);
  if (last.ok) return;
  assert.match(last.error, /last selling entity/);
});

test("typed name is required and siblings are not renamed", () => {
  const bad = deleteSellingEntity(trainingPeer(), "kit", "Bar Co");
  assert.equal(bad.ok, false);
});

test("peer venue has a location contact and two entity checklists", () => {
  const layer = seedLayeredOnboarding({
    peer: true,
    entities: [
      { id: "a", name: "Entity A" },
      { id: "b", name: "Entity B" },
    ],
  });
  assert.equal(layer.entities.length, 2);
  assert.equal(layer.location.items.some((i) => i.id === "contact"), true);
  assert.equal(layer.entities[0]?.items.some((i) => i.id === "merchant"), true);
  assert.equal(layer.entities[1]?.items.some((i) => i.id === "menu"), true);
  assert.match(progressLine(layer), /Entity A/);
  assert.match(progressLine(layer), /Entity B/);
  assert.match(peerContactBlock(layer) ?? "", /location contact/);
  layer.location.contactName = "Alex Owner";
  layer.location.contactEmail = "alex@example.com";
  layer.location.contactPhone = "555-0100";
  assert.equal(peerContactBlock(layer), null);
  const blocked = goLiveChecklistBlock(layer);
  assert.match(blocked ?? "", /merchant|Menu|order station/i);
  for (const e of layer.entities) {
    e.items = setItemStatus(e.items, "merchant", "done");
    e.items = setItemStatus(e.items, "menu", "done");
    e.items = setItemStatus(e.items, "order_station", "done");
  }
  assert.equal(goLiveChecklistBlock(layer), null);
});

test("hard delete drops that entity’s menu and keeps the sibling item", () => {
  const setup = stripEntityCatalog(
    {
      menuCatalog: {
        items: [
          { id: "burger", vendorId: "kit", name: "Burger" },
          { id: "wine", vendorId: "bar", name: "Wine" },
        ],
      },
      recipes: [
        { id: "r1", entityId: "kit", name: "Burger" },
        { id: "r2", entityId: "bar", name: "Wine" },
      ],
    },
    "kit",
  );
  const items = (setup.menuCatalog as { items: Array<{ id: string }> }).items;
  assert.deepEqual(items.map((i) => i.id), ["wine"]);
  assert.deepEqual(
    (setup.recipes as Array<{ id: string }>).map((r) => r.id),
    ["r2"],
  );
});

test("checklist task names deep-link; done waits for a save", () => {
  const layer = seedLayeredOnboarding({
    peer: false,
    entities: [{ id: "bar", name: "Bar Co" }],
  });
  const printer = layer.location.items.find((i) => i.label === "Receipt printer");
  assert.ok(printer);
  assert.equal(checklistTaskTarget("location", printer!.id).tab, "devices");
  assert.equal(checklistTaskTarget("location", "devices").focus, "receipt-printer");
  const menu = layer.entities[0]?.items.find((i) => i.label === "Menu");
  assert.ok(menu);
  assert.equal(checklistTaskTarget("entity", menu!.id).tab, "menu");
  assert.equal(checklistTaskTarget("entity", "menu").focus, "menu");

  useChecklistLink.getState().open({
    scope: "entity",
    entityId: "bar",
    itemId: "menu",
    label: "Menu",
    tab: "menu",
    focus: "menu",
    readOnly: false,
  });
  noteChecklistSave({ tab: "devices", focus: "receipt-printer" });
  assert.equal(useChecklistLink.getState().link?.saved, false);
  noteChecklistSave({ tab: "menu", focus: "menu" });
  assert.equal(useChecklistLink.getState().link?.saved, true);
  useChecklistLink.getState().back();
  assert.equal(useChecklistLink.getState().link, null);
  assert.equal(useChecklistLink.getState().applied, null);

  useChecklistLink.getState().open({
    scope: "location",
    itemId: "devices",
    label: "Receipt printer",
    tab: "devices",
    focus: "receipt-printer",
    readOnly: true,
    blocker: "Waiting on the ISP",
  });
  noteChecklistSave({ tab: "devices", focus: "receipt-printer" });
  assert.equal(useChecklistLink.getState().link?.saved, false);
  useChecklistLink.getState().done();
  assert.equal(useChecklistLink.getState().applied, null);
});

test("onboarding panel renders both layers and delete confirm", () => {
  const ui = readFileSync("src/components/platform/VenueOnboardingPanel.tsx", "utf8");
  assert.match(ui, /Location contact/);
  assert.match(ui, /data-entity-checklist/);
  assert.match(ui, /data-checklist-task/);
  assert.match(ui, /Type the entity name/);
  const bar = readFileSync("src/components/platform/ChecklistReturnBar.tsx", "utf8");
  assert.match(bar, /Back/);
  assert.match(bar, /Done/);
  assert.match(bar, /read-only/);
  const guide = readFileSync("src/lib/guide/content/platform-crm.ts", "utf8");
  assert.match(guide, /Archive/);
  assert.match(guide, /location contact/);
  assert.doesNotMatch(guide, /Summit Hall|Harbor Lot|Ash Street|Redbird/);
});
