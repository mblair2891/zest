import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fetchOlccStores, locationShowsOlccStores, parseOlccStorePayload } from "../src/lib/costs/olcc-stores.ts";
import {
  applyHouseStore,
  buildSupplier,
  deactivateSupplier,
  linkInvoiceToSupplier,
  supplierSendsOrder,
  supplierTypeLabel,
  suppliersKeptAfterRefresh,
} from "../src/lib/costs/suppliers.ts";

const FEATURES = {
  features: [
    {
      attributes: {
        Store_Numb: 1002,
        Store_Addr: "217 N Main Street",
        City: "Heppner",
        name: "Heppner Liquor Store",
        number: "(541) 676-9159",
      },
    },
    {
      attributes: {
        Store_Numb: 1167,
        Store_Addr: "730 Bond St Ste A",
        City: "Astoria",
        name: "Astoria Liquor",
        number: "(503) 325-4784",
      },
    },
  ],
};

test("a food supplier and a beer supplier keep contact fields", () => {
  const food = buildSupplier(
    {
      name: "Pacific Foods",
      kind: "food",
      contactName: "Ana Ruiz",
      phone: "503-555-0101",
      email: "ana@pacific.example",
      accountNumber: "PF-19",
      orderMethod: "email",
      notes: "Tuesday dock",
    },
    "sup_food",
  );
  const beer = buildSupplier(
    {
      name: "Maletis",
      kind: "beverage",
      beverage: "beer",
      contactName: "Jordan Lee",
      phone: "503-555-0144",
      email: "orders@maletis.example",
      accountNumber: "M-440",
      orderMethod: "portal",
      notes: "Kegs only",
    },
    "sup_beer",
  );
  assert.equal(food.ok, true);
  assert.equal(beer.ok, true);
  if (!food.ok || !beer.ok) return;
  assert.equal(food.supplier.kind, "food");
  assert.equal(food.supplier.beverage, undefined);
  assert.equal(food.supplier.contactName, "Ana Ruiz");
  assert.equal(food.supplier.phone, "503-555-0101");
  assert.equal(food.supplier.email, "ana@pacific.example");
  assert.equal(food.supplier.accountNumber, "PF-19");
  assert.equal(food.supplier.orderMethod, "email");
  assert.equal(food.supplier.notes, "Tuesday dock");
  assert.equal(supplierTypeLabel(food.supplier), "Food");
  assert.equal(beer.supplier.beverage, "beer");
  assert.equal(supplierTypeLabel(beer.supplier), "Beverage · Beer");
  assert.equal(supplierSendsOrder(food.supplier), true);
  assert.equal(supplierSendsOrder(beer.supplier), true);
  const missing = buildSupplier({ name: "Blank", kind: "beverage" }, "x");
  assert.equal(missing.ok, false);
});

test("deactivate keeps the supplier and every invoice that names it", () => {
  const food = buildSupplier({ name: "Pacific Foods", kind: "food", contactName: "Ana" }, "sup_food");
  assert.equal(food.ok, true);
  if (!food.ok) return;
  const before = [food.supplier];
  let invoices = [{ id: "inv1", supplierId: undefined as string | undefined, status: "posted" }];
  invoices = linkInvoiceToSupplier(invoices, "inv1", "sup_food");
  const snapshot = invoices.map((row) => ({ ...row }));
  const next = deactivateSupplier(before, "sup_food");
  assert.equal(next.length, 1);
  assert.equal(next[0]?.active, false);
  assert.equal(next[0]?.id, "sup_food");
  assert.deepEqual(invoices, snapshot);
  assert.equal(invoices[0]?.supplierId, "sup_food");
  assert.equal(supplierSendsOrder(next[0]!), false);
});

test("an Oregon location lists liquor stores and the house store receives an invoice", () => {
  assert.equal(locationShowsOlccStores("OR"), true);
  assert.equal(locationShowsOlccStores("Oregon"), true);
  assert.equal(locationShowsOlccStores("WA"), false);
  assert.equal(locationShowsOlccStores("Washington"), false);
  assert.equal(locationShowsOlccStores(""), false);
  assert.equal(locationShowsOlccStores(undefined), false);
  const stores = parseOlccStorePayload(FEATURES);
  assert.equal(stores[0]?.name, "Astoria Liquor");
  assert.equal(stores[1]?.name, "Heppner Liquor Store");
  assert.equal(stores[1]?.address, "217 N Main Street, Heppner");
  assert.equal(stores[1]?.phone, "(541) 676-9159");
  assert.equal(stores[1]?.city, "Heppner");
  assert.equal(stores[0]?.city, "Astoria");
  const heppner = stores[1]!;
  const astoria = stores[0]!;
  const first = applyHouseStore([], heppner, "sup_house");
  assert.equal(first.length, 1);
  assert.equal(first[0]?.houseStore, true);
  assert.equal(first[0]?.kind, "beverage");
  assert.equal(first[0]?.beverage, "spirits");
  assert.equal(first[0]?.name, "Heppner Liquor Store");
  assert.equal(first[0]?.phone, "(541) 676-9159");
  assert.equal(supplierSendsOrder(first[0]!), false);
  let invoices = [{ id: "inv-olcc", supplierId: undefined as string | undefined, status: "draft" }];
  invoices = linkInvoiceToSupplier(invoices, "inv-olcc", first[0]!.id);
  assert.equal(invoices[0]?.supplierId, "sup_house");
  const switched = applyHouseStore(first, astoria, "sup_astoria");
  assert.equal(switched.filter((row) => row.houseStore).length, 1);
  assert.equal(switched.find((row) => row.olccStoreNumber === "1167")?.houseStore, true);
  assert.ok(switched.find((row) => row.id === "sup_house"));
  assert.equal(invoices.length, 1);
  assert.equal(invoices[0]?.supplierId, "sup_house");
  const inactive = deactivateSupplier(switched, "sup_house");
  assert.equal(inactive.find((row) => row.id === "sup_house")?.active, false);
  assert.equal(invoices[0]?.supplierId, "sup_house");
});

