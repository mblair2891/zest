import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PRINTER_PORT,
  PRINTER_MODEL_GROUPS,
  PRINTER_MODEL_LABEL,
  PRINTER_MODEL_PRESETS,
  defaultPrinterModel,
  parseLanTarget,
  printerModelSpec,
} from "../src/lib/print/printer-models.ts";

test("catalog covers Star SP742, Epson, Citizen, Bixolon, generic 80mm", () => {
  assert.ok(PRINTER_MODEL_PRESETS.includes("star_sp700"));
  assert.match(PRINTER_MODEL_LABEL.star_sp700, /SP742/);
  assert.match(PRINTER_MODEL_LABEL.star_sp700, /SP700/);
  assert.match(PRINTER_MODEL_LABEL.star_line, /Star Line/);
  assert.match(PRINTER_MODEL_LABEL.epson_tm_t20, /T20/);
  assert.match(PRINTER_MODEL_LABEL.citizen_ct_s310, /CT-S310/);
  assert.match(PRINTER_MODEL_LABEL.bixolon_srp_330, /SRP-330/);
  assert.equal(PRINTER_MODEL_LABEL.generic_escpos, "Generic ESC/POS (80mm)");
  assert.ok(PRINTER_MODEL_PRESETS.includes("generic_escpos"));
  assert.ok(PRINTER_MODEL_PRESETS.includes("generic_escpos_58"));
  const groups = PRINTER_MODEL_GROUPS.map((g) => g.id);
  assert.deepEqual(groups, ["star", "epson", "citizen", "bixolon", "other"]);
});

test("each preset sets emulation, paper, cutter, port 9100", () => {
  for (const id of PRINTER_MODEL_PRESETS) {
    const spec = printerModelSpec(id);
    assert.equal(spec.port, DEFAULT_PRINTER_PORT);
    assert.ok(["escpos", "star_line", "starprnt"].includes(spec.emulation));
    assert.ok([58, 76, 80].includes(spec.paperWidthMm));
    assert.ok(["full", "partial", "none"].includes(spec.cutter));
  }
  const sp700 = printerModelSpec("star_sp700");
  assert.equal(sp700.emulation, "escpos");
  assert.equal(sp700.defaultFor, "order");
  const starLine = printerModelSpec("star_line");
  assert.equal(starLine.emulation, "star_line");
  assert.equal(defaultPrinterModel("order"), "star_sp700");
  assert.equal(defaultPrinterModel("receipt"), "epson_tm_t20");
});

test("SP742 LAN target parses to 9100", () => {
  const t = parseLanTarget("192.168.0.105", undefined, undefined);
  assert.deepEqual(t, { host: "192.168.0.105", port: 9100, target: "192.168.0.105:9100" });
});
