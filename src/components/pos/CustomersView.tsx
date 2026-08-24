import { useState } from "react";
import { Gift, Plus, Star, UserPlus, Upload, Snowflake, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePosStore } from "@/lib/pos/store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import {
  IMPORT_PROVIDERS,
  giftImportTemplate,
  previewGiftImport,
  type ImportProviderId,
  type GiftImportPreview,
} from "@/lib/pos/gift-import";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import {
  defaultGiftIssuer,
  liabilityByIssuer,
  listGiftIssuers,
} from "@/lib/pos/gift-issuer";
import { GuideLearnLink } from "@/components/guide/GuideLearnLink";

export function CustomersView() {
  const customers = usePosStore((s) => s.customers);
  const giftCards = usePosStore((s) => s.giftCards);
  const addCustomer = usePosStore((s) => s.addCustomer);
  const issueGiftCard = usePosStore((s) => s.issueGiftCard);
  const reloadGiftCard = usePosStore((s) => s.reloadGiftCard);
  const setGiftCardStatus = usePosStore((s) => s.setGiftCardStatus);
  const importGiftCards = usePosStore((s) => s.importGiftCards);
  const adjustLoyalty = usePosStore((s) => s.adjustLoyalty);
  const setOptIn = usePosStore((s) => s.setCustomerMarketingOptIn);
  const loyalty = useMarketingStore((s) => s.loyalty);
  const logGiftTxn = useMarketingStore((s) => s.logGiftTxn);
  const giftTxns = useMarketingStore((s) => s.giftTxns);
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const settings = usePosStore((s) => s.settings);
  const vendors = usePosStore((s) => s.vendors);
  const giftTransfers = usePosStore((s) => s.giftTransfers ?? []);
  const issuers = listGiftIssuers(settings, vendors);
  const defaultIssuer = defaultGiftIssuer(emp, settings, vendors);
  const [issuerId, setIssuerId] = useState(defaultIssuer.id);
  const [giftTender, setGiftTender] = useState<"cash" | "card">("card");

  const [open, setOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [q, setQ] = useState("");
  const [giftAmt, setGiftAmt] = useState("50");
  const [giftTo, setGiftTo] = useState("");
  const [reloadCode, setReloadCode] = useState("");
  const [reloadAmt, setReloadAmt] = useState("25");
  const [msg, setMsg] = useState<string | null>(null);

  const [provider, setProvider] = useState<ImportProviderId>("generic");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<GiftImportPreview | null>(null);
  const [overwrite, setOverwrite] = useState(false);

  const filtered = customers.filter(
    (c) =>
      !q.trim() ||
      c.name.toLowerCase().includes(q.toLowerCase()) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").toLowerCase().includes(q.toLowerCase()),
  );

  const outstanding = giftCards
    .filter((g) => g.active && g.status !== "void" && !g.breakageProcessedAt)
    .reduce((s, g) => s + g.balanceCents, 0);
  const liability = liabilityByIssuer(giftCards, settings, vendors);

  const tierOf = (pts: number) => {
    const sorted = [...loyalty.tiers].sort((a, b) => b.minPoints - a.minPoints);
    return sorted.find((t) => pts >= t.minPoints) ?? loyalty.tiers[0];
  };

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Guests · Loyalty · Gift cards</h2>
        <Input
          className="h-9 max-w-xs"
          placeholder="Search guests…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <GuideLearnLink topicId="gift-cards" compact>
          Learn
        </GuideLearnLink>
        <Button size="sm" variant="outline" onClick={() => setGiftOpen(true)}>
          <Gift className="h-3.5 w-3.5" />
          Issue / reload
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <Upload className="h-3.5 w-3.5" />
          Import
        </Button>
        <Button size="sm" className="ml-auto" onClick={() => setOpen(true)}>
          <UserPlus className="h-3.5 w-3.5" />
          Add guest
        </Button>
      </div>

      {msg && (
        <p className="mb-3 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary">
          {msg}
        </p>
      )}

      <div className="mb-4 rounded-2xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Star className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">{loyalty.name}</p>
          <Badge variant="info">
            {loyalty.pointsPerDollar} pt / $1
          </Badge>
          <Badge variant="secondary">
            Redeem {loyalty.minRedeemPoints}+ pts
          </Badge>
          {loyalty.punchCardEnabled && (
            <Badge variant="success">
              Punch {loyalty.punchTarget} → {loyalty.punchRewardLabel}
            </Badge>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {loyalty.tiers.map((t) => (
            <div
              key={t.id}
              className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs"
            >
              <span className="font-medium">{t.name}</span>
              <span className="text-muted-foreground">
                {" "}
                · {t.minPoints}+ pts · {t.multiplier}× earn
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Welcome bonus {loyalty.welcomeBonus} pts · Birthday {loyalty.birthdayBonus}{" "}
          pts · Configure in Marketing
        </p>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => {
          const tier = c.tier ?? tierOf(c.loyaltyPoints)?.name ?? "Standard";
          return (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.phone || "No phone"}
                    {c.email && ` · ${c.email}`}
                  </p>
                </div>
                <Badge variant="info" className="capitalize">
                  {tier}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-bg p-2">
                  <span className="block text-sm font-semibold tabular text-foreground">
                    {c.loyaltyPoints}
                  </span>
                  pts
                </div>
                <div className="rounded-lg bg-bg p-2">
                  <span className="block text-sm font-semibold tabular text-foreground">
                    {c.visitCount}
                  </span>
                  visits
                </div>
                <div className="rounded-lg bg-bg p-2">
                  <span className="block text-sm font-semibold tabular text-foreground">
                    {formatCurrency(c.totalSpentCents)}
                  </span>
                  spent
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    adjustLoyalty(c.id, 25);
                    setMsg(`+25 pts → ${c.name}`);
                  }}
                >
                  +25 pts
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    adjustLoyalty(c.id, -loyalty.minRedeemPoints);
                    setMsg(`Redeemed ${loyalty.minRedeemPoints} pts · ${c.name}`);
                  }}
                >
                  Redeem
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setOptIn(c.id, !c.marketingOptIn);
                  }}
                >
                  {c.marketingOptIn ? "Opted in" : "Opt in"}
                </Button>
              </div>
              {c.notes && (
                <p className="mt-2 text-xs text-warn">{c.notes}</p>
              )}
              {c.lastVisitAt && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Last visit {formatDateTime(c.lastVisitAt)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium">Summex gift ledger</h3>
        <Badge variant="secondary">First-party · no external network</Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          Outstanding {formatCurrency(outstanding)}
        </span>
      </div>
      {liability.length > 0 && (
        <div className="mb-4 overflow-x-auto rounded-xl border border-border" data-demo="gift-liability">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Issuer</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Outstanding</th>
                <th className="px-3 py-2 font-medium">Issued</th>
                <th className="px-3 py-2 font-medium">Redeemed</th>
              </tr>
            </thead>
            <tbody>
              {liability.map((row) => (
                <tr key={row.issuerId} className="border-t border-border">
                  <td className="px-3 py-2">{row.issuerName}</td>
                  <td className="px-3 py-2 capitalize">{row.kind}</td>
                  <td className="px-3 py-2 tabular">{formatCurrency(row.outstandingCents)}</td>
                  <td className="px-3 py-2 tabular">{formatCurrency(row.issuedCents)}</td>
                  <td className="px-3 py-2 tabular">{formatCurrency(row.redeemedCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mb-4 grid gap-2 sm:grid-cols-3">
        {giftCards.map((g) => (
          <div
            key={g.id}
            className="rounded-xl border border-border bg-surface p-3"
          >
            <p className="font-mono text-sm">{g.code}</p>
            <p className="mt-1 text-lg font-semibold tabular">
              {formatCurrency(g.balanceCents)}
            </p>
            <p className="text-xs text-muted-foreground">
              {g.status || (g.active ? "active" : "disabled")}
              {g.issuerName ? ` · issuer ${g.issuerName}` : ""}
              {g.issuedToName ? ` · ${g.issuedToName}` : ""}
              {g.source && g.source !== "summex"
                ? ` · ${g.source.replace("import_", "")}`
                : ""}
            </p>
            {g.issuedAt && (
              <p className="text-[11px] text-muted-foreground">
                Issued {formatDateTime(g.issuedAt)}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {g.status !== "frozen" && g.active && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setGiftCardStatus(g.code, "frozen");
                    logGiftTxn({
                      giftCardId: g.code,
                      type: "freeze",
                      amountCents: 0,
                      note: g.code,
                    });
                    setMsg(`Frozen ${g.code}`);
                  }}
                >
                  <Snowflake className="h-3 w-3" />
                  Freeze
                </Button>
              )}
              {g.status === "frozen" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setGiftCardStatus(g.code, "active");
                    setMsg(`Unfrozen ${g.code}`);
                  }}
                >
                  Unfreeze
                </Button>
              )}
              {g.status !== "void" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px]"
                  onClick={() => {
                    setGiftCardStatus(g.code, "void");
                    logGiftTxn({
                      giftCardId: g.code,
                      type: "void",
                      amountCents: 0,
                      note: g.code,
                    });
                    setMsg(`Voided ${g.code}`);
                  }}
                >
                  <Ban className="h-3 w-3" />
                  Void
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {giftTransfers.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-medium">Issuer settlement</h3>
          <div className="mb-4 space-y-1 text-xs text-muted-foreground">
            {giftTransfers.slice(0, 8).map((t) => (
              <div key={t.id} className="flex justify-between border-b border-border/50 py-1">
                <span>
                  {t.reason} · {t.fromName} → {t.toName}
                </span>
                <span className="tabular text-foreground">
                  {formatCurrency(t.amountCents)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {giftTxns.length > 0 && (
        <>
          <h3 className="mb-2 text-sm font-medium">Recent gift activity</h3>
          <div className="space-y-1 text-xs text-muted-foreground">
            {giftTxns.slice(0, 8).map((t) => (
              <div key={t.id} className="flex justify-between border-b border-border/50 py-1">
                <span>
                  {t.type} · {t.note ?? t.giftCardId}
                </span>
                <span className="tabular text-foreground">
                  {formatCurrency(t.amountCents)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add guest to {loyalty.name}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            New guests receive {loyalty.welcomeBonus} welcome points and marketing
            opt-in (demo).
          </p>
          <DialogFooter>
            <Button
              disabled={!name.trim()}
              onClick={() => {
                addCustomer({
                  name: name.trim(),
                  phone: phone || undefined,
                  email: email || undefined,
                });
                setName("");
                setPhone("");
                setEmail("");
                setOpen(false);
                setMsg("Guest enrolled with welcome points");
              }}
            >
              Enroll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={giftOpen} onOpenChange={setGiftOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Issue / reload · Summex ledger</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Cash or card collected at the drawer is not seller merchandise. It
            increases the issuer’s gift liability. Default issuer follows the
            selling point (bar → operator, host stand → configured entity, house
            SKU → house).
          </p>
          <p className="text-xs font-medium">Issue new</p>
          <Input
            placeholder="Amount USD"
            value={giftAmt}
            onChange={(e) => setGiftAmt(e.target.value)}
          />
          <Input
            placeholder="Issued to (optional)"
            value={giftTo}
            onChange={(e) => setGiftTo(e.target.value)}
          />
          <label className="block text-xs text-muted-foreground">
            Issuer
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-foreground"
              value={issuerId}
              onChange={(e) => setIssuerId(e.target.value)}
            >
              {issuers.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.kind})
                  {i.id === defaultIssuer.id ? " · selling point" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            Tender collected
            <select
              className="mt-1 flex h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-foreground"
              value={giftTender}
              onChange={(e) => setGiftTender(e.target.value as "cash" | "card")}
            >
              <option value="card">Card (Quantum Payments)</option>
              <option value="cash">Cash (drawer holds; remit to issuer)</option>
            </select>
          </label>
          <Button
            onClick={() => {
              const dollars = parseFloat(giftAmt);
              if (!Number.isFinite(dollars) || dollars <= 0) {
                setMsg("Enter a valid amount");
                return;
              }
              const res = issueGiftCard({
                amountCents: Math.round(dollars * 100),
                issuedToName: giftTo || undefined,
                issuerId,
                tender: giftTender,
              });
              if (res.ok && res.code) {
                logGiftTxn({
                  giftCardId: res.code,
                  type: "issue",
                  amountCents: Math.round(dollars * 100),
                  note: res.code,
                });
                setMsg(`Issued ${res.code} for $${dollars.toFixed(2)}`);
                setGiftOpen(false);
              } else setMsg(res.error ?? "Failed");
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Issue card
          </Button>
          <p className="mt-2 text-xs font-medium">Reload existing</p>
          <Input
            placeholder="Code"
            value={reloadCode}
            onChange={(e) => setReloadCode(e.target.value)}
          />
          <Input
            placeholder="Amount USD"
            value={reloadAmt}
            onChange={(e) => setReloadAmt(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => {
              const dollars = parseFloat(reloadAmt);
              const res = reloadGiftCard(
                reloadCode,
                Math.round(dollars * 100),
              );
              if (res.ok) {
                logGiftTxn({
                  giftCardId: reloadCode,
                  type: "reload",
                  amountCents: Math.round(dollars * 100),
                  note: reloadCode,
                });
                setMsg(`Reloaded ${reloadCode}`);
                setGiftOpen(false);
              } else setMsg(res.error ?? "Failed");
            }}
          >
            Reload
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import gift cards into Summex</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            One-way migration. After import, balances live only in Summex.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {IMPORT_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setProvider(p.id);
                  setPreview(null);
                }}
                className={`rounded-xl border px-3 py-2 text-left text-xs ${
                  provider === p.id
                    ? "border-primary bg-primary/10"
                    : "border-border bg-bg"
                }`}
              >
                <span className="block font-semibold">{p.label}</span>
                <span className="text-muted-foreground">{p.blurb}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const blob = new Blob([giftImportTemplate(provider)], {
                  type: "text/csv",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `summex-gift-import-${provider}.csv`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Template
            </Button>
            <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-border bg-bg px-3 text-xs font-medium">
              <Upload className="h-3.5 w-3.5" />
              Choose CSV
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setFileName(file.name);
                  const text = await file.text();
                  setCsvText(text);
                  const existing = new Set(
                    usePosStore
                      .getState()
                      .giftCards.map((g) =>
                        g.code.replace(/[\s-]/g, "").toUpperCase(),
                      ),
                  );
                  setPreview(previewGiftImport(text, provider, existing));
                }}
              />
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!csvText) {
                  setMsg("Choose a CSV first");
                  return;
                }
                const existing = new Set(
                  usePosStore
                    .getState()
                    .giftCards.map((g) =>
                      g.code.replace(/[\s-]/g, "").toUpperCase(),
                    ),
                );
                setPreview(previewGiftImport(csvText, provider, existing));
              }}
            >
              Preview
            </Button>
          </div>
          {fileName && (
            <p className="text-[11px] text-muted-foreground">File: {fileName}</p>
          )}
          {preview && (
            <div className="rounded-xl border border-border bg-bg p-3 text-xs">
              <div className="mb-2 flex flex-wrap gap-2">
                <Badge variant="secondary">{preview.summary.total} rows</Badge>
                <Badge variant="success">{preview.summary.valid} valid</Badge>
                {preview.summary.alreadyInSystem > 0 && (
                  <Badge variant="warn">
                    {preview.summary.alreadyInSystem} already in Summex
                  </Badge>
                )}
              </div>
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {preview.rows.slice(0, 10).map((r) => (
                  <li key={`${r.line}-${r.code}`} className="flex justify-between">
                    <span className="font-mono">
                      L{r.line} · {r.code}
                    </span>
                    <span className="tabular">
                      {formatCurrency(r.balanceCents)}
                    </span>
                  </li>
                ))}
              </ul>
              {preview.issues.slice(0, 4).map((i, idx) => (
                <p key={idx} className="mt-1 text-muted-foreground">
                  L{i.line}: {i.message}
                </p>
              ))}
            </div>
          )}
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border"
              checked={overwrite}
              onChange={(e) => setOverwrite(e.target.checked)}
            />
            Overwrite balances when the code already exists
          </label>
          <DialogFooter>
            <Button
              disabled={!preview || preview.summary.valid === 0}
              onClick={() => {
                if (!preview) return;
                const res = importGiftCards(preview, { overwrite });
                if (!res.ok) {
                  setMsg(res.error ?? "Import failed");
                  return;
                }
                logGiftTxn({
                  giftCardId: "import",
                  type: "import",
                  amountCents: preview.rows.reduce((s, r) => s + r.balanceCents, 0),
                  note: `${res.imported ?? 0} from ${provider}`,
                });
                setMsg(
                  `Imported ${res.imported ?? 0} cards into the Summex ledger`,
                );
                setImportOpen(false);
                setPreview(null);
              }}
            >
              Import into Summex
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
