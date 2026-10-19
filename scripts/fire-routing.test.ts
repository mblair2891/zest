import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  groupFireSlips,
  receiptPrinterNeverGetsKitchenFire,
  resolveOrderPrinters,
  type FireLineInput,
} from "../src/lib/pos/fire-routing.ts";
import { HOST_SCOPE } from "../src/lib/access/entity-grants.ts";
import type { LocationDevice } from "../src/lib/pos/location-devices.ts";
import type { MenuCategory, MenuItem } from "../src/lib/pos/types.ts";
import { ORDER_DESTINATION_PRESETS } from "../src/lib/pos/order-destinations.ts";

function orderPrinter(id: string, dest: string, ip = "10.0.0.10"): LocationDevice {
  const bar = dest.toLowerCase() === "bar";
  return {
    id,
    locationId: "loc",
    label: `${dest} Star`,
    type: "order_printer",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: HOST_SCOPE, function: bar ? "bar_kds" : "kitchen_kds" },
    print: {
      family: "star",
      connection: "lan",
      target: `${ip}:9100`,
      station: bar ? "bar" : "kitchen",
      destinationName: dest,
      ip,
      port: 9100,
      routes: bar ? ["bar_tickets"] : ["kitchen_tickets"],
    },
  };
}

function receiptPrinter(id = "prn_receipt"): LocationDevice {
  return {
    id,
    locationId: "loc",
    label: "Front receipt",
    type: "receipt_printer",
    status: "online",
    lastSeenAt: 1,
    assignment: { operatorId: HOST_SCOPE, function: "cashier" },
    print: {
      family: "epson",
      connection: "lan",
      target: "10.0.0.2:9100",
      station: "receipt",
      ip: "10.0.0.2",
      port: 9100,
      routes: ["receipts"],
    },
  };
}

function cat(
  id: string,
  name: string,
  dest: string,
  printerId?: string,
): MenuCategory {
  return {
    id,
    name,
    sort: 0,
    color: "#000",
    station: dest === "Bar" ? "bar" : "kitchen",
    destinationName: dest,
    printerId,
  };
}

function item(id: string, categoryId: string, station: MenuItem["station"] = "kitchen"): MenuItem {
  return {
    id,
    name: id,
    categoryId,
    priceCents: 100,
    course: "entree",
    station,
    modifierGroupIds: [],
    available: true,
  };
}

function line(
  id: string,
  name: string,
  opts: Partial<FireLineInput> = {},
): FireLineInput {
  return {
    id,
    name,
    quantity: 1,
    modifiers: [],
    course: opts.course ?? "entree",
    station: opts.station ?? "kitchen",
    menuItemId: opts.menuItemId ?? `mi_${id}`,
    categoryId: opts.categoryId,
    vendorId: opts.vendorId,
    ...opts,
  };
}

test("order destination presets include Salad Pizza Dessert", () => {
  assert.deepEqual([...ORDER_DESTINATION_PRESETS], [
    "Kitchen",
    "Bar",
    "Expo",
    "Window",
    "Prep",
    "Salad",
    "Pizza",
    "Dessert",
    "Other",
  ]);
});

test("four food groups on Kitchen + one Star print one slip", () => {
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const categories = [
    cat("g_plates", "Plates", "Kitchen"),
    cat("g_sandwich", "Sandwich", "Kitchen"),
    cat("g_sides", "Sides", "Kitchen"),
    cat("g_dessert", "Dessert", "Kitchen"),
  ];
  const menuItems = [
    item("mi_plate", "g_plates"),
    item("mi_sand", "g_sandwich"),
    item("mi_side", "g_sides"),
    item("mi_dess", "g_dessert"),
  ];
  const slips = groupFireSlips(
    [
      line("l1", "Plate", { menuItemId: "mi_plate", categoryId: "g_plates", course: "entree" }),
      line("l2", "Club", { menuItemId: "mi_sand", categoryId: "g_sandwich", course: "entree" }),
      line("l3", "Fries", { menuItemId: "mi_side", categoryId: "g_sides", course: "side" }),
      line("l4", "Cake", { menuItemId: "mi_dess", categoryId: "g_dessert", course: "dessert" }),
    ],
    { categories, menuItems, devices: [kitchen, receiptPrinter()] },
  );
  assert.equal(slips.length, 1);
  assert.equal(slips[0]!.destinationName, "Kitchen");
  assert.equal(slips[0]!.printerId, "prn_kitchen");
  assert.equal(slips[0]!.items.length, 4);
  assert.deepEqual(
    slips[0]!.items.map((i) => i.name),
    ["Plate", "Club", "Fries", "Cake"],
  );
  const printers = resolveOrderPrinters({
    devices: [kitchen, receiptPrinter()],
    destinationName: slips[0]!.destinationName,
    printerId: slips[0]!.printerId,
  });
  assert.deepEqual(
    printers.map((p) => p.id),
    ["prn_kitchen"],
  );
});

