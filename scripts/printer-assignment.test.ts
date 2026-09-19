import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveReceiptPrinterForCheck,
  resolveBarPrinterForCheck,
  seedDefaultPrinterAssignments,
  setSectionPrinter,
} from "../src/lib/print/printer-assignment.ts";

function orderPrinter(id: string, dest: string, extra?: Record<string, unknown>) {
  const bar = dest.toLowerCase() === "bar";
  return {
    id,
    type: "order_printer",
    status: "online",
    print: {
      station: bar ? "bar" : "kitchen",
      destinationName: dest,
      routes: bar ? ["bar_tickets"] : ["kitchen_tickets"],
      ...extra,
    },
  };
}

function receiptPrinter(id: string, extra?: Record<string, unknown>) {
  return {
    id,
    type: "receipt_printer",
    status: "online",
    print: {
      station: "receipt",
      routes: ["receipts"],
      ...extra,
    },
  };
}

const sections = [
  { id: "sec_a", name: "Dining A" },
  { id: "sec_b", name: "Dining B" },
];

test("two sections, two receipt printers: table in A prints on A's Epson", () => {
  const recA = receiptPrinter("prn_rec_a", { sectionIds: ["sec_a"] });
  const recB = receiptPrinter("prn_rec_b", { sectionIds: ["sec_b"], venueDefault: true });
  const hit = resolveReceiptPrinterForCheck({
    devices: [recA, recB],
    stationDeviceId: "tab_unbound",
    table: { id: "t1", section: "Dining A", sectionId: "sec_a" },
    sections,
    orderType: "dine_in",
  });
  assert.equal(hit?.id, "prn_rec_a");
});

test("to-go uses venue default receipt printer", () => {
  const recA = receiptPrinter("prn_rec_a", { sectionIds: ["sec_a"] });
  const recB = receiptPrinter("prn_rec_b", { sectionIds: ["sec_b"], venueDefault: true });
  const hit = resolveReceiptPrinterForCheck({
    devices: [recA, recB],
    orderType: "takeout",
  });
  assert.equal(hit?.id, "prn_rec_b");
});

test("section with none uses venue default, then any receipt printer", () => {
  const recA = receiptPrinter("prn_rec_a", { sectionIds: ["sec_a"] });
  const recDef = receiptPrinter("prn_def", { venueDefault: true });
  const hit = resolveReceiptPrinterForCheck({
    devices: [recA, recDef],
    table: { id: "t2", section: "Dining B", sectionId: "sec_b" },
    sections,
    orderType: "dine_in",
  });
  assert.equal(hit?.id, "prn_def");
  const any = resolveReceiptPrinterForCheck({
    devices: [recA],
    table: { id: "t3", section: "Dining", sectionId: "sec_dining" },
    sections: [...sections, { id: "sec_dining", name: "Dining" }],
    orderType: "dine_in",
  });
  assert.equal(any?.id, "prn_rec_a");
});

test("entity on a receipt printer does not block a house check", () => {
  const rec = {
    ...receiptPrinter("prn_112", { sectionIds: ["sec_a"] }),
    assignment: { operatorId: "op_hearth", function: "cashier" },
  };
  const hit = resolveReceiptPrinterForCheck({
    devices: [rec],
    table: { id: "t1", section: "Dining A", sectionId: "sec_a" },
    sections,
    orderType: "dine_in",
  });
  assert.equal(hit?.id, "prn_112");
});

test("drinks from section B hit B's bar printer", () => {
  const barA = orderPrinter("prn_bar_a", "Bar", { sectionIds: ["sec_a"] });
  const barB = orderPrinter("prn_bar_b", "Bar", { sectionIds: ["sec_b"] });
  const hit = resolveBarPrinterForCheck({
    devices: [barA, barB],
    table: { id: "t2", section: "Dining B", sectionId: "sec_b" },
    sections,
    orderType: "dine_in",
  });
  assert.equal(hit?.id, "prn_bar_b");
});

test("one bar printer maps every section", () => {
  const bar = orderPrinter("prn_bar", "Bar");
  const hitA = resolveBarPrinterForCheck({
    devices: [bar],
    table: { id: "t1", section: "Dining A", sectionId: "sec_a" },
    sections,
    orderType: "dine_in",
  });
  const hitB = resolveBarPrinterForCheck({
    devices: [bar],
    table: { id: "t2", section: "Dining B", sectionId: "sec_b" },
    sections,
    orderType: "dine_in",
  });
  assert.equal(hitA?.id, "prn_bar");
  assert.equal(hitB?.id, "prn_bar");
});

test("seed single-line venue assigns all sections to the one receipt and bar printer", () => {
  const rec = receiptPrinter("prn_rec");
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const bar = orderPrinter("prn_bar", "Bar");
  const seeded = seedDefaultPrinterAssignments([rec, kitchen, bar], sections);
  const recNext = seeded.find((d) => d.id === "prn_rec")!;
  assert.deepEqual(recNext.print?.sectionIds, ["sec_a", "sec_b"]);
  assert.equal(recNext.print?.venueDefault, true);
  assert.equal(recNext.print?.serveNoSection, true);
  const barNext = seeded.find((d) => d.id === "prn_bar")!;
  assert.deepEqual(barNext.print?.sectionIds, ["sec_a", "sec_b"]);
});

test("setSectionPrinter is exclusive per kind", () => {
  const recA = receiptPrinter("prn_rec_a", { sectionIds: ["sec_a"] });
  const recB = receiptPrinter("prn_rec_b", { sectionIds: [] });
  const next = setSectionPrinter([recA, recB], "sec_a", "receipt", "prn_rec_b");
  assert.equal(next.find((d) => d.id === "prn_rec_a")!.print?.sectionIds?.includes("sec_a"), false);
  assert.equal(next.find((d) => d.id === "prn_rec_b")!.print?.sectionIds?.includes("sec_a"), true);
});

test("devices UI assigns printers to sections, not as the routing source of truth", () => {
  const ui = readFileSync("src/components/pos/LocationDeviceRegistry.tsx", "utf8");
  assert.match(ui, /Floor sections/);
  assert.match(ui, /Bar tabs \/ no section/);
  assert.match(ui, /Venue default \(to-go \/ will-call\)/);
  assert.match(ui, /Fallback stations if the section has none/);
  assert.match(ui, /Menu groups/);
  assert.doesNotMatch(ui, /Which order \/ host stations use it/);
  assert.doesNotMatch(ui, /Which stations may send to it/);
  const floor = readFileSync("src/components/pos/FloorEditorView.tsx", "utf8");
  assert.match(floor, /Receipt printer/);
  assert.match(floor, /Bar printer/);
  assert.match(floor, /setSectionPrinter/);
  const fire = readFileSync("src/lib/pos/fire-routing.ts", "utf8");
  assert.match(fire, /resolveBarPrinterForCheck/);
  assert.match(fire, /Food: menu group destination/);
});
