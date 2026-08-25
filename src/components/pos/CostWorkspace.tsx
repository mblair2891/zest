import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Brain,
  ClipboardList,
  FileUp,
  Package,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { useCostStore } from "@/lib/costs/store";
import { canCost, canSeeEntity, costEntityScope } from "@/lib/costs/permissions";
import { parseCostInvoiceFn, costPictureFn, sendCostPoEmailFn } from "@/lib/costs/api";
import { downloadText, poPrintHtml } from "@/lib/costs/connectors";
import { heuristicInvoiceExtract } from "@/lib/costs/invoice-parse";
import { recipeCostCents } from "@/lib/costs/theoretical";
import {
  COST_CATEGORIES,
  COST_CATEGORY_LABEL,
  VARIANCE_RESPONSE_CODES,
  VARIANCE_RESPONSE_LABEL,
  type CostCategory,
  type VarianceResponseCode,
} from "@/lib/costs/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type CostTab =
  | "board"
  | "invoices"
  | "recipes"
  | "counts"
  | "alerts"
  | "suppliers"
  | "orders"
  | "prices";

const TABS: Array<[CostTab, string]> = [
  ["board", "Cost picture"],
  ["invoices", "Invoices"],
  ["recipes", "Recipes"],
  ["counts", "Counts & waste"],
  ["alerts", "Exceptions"],
  ["suppliers", "Suppliers"],
  ["orders", "POs"],
  ["prices", "Price recs"],
];

