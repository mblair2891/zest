import { useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { listOlccStoresFn } from "@/lib/costs/api";
import { locationShowsOlccStores, type OlccStore } from "@/lib/costs/olcc-stores";
import { canCost, costEntityScope } from "@/lib/costs/permissions";
import { useCostStore } from "@/lib/costs/store";
import {
  buildSupplier,
  supplierIsActive,
  supplierTypeLabel,
} from "@/lib/costs/suppliers";
import type { BeverageLine, OrderMethod, SupplierKind } from "@/lib/costs/types";
import { parseJurisdiction } from "@/lib/pos/jurisdiction";
import { usePosStore } from "@/lib/pos/store";
import { OlccSpiritsPanel } from "./OlccSpiritsPanel";

const FIELD = "h-9 w-full rounded-xl border border-border bg-bg px-2 text-sm";

const ORDER_METHODS: Array<[OrderMethod, string]> = [
  ["email", "Email"],
  ["portal", "Portal"],
  ["api", "API"],
];

export function SuppliersView() {
  const state = usePosStore((s) => parseJurisdiction(s.settings.jurisdiction).state);
  const oregon = locationShowsOlccStores(state);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const suppliers = useCostStore((s) => s.suppliers);
  const canEdit = canCost(emp, "po:create");

  return (
    <div className="flex h-full flex-col" data-suppliers="">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Suppliers</h2>
          <GuideLearnLink topicId="suppliers" compact>
            Learn
          </GuideLearnLink>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Food or beverage. A beverage supplier is beer, wine, or spirits. Deactivate keeps past invoices.
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <SupplierForm canEdit={canEdit} entityId={costEntityScope(emp)} />
        <SupplierList canEdit={canEdit} />
        {oregon ? <OlccStores canEdit={canEdit} suppliers={suppliers} /> : null}
      </div>
    </div>
  );
}

function SupplierForm({
  canEdit,
  entityId,
}: {
  canEdit: boolean;
  entityId: string | null;
}) {
  const upsert = useCostStore((s) => s.upsertSupplier);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<SupplierKind>("food");
  const [beverage, setBeverage] = useState<BeverageLine>("beer");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [orderMethod, setOrderMethod] = useState<OrderMethod>("email");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  if (!canEdit) {
    return (
      <p className="text-xs text-muted-foreground">
        Owner, manager, or operator can add a supplier.
      </p>
    );
  }

  return (
    <form
      className="grid gap-2 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-2"
      data-supplier-form=""
      onSubmit={(event) => {
        event.preventDefault();
        const built = buildSupplier(
          {
            name,
            kind,
            beverage: kind === "beverage" ? beverage : undefined,
            contactName,
            phone,
            email,
            accountNumber,
            orderMethod,
            notes,
            entityIds: entityId ? [entityId] : [],
          },
          "new",
        );
        if (!built.ok) {
          setError(built.error);
          return;
        }
        const id = upsert({
          name: built.supplier.name,
          kind: built.supplier.kind,
          beverage: built.supplier.beverage,
          contactName: built.supplier.contactName,
          phone: built.supplier.phone,
          email: built.supplier.email,
          accountNumber: built.supplier.accountNumber,
          orderMethod: built.supplier.orderMethod,
          notes: built.supplier.notes,
          contacts: built.supplier.contacts,
          connectorId: built.supplier.connectorId,
          category: built.supplier.category,
          entityIds: built.supplier.entityIds,
        });
        if (!id) {
          setError("Supplier was not saved.");
          return;
        }
        setName("");
        setContactName("");
        setPhone("");
        setEmail("");
        setAccountNumber("");
        setNotes("");
        setError("");
      }}
    >
      <label className="text-xs text-muted-foreground sm:col-span-2">
        Name
        <Input
          className="mt-1"
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-supplier-name=""
          required
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Type
        <select
          className={`mt-1 ${FIELD}`}
          value={kind}
          data-supplier-kind=""
          onChange={(e) => setKind(e.target.value === "beverage" ? "beverage" : "food")}
        >
          <option value="food">Food</option>
          <option value="beverage">Beverage</option>
        </select>
      </label>
      {kind === "beverage" ? (
        <label className="text-xs text-muted-foreground">
          Beverage
          <select
            className={`mt-1 ${FIELD}`}
            value={beverage}
            data-supplier-beverage=""
            onChange={(e) => setBeverage(e.target.value as BeverageLine)}
          >
            <option value="beer">Beer</option>
            <option value="wine">Wine</option>
            <option value="spirits">Spirits</option>
          </select>
        </label>
      ) : (
        <span />
      )}
      <label className="text-xs text-muted-foreground">
        Contact
        <Input
          className="mt-1"
          value={contactName}
          onChange={(e) => setContactName(e.target.value)}
          data-supplier-contact=""
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Phone
        <Input
          className="mt-1"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          data-supplier-phone=""
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Email
        <Input
          className="mt-1"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          data-supplier-email=""
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Account number
        <Input
          className="mt-1"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          data-supplier-account=""
        />
      </label>
      <label className="text-xs text-muted-foreground">
        Order method
        <select
          className={`mt-1 ${FIELD}`}
          value={orderMethod}
          data-supplier-method=""
          onChange={(e) => setOrderMethod(e.target.value as OrderMethod)}
        >
          {ORDER_METHODS.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-muted-foreground sm:col-span-2">
        Notes
        <textarea
          className="mt-1 min-h-20 w-full rounded-xl border border-border bg-bg px-2 py-2 text-sm"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-supplier-notes=""
        />
      </label>
      {error ? (
        <p className="text-sm text-danger sm:col-span-2" data-supplier-error="">
          {error}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <Button type="submit" data-supplier-add="">
          Add supplier
        </Button>
      </div>
    </form>
  );
}

function SupplierList({ canEdit }: { canEdit: boolean }) {
  const suppliers = useCostStore((s) => s.suppliers);
  const setActive = useCostStore((s) => s.setSupplierActive);
  const ordered = useMemo(() => {
    const active = suppliers.filter(supplierIsActive);
    const inactive = suppliers.filter((supplier) => !supplierIsActive(supplier));
    return {
      active: [...active.filter((s) => s.houseStore), ...active.filter((s) => !s.houseStore)],
      inactive,
    };
  }, [suppliers]);

  return (
    <div className="space-y-3" data-supplier-list="">
      {ordered.active.map((supplier) => (
        <SupplierCard
          key={supplier.id}
          id={supplier.id}
          canEdit={canEdit}
          onDeactivate={() => setActive(supplier.id, false)}
        />
      ))}
      {ordered.inactive.length > 0 && (
        <div className="space-y-2" data-suppliers-inactive="">
          <p className="text-xs font-medium text-muted-foreground">Inactive. Past invoices stay.</p>
          {ordered.inactive.map((supplier) => (
            <SupplierCard
              key={supplier.id}
              id={supplier.id}
              canEdit={canEdit}
              onActivate={() => setActive(supplier.id, true)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SupplierCard({
  id,
  canEdit,
  onDeactivate,
  onActivate,
}: {
  id: string;
  canEdit: boolean;
  onDeactivate?: () => void;
  onActivate?: () => void;
}) {
  const supplier = useCostStore((s) => s.suppliers.find((row) => row.id === id));
  if (!supplier) return null;
  const active = supplierIsActive(supplier);
  const method =
    supplier.orderMethod === "api" ? "API" : supplier.orderMethod === "portal" ? "Portal" : "Email";
  return (
    <article className="rounded-2xl border border-border bg-surface p-4" data-supplier={supplier.id}>
      <div className="flex flex-wrap items-center gap-2">
        <Truck className="h-4 w-4 text-muted-foreground" />
        <p className="font-medium">{supplier.name}</p>
        <Badge variant="secondary">{supplierTypeLabel(supplier)}</Badge>
        {supplier.houseStore ? <Badge>House store</Badge> : null}
        {!active ? <Badge variant="outline">Inactive</Badge> : null}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {[supplier.contactName, supplier.phone || supplier.contacts[0]?.phone, supplier.email || supplier.contacts[0]?.email]
          .filter(Boolean)
          .join(" · ") || "No contact yet"}
        {supplier.accountNumber ? ` · Account ${supplier.accountNumber}` : ""}
        {` · ${method}`}
      </p>
      {supplier.address ? <p className="mt-1 text-xs text-muted-foreground">{supplier.address}</p> : null}
      {supplier.notes ? <p className="mt-1 text-sm">{supplier.notes}</p> : null}
      {supplier.houseStore ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No order is sent. Costs still receives an invoice photo for the bottles.
        </p>
      ) : null}
      {canEdit && active && onDeactivate ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          data-supplier-deactivate={supplier.id}
          onClick={onDeactivate}
        >
          Deactivate
        </Button>
      ) : null}
      {canEdit && !active && onActivate ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          data-supplier-activate={supplier.id}
          onClick={onActivate}
        >
          Activate
        </Button>
      ) : null}
      {supplier.houseStore ? (
        <div className="mt-3" data-house-store={supplier.olccStoreNumber || supplier.id}>
          <OlccSpiritsPanel />
        </div>
      ) : null}
    </article>
  );
}

function OlccStores({
  canEdit,
  suppliers,
}: {
  canEdit: boolean;
  suppliers: Array<{ houseStore?: boolean; olccStoreNumber?: string }>;
}) {
  const setHouseStore = useCostStore((s) => s.setHouseStore);
  const [stores, setStores] = useState<OlccStore[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading liquor stores…");
  const houseNumber = suppliers.find((supplier) => supplier.houseStore)?.olccStoreNumber ?? "";

  useEffect(() => {
    let cancel = false;
    void listOlccStoresFn()
      .then((res) => {
        if (cancel) return;
        setStores(res.stores);
        setStatus(res.stores.length ? "" : "The OLCC store list is empty.");
      })
      .catch(() => {
        if (!cancel) setStatus("The OLCC store list did not load.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter((store) =>
      `${store.name} ${store.address} ${store.phone} ${store.city} ${store.storeNumber}`
        .toLowerCase()
        .includes(q),
    );
  }, [stores, query]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4" data-olcc-stores="">
      <h3 className="text-sm font-semibold">OLCC liquor stores</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Store name, address, and phone from the public OLCC store list. Pick the house store. That store is the
        spirits supplier. The price list and Oregon Liquor Search stay on it. No order is sent.
      </p>
      <Input
        className="mt-2"
        value={query}
        placeholder="City, store, or phone"
        data-olcc-store-query=""
        onChange={(e) => setQuery(e.target.value)}
      />
      {status ? <p className="mt-2 text-xs text-primary">{status}</p> : null}
      <ul className="mt-2 max-h-80 space-y-1 overflow-y-auto">
        {shown.map((store) => {
          const current = store.storeNumber === houseNumber;
          return (
            <li
              key={store.storeNumber}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-2 py-2 text-sm"
              data-olcc-store={store.storeNumber}
            >
              <span>
                <span className="font-medium">{store.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {store.address}
                  {store.phone ? ` · ${store.phone}` : ""}
                </span>
              </span>
              {current ? (
                <Badge data-house-store-badge={store.storeNumber}>House store</Badge>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!canEdit}
                  data-set-house-store={store.storeNumber}
                  onClick={() => setHouseStore(store)}
                >
                  Set as house store
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {stores.length > 0 && shown.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No stores match.</p>
      ) : null}
    </section>
  );
}