test("map Dessert to a second destination/printer: two slips", () => {
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const pastry = orderPrinter("prn_dessert", "Dessert", "10.0.0.11");
  const categories = [
    cat("g_plates", "Plates", "Kitchen"),
    cat("g_sandwich", "Sandwich", "Kitchen"),
    cat("g_sides", "Sides", "Kitchen"),
    cat("g_dessert", "Dessert", "Dessert", "prn_dessert"),
  ];
  const menuItems = [
    item("mi_plate", "g_plates"),
    item("mi_sand", "g_sandwich"),
    item("mi_side", "g_sides"),
    item("mi_dess", "g_dessert"),
  ];
  const slips = groupFireSlips(
    [
      line("l1", "Plate", { menuItemId: "mi_plate", categoryId: "g_plates" }),
      line("l2", "Club", { menuItemId: "mi_sand", categoryId: "g_sandwich" }),
      line("l3", "Fries", { menuItemId: "mi_side", categoryId: "g_sides", course: "side" }),
      line("l4", "Cake", { menuItemId: "mi_dess", categoryId: "g_dessert", course: "dessert" }),
    ],
    { categories, menuItems, devices: [kitchen, pastry, receiptPrinter()] },
  );
  assert.equal(slips.length, 2);
  assert.equal(slips[0]!.destinationName, "Kitchen");
  assert.equal(slips[0]!.printerId, "prn_kitchen");
  assert.equal(slips[0]!.items.length, 3);
  assert.equal(slips[1]!.destinationName, "Dessert");
  assert.equal(slips[1]!.printerId, "prn_dessert");
  assert.deepEqual(
    slips[1]!.items.map((i) => i.name),
    ["Cake"],
  );
});

test("bar item prints on the bar printer only", () => {
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const bar = orderPrinter("prn_bar", "Bar", "10.0.0.12");
  const receipt = receiptPrinter();
  const categories = [
    cat("g_plates", "Plates", "Kitchen"),
    cat("g_cocktails", "Cocktails", "Bar"),
  ];
  const menuItems = [
    item("mi_plate", "g_plates"),
    item("mi_mule", "g_cocktails", "bar"),
  ];
  const slips = groupFireSlips(
    [
      line("l1", "Plate", { menuItemId: "mi_plate", categoryId: "g_plates" }),
      line("l2", "Mule", {
        menuItemId: "mi_mule",
        categoryId: "g_cocktails",
        course: "drink",
        station: "bar",
      }),
    ],
    { categories, menuItems, devices: [kitchen, bar, receipt] },
  );
  assert.equal(slips.length, 2);
  const drink = slips.find((s) => s.destinationName === "Bar");
  assert.ok(drink);
  assert.equal(drink!.printerId, "prn_bar");
  const barOnly = resolveOrderPrinters({
    devices: [kitchen, bar, receipt],
    destinationName: "Bar",
    printerId: drink!.printerId,
  });
  assert.deepEqual(
    barOnly.map((p) => p.id),
    ["prn_bar"],
  );
  assert.equal(receiptPrinterNeverGetsKitchenFire(receipt), true);
  assert.equal(
    resolveOrderPrinters({
      devices: [kitchen, bar, receipt],
      destinationName: "Kitchen",
    }).some((p) => p.id === receipt.id),
    false,
  );
});