export function CostWorkspace({ initialTab = "board" }: { initialTab?: CostTab }) {
  const [tab, setTab] = useState<CostTab>(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const openEx = useCostStore((s) => s.exceptions.filter((e) => e.status === "open").length);

  return (
    <div className="flex h-full flex-col" data-demo="cost-control">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Cost control</h2>
          <GuideLearnLink topicId="cost-control" compact>
            Learn
          </GuideLearnLink>
          {openEx > 0 && (
            <Badge variant="warn" className="tabular">
              {openEx} open exceptions
            </Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Invoice → stock → theoretical use → variance → PO → price recs. Flags
          recommend; they do not accuse. Confirm every post and price.
        </p>
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {TABS.map(([id, label]) => (
            <Button
              key={id}
              size="sm"
              variant={tab === id ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setTab(id)}
            >
              {label}
              {id === "alerts" && openEx > 0 ? ` (${openEx})` : ""}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "board" && <BoardPanel />}
        {tab === "invoices" && <InvoicePanel />}
        {tab === "recipes" && <RecipePanel />}
        {tab === "counts" && <CountPanel />}
        {tab === "alerts" && <AlertPanel />}
        {tab === "suppliers" && <SupplierPanel />}
        {tab === "orders" && <PoPanel />}
        {tab === "prices" && <PricePanel />}
      </div>
    </div>
  );
}

function entityLabel(
  id: string,
  vendors: { id: string; shortName: string; name: string }[],
  house: string,
) {
  if (id === HOST_SCOPE) return house || "Host";
  return vendors.find((v) => v.id === id)?.shortName ?? id;
}

function BoardPanel() {
  const picture = useCostStore((s) => s.lastPicture);
  const build = useCostStore((s) => s.buildCostPicture);
  const scan = useCostStore((s) => s.scanVariance);
  const generate = useCostStore((s) => s.generatePriceRecs);
  const exceptions = useCostStore((s) => s.exceptions.filter((e) => e.status === "open"));
  const ledger = useCostStore((s) => s.ledger);
  const [busy, setBusy] = useState(false);

  const spendByCat = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of ledger) m[e.category] = (m[e.category] ?? 0) + e.amountCents;
    return m;
  }, [ledger]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            scan(7);
            generate(14);
            const pic = build(7);
            setBusy(true);
            void costPictureFn({
              data: {
                prompt: `COGS ${pic.cogsPct}% sales ${pic.salesCents} variance ${pic.varianceCents} open ${pic.openExceptions} labor ${pic.laborPct}`,
              },
            })
              .then((r) => build(7, r.text))
              .finally(() => setBusy(false));
          }}
        >
          <Brain className="h-3.5 w-3.5" />
          {busy ? "Reading…" : "Run cost picture"}
        </Button>
      </div>
      {picture && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <Badge variant={picture.source === "ai" ? "info" : "secondary"}>
            {picture.source === "ai" ? "AI" : "Guided"}
          </Badge>
          <p className="mt-2 text-sm">{picture.narrative}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            <Stat label="COGS %" value={picture.cogsPct == null ? "—" : `${picture.cogsPct}%`} />
            <Stat label="Sales" value={formatCurrency(picture.salesCents)} />
            <Stat label="Spend" value={formatCurrency(picture.cogsCents)} />
            <Stat
              label="Labor %"
              value={picture.laborPct == null ? "—" : `${picture.laborPct}%`}
            />
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {COST_CATEGORIES.map((c) => (
          <div key={c} className="rounded-xl border border-border bg-surface px-3 py-2">
            <p className="text-[11px] text-muted-foreground">{COST_CATEGORY_LABEL[c]}</p>
            <p className="tabular text-sm font-medium">
              {formatCurrency(spendByCat[c] ?? 0)}
            </p>
          </div>
        ))}
      </div>
      {exceptions.length > 0 && (
        <div className="rounded-2xl border border-warn/40 bg-surface p-4">
          <p className="text-sm font-medium">Open exceptions</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {exceptions.slice(0, 6).map((e) => (
              <li key={e.id}>
                {e.skuName} · {e.severity} · {e.kind.replace("_", " ")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="tabular text-lg font-semibold">{value}</p>
    </div>
  );
}

function InvoicePanel() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const vendors = usePosStore((s) => s.vendors);
  const house = usePosStore((s) => s.settings.name);
  const skus = useCostStore((s) => s.skus);
  const invoices = useCostStore((s) => s.invoices);
  const suppliers = useCostStore((s) => s.suppliers);
  const createDraft = useCostStore((s) => s.createInvoiceDraft);
  const mapLine = useCostStore((s) => s.mapInvoiceLine);
  const post = useCostStore((s) => s.postInvoice);
  const upsertSku = useCostStore((s) => s.upsertSku);
  const linkVendor = useCostStore((s) => s.linkInvoiceVendor);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [image, setImage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(invoices[0]?.id ?? null);
  const active = invoices.find((i) => i.id === activeId) ?? invoices[0];
  const canPost = canCost(emp, "invoice:post");

  const runExtract = async () => {
    setBusy(true);
    setErr(null);
    try {
      const extract = await parseCostInvoiceFn({
        data: { text: text || fileName || "", fileName, imageDataUrl: image },
      }).catch(() => heuristicInvoiceExtract(text, fileName));
      const id = createDraft(extract);
      setActiveId(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not read invoice");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Upload or paste</p>
        <input
          type="file"
          accept="image/*,.pdf,text/plain"
          className="text-xs"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFileName(f.name);
            const reader = new FileReader();
            reader.onload = () => {
              const url = String(reader.result ?? "");
              if (f.type.startsWith("image/")) setImage(url);
              else if (f.type.startsWith("text/")) setText(url);
              else setImage(undefined);
            };
            if (f.type.startsWith("image/") || f.type.startsWith("text/")) reader.readAsDataURL(f);
            else {
              setImage(undefined);
              setText((t) => t || `PDF ${f.name}`);
            }
          }}
        />
        <VoiceTextarea
          value={text}
          onChange={setText}
          rows={5}
          placeholder="Paste invoice text, or describe: Southern Glazer's, 6 Tito's 1.75L @ $28.99"
        />
        <Button disabled={busy || !canPost} onClick={() => void runExtract()}>
          <FileUp className="h-3.5 w-3.5" />
          {busy ? "Extracting…" : "Extract"}
        </Button>
        {!canPost && (
          <p className="text-xs text-muted-foreground">Owner, manager, accountant, or operator can post.</p>
        )}
        {err && <p className="text-sm text-danger">{err}</p>}
        <ul className="space-y-1 text-xs">
          {invoices.slice(0, 8).map((i) => (
            <li key={i.id}>
              <button
                type="button"
                className={cn("w-full rounded-lg px-2 py-1 text-left", i.id === active?.id && "bg-bg")}
                onClick={() => setActiveId(i.id)}
              >
                {i.vendorName} · {i.invoiceNumber} · {i.status}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {active && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{active.vendorName}</p>
            <Badge variant="secondary">{active.status}</Badge>
            <span className="text-xs text-muted-foreground">{active.invoiceNumber}</span>
          </div>
          <label className="text-xs text-muted-foreground">
            Supplier record
            <select
              className="mt-1 h-9 w-full rounded-xl border border-border bg-bg px-2 text-sm"
              value={active.supplierId ?? ""}
              onChange={(e) => linkVendor(active.id, e.target.value)}
            >
              <option value="">Unlinked</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <ul className="space-y-2">
            {active.lines.map((l) => (
              <li key={l.id} className="rounded-xl border border-border p-2 text-sm">
                <p className="font-medium">{l.rawName}</p>
                <p className="text-xs text-muted-foreground">
                  {l.qty} × {formatCurrency(l.unitCostCents)}
                  {l.packSize ? ` · ${l.packSize}` : ""}
                </p>
                <div className="mt-1 grid gap-1 sm:grid-cols-3">
                  <select
                    className="h-9 rounded-lg border border-border bg-bg px-2 text-xs"
                    value={l.skuId ?? ""}
                    onChange={(e) => {
                      if (e.target.value === "__new") {
                        const id = upsertSku({
                          name: l.rawName,
                          category: l.category,
                          entityId: l.entityId,
                          costCents: l.unitCostCents,
                          unit: "bottle",
                          packSize: 1750,
                          packLabel: "ml",
                        });
                        mapLine(active.id, l.id, { skuId: id });
                        return;
                      }
                      mapLine(active.id, l.id, { skuId: e.target.value || undefined });
                    }}
                  >
                    <option value="">Map SKU</option>
                    {skus.filter((s) => canSeeEntity(emp, s.entityId)).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                    <option value="__new">Create SKU from this line</option>
                  </select>
                  <select
                    className="h-9 rounded-lg border border-border bg-bg px-2 text-xs"
                    value={l.category}
                    onChange={(e) =>
                      mapLine(active.id, l.id, { category: e.target.value as CostCategory })
                    }
                  >
                    {COST_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {COST_CATEGORY_LABEL[c]}
                      </option>
                    ))}
                  </select>
                  <select
                    className="h-9 rounded-lg border border-border bg-bg px-2 text-xs"
                    value={l.entityId}
                    onChange={(e) => mapLine(active.id, l.id, { entityId: e.target.value })}
                  >
                    <option value={HOST_SCOPE}>{house || "Host"}</option>
                    {vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.shortName}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
          {active.status !== "posted" && (
            <Button
              onClick={() => {
                const r = post(active.id);
                if (!r.ok) setErr(r.error ?? "Post failed");
              }}
            >
              Post receipt + GL
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function RecipePanel() {
  const menuItems = usePosStore((s) => s.menuItems);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const skus = useCostStore((s) => s.skus);
  const recipes = useCostStore((s) => s.recipes);
  const upsert = useCostStore((s) => s.upsertRecipe);
  const scope = costEntityScope(emp);
  const [menuItemId, setMenuItemId] = useState(menuItems[0]?.id ?? "");
  const [skuId, setSkuId] = useState(skus[0]?.id ?? "");
  const [qty, setQty] = useState("45");
  const [unit, setUnit] = useState("ml");
  const [waste, setWaste] = useState("0.03");
  const item = menuItems.find((m) => m.id === menuItemId);
  const existing = recipes.find((r) => r.menuItemId === menuItemId);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Yield per sale</p>
        <select
          className="h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
          value={menuItemId}
          onChange={(e) => setMenuItemId(e.target.value)}
        >
          {menuItems
            .filter((m) => !scope || !m.vendorId || m.vendorId === scope)
            .map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
        </select>
        <div className="grid grid-cols-3 gap-2">
          <select
            className="col-span-2 h-10 rounded-xl border border-border bg-bg px-2 text-sm"
            value={skuId}
            onChange={(e) => setSkuId(e.target.value)}
          >
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Input value={qty} onChange={(e) => setQty(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="ml / oz / ea" />
          <Input value={waste} onChange={(e) => setWaste(e.target.value)} placeholder="waste factor" />
        </div>
        <Button
          onClick={() => {
            if (!item || !skuId) return;
            const lines = [...(existing?.lines ?? [])];
            const hit = lines.find((l) => l.skuId === skuId);
            const q = parseFloat(qty) || 0;
            if (hit) hit.qty = q;
            else lines.push({ skuId, qty: q, unit });
            upsert({
              id: existing?.id,
              menuItemId: item.id,
              name: item.name,
              entityId: item.vendorId || HOST_SCOPE,
              wasteFactor: parseFloat(waste) || 0,
              lines,
            });
          }}
        >
          Save recipe line
        </Button>
      </div>
      <div className="space-y-2">
        {recipes.map((r) => {
          const cost = recipeCostCents(r, skus);
          const mi = menuItems.find((m) => m.id === r.menuItemId);
          const pct =
            mi && mi.priceCents ? Math.round((cost / mi.priceCents) * 1000) / 10 : null;
          return (
            <div key={r.id} className="rounded-2xl border border-border bg-surface p-4 text-sm">
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                Plate {formatCurrency(cost)}
                {mi ? ` · sell ${formatCurrency(mi.priceCents)}` : ""}
                {pct != null ? ` · ${pct}% cost` : ""}
                {` · waste ${(r.wasteFactor * 100).toFixed(0)}%`}
              </p>
              <ul className="mt-1 text-xs text-muted-foreground">
                {r.lines.map((l) => (
                  <li key={l.skuId}>
                    {l.qty}
                    {l.unit} {skus.find((s) => s.id === l.skuId)?.name ?? l.skuId}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {recipes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Attach SKUs to a menu item (e.g. 45ml Tito’s per vodka highball).
          </p>
        )}
      </div>
    </div>
  );
}

function CountPanel() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const skus = useCostStore((s) => s.skus);
  const runCount = useCostStore((s) => s.runCount);
  const logWaste = useCostStore((s) => s.logWaste);
  const waste = useCostStore((s) => s.waste);
  const [qty, setQty] = useState<Record<string, string>>({});
  const visible = skus.filter((s) => canSeeEntity(emp, s.entityId));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Count</p>
        <div className="space-y-2">
          {visible.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="min-w-40 flex-1">{s.name}</span>
              <span className="text-xs text-muted-foreground">on hand {s.onHand}</span>
              <Input
                className="h-8 w-20"
                value={qty[s.id] ?? ""}
                placeholder={String(s.onHand)}
                onChange={(e) => setQty((m) => ({ ...m, [s.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              const lines = visible
                .map((s) => ({
                  skuId: s.id,
                  qty: parseFloat(qty[s.id] ?? "") ,
                }))
                .filter((l) => Number.isFinite(l.qty));
              if (lines.length) runCount(lines.length === visible.length ? "full" : "partial", lines);
            }}
          >
            Post count
          </Button>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <p className="mb-2 text-sm font-medium">Waste / breakage</p>
        <WasteForm skus={visible} onLog={logWaste} />
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {waste.slice(0, 8).map((w) => (
            <li key={w.id}>
              {w.userName} · {w.qty} · {w.reason} · {formatDateTime(w.at)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function WasteForm({
  skus,
  onLog,
}: {
  skus: { id: string; name: string }[];
  onLog: (id: string, qty: number, reason: string) => void;
}) {
  const [skuId, setSkuId] = useState(skus[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("breakage");
  return (
    <div className="flex flex-wrap gap-2">
      <select
        className="h-9 rounded-xl border border-border bg-bg px-2 text-sm"
        value={skuId}
        onChange={(e) => setSkuId(e.target.value)}
      >
        {skus.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <Input className="h-9 w-20" value={qty} onChange={(e) => setQty(e.target.value)} />
      <Input className="h-9 w-40" value={reason} onChange={(e) => setReason(e.target.value)} />
      <Button
        size="sm"
        variant="outline"
        onClick={() => onLog(skuId, parseFloat(qty) || 0, reason)}
      >
        Log waste
      </Button>
    </div>
  );
}

function AlertPanel() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const exceptions = useCostStore((s) => s.exceptions);
  const respond = useCostStore((s) => s.respondException);
  const scan = useCostStore((s) => s.scanVariance);
  const [note, setNote] = useState<Record<string, string>>({});
  const [code, setCode] = useState<Record<string, VarianceResponseCode>>({});
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <Button size="sm" variant="outline" onClick={() => scan(7)}>
        Scan last 7 days
      </Button>
      {err && <p className="text-sm text-danger">{err}</p>}
      {exceptions.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No variance items. Post an invoice and sell recipe items, then scan.
        </p>
      )}
      {exceptions.map((e) => (
        <div key={e.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warn" />
            <p className="font-medium">{e.skuName}</p>
            <Badge variant={e.severity === "urgent" ? "danger" : e.severity === "watch" ? "warn" : "info"}>
              {e.severity}
            </Badge>
            <Badge variant="secondary">{e.status}</Badge>
          </div>
          <p className="mt-1 text-sm">{e.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Receipts {e.evidence.receiptsQty} · theoretical {e.evidence.theoretical} · expected{" "}
            {e.evidence.expected}
            {e.evidence.actual != null ? ` · actual ${e.evidence.actual}` : ""} · sales{" "}
            {e.evidence.salesQty}
          </p>
          {e.status === "open" ? (
            <div className="mt-2 space-y-2">
              <select
                className="h-9 rounded-xl border border-border bg-bg px-2 text-sm"
                value={code[e.id] ?? "investigating"}
                onChange={(ev) =>
                  setCode((m) => ({ ...m, [e.id]: ev.target.value as VarianceResponseCode }))
                }
              >
                {VARIANCE_RESPONSE_CODES.map((c) => (
                  <option key={c} value={c}>
                    {VARIANCE_RESPONSE_LABEL[c]}
                  </option>
                ))}
              </select>
              <VoiceTextarea
                value={note[e.id] ?? ""}
                onChange={(v) => setNote((m) => ({ ...m, [e.id]: v }))}
                rows={2}
                placeholder="Required note — cannot dismiss silently"
              />
              <Button
                size="sm"
                onClick={() => {
                  const r = respond(e.id, code[e.id] ?? "investigating", note[e.id] ?? "");
                  if (!r.ok) setErr(r.error ?? "Response failed");
                  else setErr(null);
                }}
                disabled={!canCost(emp, "alert:respond")}
              >
                Record response
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">
              {e.response?.byName}: {VARIANCE_RESPONSE_LABEL[e.response?.code ?? "other"]} —{" "}
              {e.response?.note}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function SupplierPanel() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const vendors = usePosStore((s) => s.vendors);
  const house = usePosStore((s) => s.settings.name);
  const suppliers = useCostStore((s) => s.suppliers);
  const skus = useCostStore((s) => s.skus);
  const upsert = useCostStore((s) => s.upsertSupplier);
  const upsertSku = useCostStore((s) => s.upsertSku);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const scope = costEntityScope(emp);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-surface p-4">
        <Input placeholder="Supplier name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Order email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button
          onClick={() => {
            if (!name.trim()) return;
            upsert({
              name: name.trim(),
              contacts: email ? [{ name: "Orders", email }] : [],
              entityIds: scope ? [scope] : [],
            });
            setName("");
            setEmail("");
          }}
        >
          Add supplier
        </Button>
      </div>
      {suppliers.map((s) => (
        <div key={s.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Truck className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">{s.name}</p>
            <Badge variant="secondary">{s.connectorId === "api_stub" ? "API stub" : "Email/CSV"}</Badge>
            <span className="text-xs text-muted-foreground">
              {s.terms} · {s.accountNumber || "no account #"} · {s.contacts[0]?.email}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Scope:{" "}
            {s.entityIds.length
              ? s.entityIds.map((id) => entityLabel(id, vendors, house)).join(", ")
              : "House-wide"}
          </p>
          <ul className="mt-2 text-xs text-muted-foreground">
            {skus
              .filter((k) => k.supplierId === s.id)
              .map((k) => (
                <li key={k.id}>
                  {k.name} · last {formatCurrency(k.costCents)} · par {k.par} ·{" "}
                  {k.supplierSku ?? "no supplier SKU"}
                </li>
              ))}
          </ul>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => {
              const first = skus.find((k) => !k.supplierId);
              if (first) upsertSku({ ...first, supplierId: s.id });
            }}
          >
            Attach unassigned SKU
          </Button>
        </div>
      ))}
    </div>
  );
}

function PoPanel() {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const house = usePosStore((s) => s.settings.name);
  const suppliers = useCostStore((s) => s.suppliers);
  const pos = useCostStore((s) => s.pos);
  const draft = useCostStore((s) => s.draftPoFromPar);
  const approve = useCostStore((s) => s.approvePo);
  const send = useCostStore((s) => s.sendPo);
  const receive = useCostStore((s) => s.receivePo);
  const [flash, setFlash] = useState<string | null>(null);
  const [override, setOverride] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {suppliers.map((s) => (
          <Button
            key={s.id}
            size="sm"
            variant="outline"
            onClick={() => {
              const r = draft(s.id, {
                overrideOpenException: override,
                entityId: costEntityScope(emp) ?? HOST_SCOPE,
              });
              setFlash(r.ok ? `Drafted ${s.name}` : r.error ?? "No draft");
            }}
          >
            Draft PAR PO · {s.name}
          </Button>
        ))}
        <label className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => setOverride(e.target.checked)}
          />
          Override open variance (do not reorder flagged SKUs unless checked)
        </label>
      </div>
      {flash && <p className="text-xs text-primary">{flash}</p>}
      {pos.map((p) => (
        <div key={p.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{p.supplierName}</p>
              <p className="text-xs text-muted-foreground">
                {p.lines.length} lines · {formatCurrency(p.totalCents)} · {p.status}
              </p>
            </div>
            <Badge variant={p.status === "received" ? "success" : "secondary"}>{p.status}</Badge>
          </div>
          <ul className="mt-2 text-sm text-muted-foreground">
            {p.lines.map((l) => (
              <li key={l.skuId}>
                {l.qty}× {l.name} @ {formatCurrency(l.unitCostCents)} · recv {l.receivedQty}
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2">
            {p.status === "pending_approval" && canCost(emp, "po:approve") && (
              <Button size="sm" onClick={() => approve(p.id)}>
                Approve
              </Button>
            )}
            {(p.status === "draft" || p.status === "pending_approval") && p.status !== "pending_approval" && (
              <Button
                size="sm"
                onClick={() => {
                  const r = send(p.id);
                  if (r.csv) downloadText(`PO-${p.id}.csv`, r.csv);
                  if (r.ok) {
                    const html = poPrintHtml(p, house);
                    const w = window.open("", "_blank");
                    if (w) {
                      w.document.write(html);
                      w.document.close();
                    }
                    const email = useCostStore
                      .getState()
                      .suppliers.find((s) => s.id === p.supplierId)?.contacts[0]?.email;
                    if (email && r.csv) {
                      void sendCostPoEmailFn({
                        data: {
                          to: email,
                          subject: `PO ${p.id} · ${house}`,
                          text: `Purchase order ${p.id} from ${house}.`,
                          csv: r.csv,
                        },
                      }).then((res) => setFlash(`Send: ${res.status}`));
                    }
                    setFlash(r.detail ?? "Sent");
                  } else setFlash(r.error ?? "Send failed");
                }}
              >
                Send email / CSV
              </Button>
            )}
            {(p.status === "sent" || p.status === "partial") && canCost(emp, "po:receive") && (
              <Button
                size="sm"
                onClick={() =>
                  receive(
                    p.id,
                    p.lines.map((l) => ({
                      skuId: l.skuId,
                      qty: Math.max(0, l.qty - l.receivedQty),
                    })),
                  )
                }
              >
                Receive remaining
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PricePanel() {
  const recs = useCostStore((s) => s.priceRecs);
  const generate = useCostStore((s) => s.generatePriceRecs);
  const accept = useCostStore((s) => s.acceptPriceRec);
  const dismiss = useCostStore((s) => s.dismissPriceRec);
  const setView = usePosStore((s) => s.setView);
  const ACTION: Record<string, string> = {
    raise: "Raise price",
    lower: "Lower price",
    adjust_pour: "Adjust pour",
    swap_supplier: "Swap supplier",
    eighty_six: "86 low-margin item",
  };

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => generate(14)}>
        Refresh recommendations
      </Button>
      {recs.filter((r) => r.status === "open").length === 0 && (
        <p className="text-sm text-muted-foreground">
          Attach recipes with costs, then refresh. Accept opens Menu with the suggested price —
          it never auto-changes.
        </p>
      )}
      {recs.map((r) => (
        <div key={r.id} className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <p className="font-medium">{r.menuItemName}</p>
            <Badge variant="secondary">{ACTION[r.action] ?? r.action}</Badge>
            <Badge variant={r.status === "open" ? "info" : "secondary"}>{r.status}</Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{r.evidence}</p>
          {r.status === "open" && (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  accept(r.id);
                  setView("menu");
                }}
              >
                Accept
                {r.suggestedPriceCents
                  ? ` · ${formatCurrency(r.suggestedPriceCents)}`
                  : ""}
              </Button>
              <Button size="sm" variant="outline" onClick={() => dismiss(r.id)}>
                Dismiss
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
