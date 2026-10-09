import { useEffect, useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { listOlccStoresFn, parseCostInvoiceFn } from "@/lib/costs/api";
import { extractPdfStrings } from "@/lib/costs/invoice-parse";
import { locationShowsOlccStores, type OlccStore } from "@/lib/costs/olcc-stores";
import {
  readInvoiceLines,
  type InvoiceReadLine,
  type SupplierOrderDraft,
} from "@/lib/costs/order-match";
import { canCost, costEntityScope } from "@/lib/costs/permissions";
import { useCostStore } from "@/lib/costs/store";
import {
  buildSupplier,
  supplierIsActive,
  supplierSendsOrder,
  supplierTypeLabel,
} from "@/lib/costs/suppliers";
import type { BeverageLine, OrderMatchFlag, OrderMethod, SupplierKind } from "@/lib/costs/types";
import { parseJurisdiction } from "@/lib/pos/jurisdiction";
import { usePosStore } from "@/lib/pos/store";
import { formatCurrency } from "@/lib/utils";
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
          Print the pick list. No order is sent. Upload the store receipt and confirm each line.
        </p>
      ) : null}
      {active ? (
        <SupplierOrder
          supplierId={supplier.id}
          pickList={!supplierSendsOrder(supplier)}
          canEdit={canEdit}
        />
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

const MATCH_LABEL: Record<OrderMatchFlag, string> = {
  match: "Match",
  short: "Short",
  extra: "Extra",
  price: "Price difference",
};

function SupplierOrder({
  supplierId,
  pickList,
  canEdit,
}: {
  supplierId: string;
  pickList: boolean;
  canEdit: boolean;
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const orders = useCostStore((s) => s.pos.filter((po) => po.supplierId === supplierId && po.matchRequired));
  const place = useCostStore((s) => s.placeSupplierOrder);
  const attach = useCostStore((s) => s.attachOrderInvoice);
  const setLine = useCostStore((s) => s.setOrderMatchLine);
  const confirm = useCostStore((s) => s.confirmOrderMatch);
  const canReceive = canCost(emp, "po:receive") || canCost(emp, "invoice:post");
  const [item, setItem] = useState("");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("");
  const [drafts, setDrafts] = useState<SupplierOrderDraft[]>([]);
  const [note, setNote] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = orders.find((po) => po.id === (activeId ?? orders[0]?.id)) ?? orders[0];

  const addLine = () => {
    const expectedPriceCents = Math.round((parseFloat(price) || 0) * 100);
    const next: SupplierOrderDraft = {
      name: item.trim(),
      size: size.trim(),
      qty: parseFloat(qty) || 0,
      expectedPriceCents,
    };
    if (!next.name || !next.size || !(next.qty > 0) || !(expectedPriceCents >= 0) || price.trim() === "") {
      setNote("Item, size, quantity, and expected price are required.");
      return;
    }
    setDrafts((rows) => [...rows, next]);
    setItem("");
    setSize("");
    setQty("1");
    setPrice("");
    setNote("");
  };

  const printOrder = () => {
    const result = place(supplierId, drafts);
    if (!result.ok || !result.html) {
      setNote(result.error ?? "Could not print the order.");
      return;
    }
    setDrafts([]);
    setActiveId(result.poId ?? null);
    setNote(pickList ? "Pick list printed. Status is sent. No order is sent." : "Printed. Status is sent.");
    const page = window.open("", "_blank");
    if (page) {
      page.document.write(result.html);
      page.document.close();
      page.focus();
      page.print();
    }
  };

  const readFile = async (file: File) => {
    if (!active) {
      setNote("Print the order before uploading the invoice.");
      return;
    }
    const name = file.name;
    const lower = name.toLowerCase();
    const isCsv = file.type.includes("csv") || lower.endsWith(".csv") || file.type.startsWith("text/");
    const isPdf = file.type.includes("pdf") || lower.endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read the file."));
      if (isImage) {
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.readAsDataURL(file);
        return;
      }
      if (isPdf) {
        reader.onload = () => resolve(extractPdfStrings(String(reader.result ?? "")));
        reader.readAsDataURL(file);
        return;
      }
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.readAsText(file);
    });
    let lines: InvoiceReadLine[] = [];
    if (isImage || (isPdf && !readInvoiceLines(text).length)) {
      try {
        const extract = await parseCostInvoiceFn({
          data: isImage
            ? { text: name, fileName: name, imageDataUrl: text }
            : { text: text || name, fileName: name },
        });
        lines = extract.lines.map((line) => ({
          name: line.name,
          size: line.packSize || line.unit || "",
          qty: line.qty,
          unitCostCents: line.unitCostCents,
        }));
      } catch {
        lines = readInvoiceLines(text);
      }
    } else if (isCsv || isPdf || text.includes(",")) {
      lines = readInvoiceLines(text);
    } else {
      lines = readInvoiceLines(text);
    }
    const result = attach(active.id, lines, name);
    setNote(result.ok ? "Invoice read. Confirm or correct each line." : result.error ?? "Could not read the invoice.");
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3" data-supplier-order={supplierId}>
      <p className="text-sm font-medium">{pickList ? "Pick list" : "Order"}</p>
      <p className="text-xs text-muted-foreground">
        {pickList
          ? "Item, size, quantity, and expected price. Print the pick list. Status is sent. No order is sent. Nothing is received until the receipt is matched."
          : "Item, size, quantity, and expected price. Print it. Status is sent. Nothing is received until the invoice is matched."}
      </p>
      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Input value={item} placeholder="Item" data-order-item="" onChange={(e) => setItem(e.target.value)} />
          <Input value={size} placeholder="Size" data-order-size="" onChange={(e) => setSize(e.target.value)} />
          <Input value={qty} placeholder="Quantity" data-order-qty="" onChange={(e) => setQty(e.target.value)} />
          <Input
            value={price}
            placeholder="Expected price"
            data-order-price=""
            onChange={(e) => setPrice(e.target.value)}
          />
          <Button type="button" size="sm" variant="outline" data-order-add="" onClick={addLine}>
            Add line
          </Button>
          <Button type="button" size="sm" data-order-print="" disabled={!drafts.length} onClick={printOrder}>
            {pickList ? "Print pick list" : "Print order"}
          </Button>
        </div>
      )}
      {drafts.length > 0 && (
        <ul className="text-xs text-muted-foreground">
          {drafts.map((line, index) => (
            <li key={`${line.name}-${index}`}>
              {line.qty} × {line.name} · {line.size} · {formatCurrency(line.expectedPriceCents)}
            </li>
          ))}
        </ul>
      )}
      {orders.length > 0 && (
        <label className="block text-xs text-muted-foreground">
          Printed orders
          <select
            className={`${FIELD} mt-1`}
            data-order-status={active?.status ?? ""}
            value={active?.id ?? ""}
            onChange={(e) => setActiveId(e.target.value)}
          >
            {orders.map((po) => (
              <option key={po.id} value={po.id}>
                {po.status}
                {po.pickList ? " · pick list" : ""} · {po.lines.length} lines
              </option>
            ))}
          </select>
        </label>
      )}
      {active && !active.matchedAt && (
        <label className="block text-xs text-muted-foreground">
          {pickList ? "Store receipt" : "Invoice photo, PDF, or file"}
          <input
            type="file"
            accept="image/*,.pdf,.csv,text/plain,text/csv"
            className="mt-1 block text-xs"
            data-order-invoice=""
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void readFile(file);
            }}
          />
        </label>
      )}
      {active?.matchLines && active.matchLines.length > 0 && (
        <ul className="space-y-2">
          {active.matchLines.map((line) => (
            <li key={line.id} className="rounded-xl border border-border p-2 text-sm" data-match-line={line.id}>
              <p className="font-medium">{line.item}</p>
              <p className="text-xs text-muted-foreground">
                {line.size ? `${line.size} · ` : ""}
                Order {line.orderQty} @ {formatCurrency(line.orderPriceCents)} · Invoice {line.invoiceQty} @{" "}
                {formatCurrency(line.invoicePriceCents)}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {line.flags.map((flag) => (
                  <Badge key={flag} variant={flag === "match" ? "success" : "warn"} data-match-flag={flag}>
                    {MATCH_LABEL[flag]}
                  </Badge>
                ))}
              </div>
              {!active.matchedAt && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Input
                    className="h-8 w-20"
                    value={String(line.confirmQty)}
                    data-match-qty=""
                    onChange={(e) =>
                      setLine(active.id, line.id, { confirmQty: parseFloat(e.target.value) || 0 })
                    }
                  />
                  <Input
                    className="h-8 w-24"
                    value={(line.confirmPriceCents / 100).toFixed(2)}
                    data-match-price=""
                    onChange={(e) =>
                      setLine(active.id, line.id, {
                        confirmPriceCents: Math.round((parseFloat(e.target.value) || 0) * 100),
                      })
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant={line.decision === "confirm" ? "default" : "outline"}
                    data-match-confirm=""
                    onClick={() => setLine(active.id, line.id, { decision: "confirm" })}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={line.decision === "reject" ? "default" : "outline"}
                    data-match-reject=""
                    onClick={() => setLine(active.id, line.id, { decision: "reject" })}
                  >
                    Reject
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {active && !active.matchedAt && active.matchLines && active.matchLines.length > 0 && canReceive && (
        <Button
          type="button"
          size="sm"
          data-order-receive=""
          onClick={() => {
            const lines = active.matchLines ?? [];
            if (lines.some((line) => line.decision === "pending")) {
              setNote("Confirm or reject each line.");
              return;
            }
            const result = confirm(active.id);
            setNote(
              result.ok
                ? `Received ${result.received ?? 0} line${result.received === 1 ? "" : "s"}. Rejected lines stay out of inventory.`
                : result.error ?? "Could not receive.",
            );
          }}
        >
          Receive confirmed lines
        </Button>
      )}
      {note ? <p className="text-xs text-primary">{note}</p> : null}
    </div>
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
        spirits supplier. The price list and Oregon Liquor Search stay on it. Print the pick list. No order is sent.
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