test("the store list is read from the public OLCC map layer and does not order", async () => {
  const calls: string[] = [];
  const rows = await fetchOlccStores(async (input) => {
    const url = String(input);
    calls.push(url);
    assert.match(url, /Liquor_Stores_app_view\/FeatureServer\/1\/query/);
    if (calls.length === 1) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ ...FEATURES, exceededTransferLimit: true }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ features: [] }) };
  });
  assert.equal(rows.length, 2);
  assert.equal(calls.length, 2);
  assert.match(calls[1]!, /resultOffset=2/);
  const source = readFileSync("src/lib/costs/olcc-stores.ts", "utf8");
  assert.doesNotMatch(source, /checkout|placeOrder|addToCart|oregonliquorsearch/i);
});

test("Suppliers is a section, and Costs still links an invoice to any supplier", () => {
  const costs = readFileSync("src/components/pos/CostWorkspace.tsx", "utf8");
  const view = readFileSync("src/components/pos/SuppliersView.tsx", "utf8");
  const shell = readFileSync("src/components/pos/AppShell.tsx", "utf8");
  const venue = readFileSync("src/components/platform/PlatformTenantVenue.tsx", "utf8");
  assert.doesNotMatch(costs, /SupplierPanel|data-suppliers=/);
  assert.match(costs, /data-invoice-supplier/);
  assert.match(costs, /s\.active === false \? " \(inactive\)"/);
  assert.match(view, /data-suppliers=""/);
  assert.match(view, /data-supplier-kind/);
  assert.match(view, /data-supplier-beverage/);
  assert.match(view, /data-olcc-stores/);
  assert.match(view, /data-olcc-set-state/);
  assert.match(view, /Set the venue state to Oregon\./);
  assert.match(view, /data-olcc-city=\{store\.city\}/);
  assert.match(view, /data-olcc-phone=\{store\.phone\}/);
  assert.doesNotMatch(view, /oregon \? <OlccStores/);
  const formAt = view.indexOf("<SupplierForm");
  const storesAt = view.indexOf("data-olcc-stores");
  const listAt = view.indexOf("<SupplierList");
  assert.ok(formAt >= 0 && storesAt > formAt && listAt > storesAt);
  assert.match(view, /data-set-house-store/);
  assert.match(view, /<OlccSpiritsPanel \/>/);
  assert.match(shell, /id: "suppliers", label: "Suppliers"/);
  assert.match(venue, /tab === "suppliers"/);
  assert.match(venue, /<SuppliersView \/>/);
});

test("picking a house store keeps it after refresh", () => {
  const stores = parseOlccStorePayload(FEATURES);
  const heppner = stores.find((row) => row.city === "Heppner");
  const astoria = stores.find((row) => row.city === "Astoria");
  assert.ok(heppner && astoria);
  const picked = applyHouseStore([], heppner, "sup_house", 1_000);
  const saved = JSON.parse(JSON.stringify({ suppliers: picked })) as { suppliers: typeof picked };
  const restored = suppliersKeptAfterRefresh(saved.suppliers, []);
  const house = restored.find((row) => row.houseStore);
  assert.ok(house);
  assert.equal(house.olccStoreNumber, heppner.storeNumber);
  assert.equal(house.name, "Heppner Liquor Store");
  assert.match(house.address ?? "", /Heppner/);
  assert.equal(house.phone, "(541) 676-9159");
  assert.equal(house?.beverage, "spirits");
  assert.equal(house?.kind, "beverage");
  assert.equal(supplierSendsOrder(house), false);

  const beforeSave = suppliersKeptAfterRefresh([], picked);
  assert.equal(beforeSave.find((row) => row.houseStore)?.olccStoreNumber, heppner.storeNumber);

  const later = applyHouseStore(picked, astoria, "sup_astoria", 2_000);
  const fromServer = suppliersKeptAfterRefresh(later, picked);
  assert.equal(fromServer.filter((row) => row.houseStore).length, 1);
  assert.equal(fromServer.find((row) => row.houseStore)?.olccStoreNumber, astoria.storeNumber);
  const staleLocal = suppliersKeptAfterRefresh(picked, later);
  assert.equal(staleLocal.find((row) => row.houseStore)?.olccStoreNumber, heppner.storeNumber);

  const store = readFileSync("src/lib/costs/store.ts", "utf8");
  const start = store.indexOf("setHouseStore: (store) => {");
  const pick = store.slice(start, store.indexOf("linkInvoiceVendor:", start));
  assert.match(pick, /flushLocationCatalog\("costs"\)/);
  const app = readFileSync("src/components/pos/PosApp.tsx", "utf8");
  assert.match(app, /suppliersKeptAfterRefresh\(pack\?\.suppliers, localSuppliers\)/);
});