test("drinks fall back to the kitchen printer when there is no bar printer", () => {
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const categories = [cat("g_cocktails", "Cocktails", "Bar")];
  const menuItems = [item("mi_mule", "g_cocktails", "bar")];
  const slips = groupFireSlips(
    [
      line("l1", "Mule", {
        menuItemId: "mi_mule",
        categoryId: "g_cocktails",
        course: "drink",
        station: "bar",
      }),
    ],
    { categories, menuItems, devices: [kitchen, receiptPrinter()] },
  );
  assert.equal(slips.length, 1);
  assert.equal(slips[0]!.destinationName, "Bar");
  assert.equal(slips[0]!.printerId, "prn_kitchen");
});

test("separate course tickets splits one printer by course", () => {
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const categories = [
    cat("g_plates", "Plates", "Kitchen"),
    cat("g_dessert", "Dessert", "Kitchen"),
  ];
  const menuItems = [item("mi_plate", "g_plates"), item("mi_dess", "g_dessert")];
  const slips = groupFireSlips(
    [
      line("l1", "Plate", { menuItemId: "mi_plate", categoryId: "g_plates", course: "entree" }),
      line("l2", "Cake", { menuItemId: "mi_dess", categoryId: "g_dessert", course: "dessert" }),
    ],
    {
      categories,
      menuItems,
      devices: [kitchen],
      separateCourseTickets: true,
    },
  );
  assert.equal(slips.length, 2);
});

test("a server tablet sends liquor to the section bar printer", () => {
  const food = "ent_food";
  const bar = "ent_bar";
  const server = {
    id: "tab_server",
    locationId: "loc",
    label: "Server 1",
    type: "tablet_pos" as const,
    status: "online" as const,
    lastSeenAt: 1,
    assignment: { operatorId: food, function: "floor_pos" as const },
    orderPrinterIds: ["prn_kitchen"],
  };
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  kitchen.assignment = { operatorId: food, function: "kitchen_kds" };
  const mainBar = orderPrinter("prn_bar_main", "Bar", "10.0.0.12");
  mainBar.assignment = { operatorId: bar, function: "bar_kds" };
  mainBar.print = { ...mainBar.print!, sectionIds: ["sec_main"] };
  const rail = orderPrinter("prn_bar_rail", "Bar", "10.0.0.13");
  rail.assignment = { operatorId: bar, function: "bar_kds" };
  rail.print = { ...rail.print!, sectionIds: ["sec_rail"], serveNoSection: true };
  const devices = [server, kitchen, mainBar, rail, receiptPrinter()];
  const categories = [
    cat("g_plates", "Plates", "Kitchen"),
    cat("g_cocktails", "Cocktails", "Bar"),
  ];
  const menuItems = [item("mi_plate", "g_plates"), item("mi_mule", "g_cocktails", "bar")];
  const table = { id: "t12", sectionId: "sec_main" };
  const slips = groupFireSlips(
    [
      line("l1", "Plate", { menuItemId: "mi_plate", categoryId: "g_plates" }),
      line("l2", "Mule", {
        menuItemId: "mi_mule",
        categoryId: "g_cocktails",
        course: "drink",
        station: "bar",
        vendorId: bar,
      }),
    ],
    {
      categories,
      menuItems,
      devices,
      stationDeviceId: server.id,
      table,
      tableId: table.id,
      sections: [
        { id: "sec_main", name: "Main" },
        { id: "sec_rail", name: "Rail" },
      ],
      orderType: "dine_in",
    },
  );
  const drink = slips.find((s) => s.destinationName === "Bar");
  const foodSlip = slips.find((s) => s.destinationName === "Kitchen");
  assert.ok(drink);
  assert.equal(drink!.printerId, "prn_bar_main");
  assert.equal(drink!.station, "bar");
  assert.deepEqual(
    drink!.items.map((i) => i.lineId),
    ["l2"],
  );
  assert.equal(foodSlip?.printerId, "prn_kitchen");
  const reprinted = resolveOrderPrinters({
    devices,
    destinationName: "Bar",
    printerId: drink!.printerId,
    operatorId: bar,
    stationDeviceId: server.id,
    table,
    tableId: table.id,
    sections: [{ id: "sec_main", name: "Main" }],
    orderType: "dine_in",
  });
  assert.deepEqual(
    reprinted.map((p) => p.id),
    ["prn_bar_main"],
  );
  const sent = new Set(slips.flatMap((s) => s.items.map((i) => i.lineId)));
  assert.deepEqual([...sent].sort(), ["l1", "l2"]);
});

