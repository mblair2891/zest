import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cameraAfterFloorInput, zoomFloorCamera } from "../src/lib/pos/floor-dimensions.ts";

test("fit room then a click keeps the zoom, and a later click keeps a wheel zoom", () => {
  const fitted = { s: 1, x: 16, y: 12 };
  assert.deepEqual(cameraAfterFloorInput(fitted, "select"), fitted);
  assert.deepEqual(cameraAfterFloorInput(fitted, "move"), fitted);
  assert.deepEqual(cameraAfterFloorInput(fitted, "resize"), fitted);
  assert.deepEqual(cameraAfterFloorInput(fitted, "viewport", { s: 1, x: 0, y: 0 }), fitted);

  const zoomed = zoomFloorCamera(fitted, 1.08, { x: 240, y: 180 });
  assert.ok(zoomed.s > fitted.s);
  assert.deepEqual(cameraAfterFloorInput(zoomed, "select"), zoomed);
  assert.deepEqual(cameraAfterFloorInput(zoomed, "move"), zoomed);
  assert.deepEqual(cameraAfterFloorInput(zoomed, "resize"), zoomed);
  assert.deepEqual(cameraAfterFloorInput(zoomed, "viewport", fitted), zoomed);

  assert.deepEqual(cameraAfterFloorInput(zoomed, "fit", fitted), fitted);
  const button = cameraAfterFloorInput(fitted, "control", zoomFloorCamera(fitted, 1.25, { x: 100, y: 80 }));
  assert.equal(button.s, 1.25);

  const editor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(editor, /cameraAfterFloorInput/);
  assert.match(editor, /input === "viewport"\) return/);
  assert.match(editor, /data-floor-zoom-in=""/);
  assert.match(editor, /data-floor-zoom-out=""/);
  assert.match(editor, /data-floor-fit-room=""/);
  assert.doesNotMatch(editor, /\[fit\.originX, fit\.originY, fit\.pxPerIn\]/);
  assert.doesNotMatch(editor, /publishLocationFn/);
});
