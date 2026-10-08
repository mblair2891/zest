import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FLOOR_TOOLBAR_STORAGE_KEY,
  barsOnDock,
  defaultFloorToolbarLayout,
  dockUnderPoint,
  floatFloorBar,
  parseFloorToolbarLayout,
  pinFloorBar,
  serializeFloorToolbarLayout,
} from "../src/lib/pos/floor-toolbars.ts";

test("floor bars default to two top rows with pieces first", () => {
  const layout = defaultFloorToolbarLayout();
  assert.deepEqual(barsOnDock(layout, "top"), ["pieces", "view"]);
  assert.deepEqual(barsOnDock(layout, "left"), []);
  assert.deepEqual(barsOnDock(layout, "right"), []);
  assert.equal(FLOOR_TOOLBAR_STORAGE_KEY, "summex-floor-toolbars-v1");
});

test("an undocked pieces bar stays where it was dropped, and reset restores the top", () => {
  const layout = defaultFloorToolbarLayout();
  const floated = floatFloorBar(layout, "pieces", 48, 120);
  assert.equal(floated.pieces.dock, "float");
  assert.equal(floated.pieces.x, 48);
  assert.equal(floated.pieces.y, 120);
  assert.deepEqual(barsOnDock(floated, "top"), ["view"]);
  const saved = serializeFloorToolbarLayout(floated);
  const loaded = parseFloorToolbarLayout(saved);
  assert.equal(loaded.pieces.dock, "float");
  assert.equal(loaded.pieces.x, 48);
  assert.equal(loaded.pieces.y, 120);
  assert.equal(loaded.view.dock, "top");

  const pinnedLeft = pinFloorBar(loaded, "pieces", "left");
  assert.deepEqual(barsOnDock(pinnedLeft, "left"), ["pieces"]);
  const backOnTop = pinFloorBar(pinnedLeft, "pieces", "top");
  assert.deepEqual(barsOnDock(backOnTop, "top"), ["view", "pieces"]);

  const reset = defaultFloorToolbarLayout();
  assert.deepEqual(barsOnDock(reset, "top"), ["pieces", "view"]);
  assert.equal(parseFloorToolbarLayout("not-json").pieces.dock, "top");
  assert.equal(parseFloorToolbarLayout(null).view.order, 1);
});

test("a drop on a dock pin hits the smallest dock under the pointer", () => {
  const docks = [
    { dock: "top" as const, left: 0, top: 0, right: 400, bottom: 80 },
    { dock: "left" as const, left: 0, top: 80, right: 28, bottom: 600 },
    { dock: "right" as const, left: 360, top: 80, right: 400, bottom: 600 },
  ];
  assert.equal(dockUnderPoint({ x: 20, y: 20 }, docks), "top");
  assert.equal(dockUnderPoint({ x: 10, y: 200 }, docks), "left");
  assert.equal(dockUnderPoint({ x: 380, y: 200 }, docks), "right");
  assert.equal(dockUnderPoint({ x: 200, y: 200 }, docks), null);
});

test("the editor keeps two bars, a grip, and browser layout", () => {
  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /data-floor-bar="pieces"/);
  assert.match(editor, /data-floor-bar="view"/);
  assert.match(editor, /data-floor-bar-grip=""/);
  assert.match(editor, /renderFloorDock\("top"\)/);
  assert.match(editor, /renderFloorDock\("left"\)/);
  assert.match(editor, /renderFloorDock\("right"\)/);
  assert.match(editor, /data-floor-toolbar-reset=""/);
  assert.match(editor, /FLOOR_TOOLBAR_STORAGE_KEY/);
  assert.match(editor, /floatFloorBar/);
  assert.match(editor, /pinFloorBar/);
  assert.match(editor, /idsRemovedWithBars/);
  const pieces = editor.slice(editor.indexOf('data-floor-bar="pieces"'), editor.indexOf('data-floor-bar="view"'));
  assert.match(pieces, /flex-nowrap/);
  assert.doesNotMatch(pieces, /Floor plan editor/);
});