test("an empty station list still sends liquor and sends no food ticket", () => {
  const server = {
    id: "tab_server",
    locationId: "loc",
    label: "Server 1",
    type: "tablet_pos" as const,
    status: "online" as const,
    lastSeenAt: 1,
    assignment: { operatorId: HOST_SCOPE, function: "floor_pos" as const },
    orderPrinterIds: [] as string[],
  };
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const bar = orderPrinter("prn_bar", "Bar", "10.0.0.12");
  const devices = [server, kitchen, bar];
  assert.deepEqual(
    resolveOrderPrinters({
      devices,
      destinationName: "Bar",
      stationDeviceId: server.id,
      orderType: "bar_tab",
    }).map((p) => p.id),
    ["prn_bar"],
  );
  assert.deepEqual(
    resolveOrderPrinters({
      devices,
      destinationName: "Kitchen",
      stationDeviceId: server.id,
    }),
    [],
  );
});

test("a bar tab with no section uses the no-section bar printer", () => {
  const server = {
    id: "tab_server",
    locationId: "loc",
    label: "Server 1",
    type: "tablet_pos" as const,
    status: "online" as const,
    lastSeenAt: 1,
    assignment: { operatorId: HOST_SCOPE, function: "floor_pos" as const },
    orderPrinterIds: ["prn_kitchen"],
  };
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const mainBar = orderPrinter("prn_bar_main", "Bar", "10.0.0.12");
  mainBar.print = { ...mainBar.print!, sectionIds: ["sec_main"] };
  const tabs = orderPrinter("prn_bar_tabs", "Bar", "10.0.0.13");
  tabs.print = { ...tabs.print!, serveNoSection: true };
  const hit = resolveOrderPrinters({
    devices: [server, kitchen, mainBar, tabs],
    destinationName: "Bar",
    stationDeviceId: server.id,
    orderType: "bar_tab",
  });
  assert.deepEqual(
    hit.map((p) => p.id),
    ["prn_bar_tabs"],
  );
});

test("drinks with no bar printer still follow the station food list", () => {
  const server = {
    id: "tab_server",
    locationId: "loc",
    label: "Server 1",
    type: "tablet_pos" as const,
    status: "online" as const,
    lastSeenAt: 1,
    assignment: { operatorId: HOST_SCOPE, function: "floor_pos" as const },
    orderPrinterIds: ["prn_kitchen"],
  };
  const kitchen = orderPrinter("prn_kitchen", "Kitchen");
  const other = orderPrinter("prn_other", "Kitchen", "10.0.0.14");
  assert.deepEqual(
    resolveOrderPrinters({
      devices: [server, kitchen, other],
      destinationName: "Bar",
      stationDeviceId: server.id,
    }).map((p) => p.id),
    ["prn_kitchen"],
  );
  const none = { ...server, id: "tab_none", orderPrinterIds: [] as string[] };
  assert.deepEqual(
    resolveOrderPrinters({
      devices: [none, kitchen],
      destinationName: "Bar",
      stationDeviceId: none.id,
    }),
    [],
  );
});

test("send no longer groups kitchen fire by course or menu group", () => {
  const store = readFileSync("src/lib/pos/store.ts", "utf8");
  assert.match(store, /groupFireSlips/);
  assert.match(store, /floorSections/);
  assert.doesNotMatch(store, /\$\{l\.station\}\|\$\{l\.vendorId/);
  const from = readFileSync("src/lib/print/from-store.ts", "utf8");
  assert.match(from, /resolveOrderPrinters/);
  const fire = readFileSync("src/lib/pos/fire-routing.ts", "utf8");
  assert.match(fire, /resolveBarPrinterForCheck/);
  const guide = readFileSync("src/lib/guide/content/orders.ts", "utf8");
  assert.match(guide, /Separate course tickets/);
  assert.match(guide, /one ticket/);
  assert.match(guide, /table’s section/);
});
