import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { usePosStore } from "@/lib/pos/store";
import { HOST_SCOPE } from "@/lib/access/entity-grants";
import { useCostStore } from "@/lib/costs/store";
import { parseRecipeFn, recipeAiStatusFn } from "@/lib/recipes/api";
import { heuristicRecipeExtract } from "@/lib/recipes/parse";
import { suggestSku } from "@/lib/recipes/match-sku";
import { recipeForMenuItem } from "@/lib/recipes/normalize";
import { costEntityScope } from "@/lib/costs/permissions";
import type { RecipeExtract, RecipeLine } from "@/lib/costs/types";
import { recipeCostCents } from "@/lib/costs/theoretical";
import { formatCurrency } from "@/lib/utils";

export function RecipeAssistButton({
  menuItemId,
  label,
}: {
  menuItemId?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Sparkles className="h-3.5 w-3.5" />
        {label ?? "Describe recipe"}
      </Button>
      <RecipeAssistDialog
        open={open}
        onOpenChange={setOpen}
        menuItemId={menuItemId}
      />
    </>
  );
}

export function RecipeAssistDialog({
  open,
  onOpenChange,
  menuItemId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  menuItemId?: string;
}) {
  const emp = usePosStore((s) => s.employees.find((e) => e.id === s.currentEmployeeId) ?? null);
  const menuItems = usePosStore((s) => s.menuItems);
  const skus = useCostStore((s) => s.skus);
  const recipes = useCostStore((s) => s.recipes);
  const upsert = useCostStore((s) => s.upsertRecipe);
  const [ai, setAi] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | undefined>();
  const [image, setImage] = useState<string | undefined>();
  const [draft, setDraft] = useState<RecipeExtract | null>(null);
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [linkId, setLinkId] = useState(menuItemId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const scope = costEntityScope(emp);

  useEffect(() => {
    if (!open) return;
    void recipeAiStatusFn()
      .then((r) => setAi(r.ai))
      .catch(() => setAi(false));
    if (menuItemId) setLinkId(menuItemId);
  }, [open, menuItemId]);

  const reset = () => {
    setText("");
    setFileName(undefined);
    setImage(undefined);
    setDraft(null);
    setLines([]);
    setError(null);
    setFlash(null);
  };

  const analyze = async () => {
    const t = text.trim();
    if (t.length < 6 && !image) {
      setError("Type or speak a recipe, or upload a card.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const extract = await parseRecipeFn({
        data: { text: t || fileName || "", fileName, imageDataUrl: image },
      }).catch(() => heuristicRecipeExtract(t, fileName));
      setDraft(extract);
      setLines(
        extract.lines.map((l) => {
          const sku = suggestSku(l.skuHint || l.name, skus);
          return {
            name: l.name,
            qty: l.qty,
            unit: l.unit,
            skuId: sku?.id,
          };
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read recipe");
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!draft) return;
    const item = menuItems.find((m) => m.id === (linkId || menuItemId));
    const existing = item ? recipeForMenuItem(recipes, item.id) : undefined;
    const entityId = item?.vendorId || scope || HOST_SCOPE;
    upsert({
      id: existing?.id,
      menuItemId: item?.id || existing?.menuItemId || linkId || uidFallback(),
      menuItemIds: item ? [item.id] : existing?.menuItemIds,
      name: draft.name,
      entityId,
      station: draft.station,
      wasteFactor: existing?.wasteFactor,
      yieldQty: draft.yieldQty,
      yieldUnit: draft.yieldUnit,
      glassware: draft.glassware,
      garnish: draft.garnish,
      allergens: draft.allergens,
      dietary: draft.dietary,
      notes: draft.notes,
      steps: draft.steps,
      lines,
    });
    setFlash(`Saved ${draft.name}`);
    setTimeout(() => {
      reset();
      onOpenChange(false);
    }, 600);
  };

  const cost = recipeCostCents(
    draft
      ? {
          id: "preview",
          menuItemId: linkId,
          menuItemIds: linkId ? [linkId] : [],
          name: draft.name,
          entityId: HOST_SCOPE,
          wasteFactor: 0,
          yieldQty: draft.yieldQty,
          yieldUnit: draft.yieldUnit,
          allergens: draft.allergens,
          dietary: draft.dietary,
          steps: draft.steps,
          lines,
        }
      : undefined,
    skus,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="w-[min(100vw-1.25rem,38rem)]" showClose>
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            Recipe
            {ai !== null && (
              <Badge variant={ai ? "info" : "secondary"}>
                {ai ? "AI" : "Templates"}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Type, speak, or upload a card. Preview ingredients and steps. Confirm
          saves — nothing writes until you accept.
        </p>

        {!draft && (
          <>
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
                };
                if (f.type.startsWith("image/") || f.type.startsWith("text/")) {
                  reader.readAsDataURL(f);
                } else {
                  setText((prev) => prev || `Recipe card ${f.name}`);
                }
              }}
            />
            <VoiceTextarea
              value={text}
              onChange={setText}
              rows={5}
              placeholder="2 oz Tito’s, 1 oz lime, 0.75 oz triple sec. Shake, rocks, salt rim."
            />
            <Button disabled={busy} onClick={() => void analyze()}>
              {busy ? "Reading…" : "Analyze"}
            </Button>
          </>
        )}

        {draft && (
          <div className="space-y-3">
            <Input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
            <label className="text-xs text-muted-foreground">
              Link menu item
              <select
                className="mt-1 h-10 w-full rounded-xl border border-border bg-bg px-3 text-sm"
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
              >
                <option value="">None yet</option>
                {menuItems
                  .filter((m) => !scope || !m.vendorId || m.vendorId === scope)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Input
                value={String(draft.yieldQty)}
                onChange={(e) =>
                  setDraft({ ...draft, yieldQty: parseFloat(e.target.value) || 1 })
                }
              />
              <Input
                value={draft.yieldUnit}
                onChange={(e) => setDraft({ ...draft, yieldUnit: e.target.value })}
              />
              <Input
                placeholder="Glassware"
                value={draft.glassware ?? ""}
                onChange={(e) => setDraft({ ...draft, glassware: e.target.value })}
              />
              <Input
                placeholder="Garnish"
                value={draft.garnish ?? ""}
                onChange={(e) => setDraft({ ...draft, garnish: e.target.value })}
              />
            </div>
            <ul className="space-y-1 text-sm">
              {lines.map((l, i) => (
                <li key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-border px-2 py-1">
                  <span>
                    {l.qty} {l.unit} {l.name}
                    {l.skuId ? (
                      <span className="ml-1 text-[10px] text-success">SKU</span>
                    ) : (
                      <span className="ml-1 text-[10px] text-muted-foreground">no SKU</span>
                    )}
                  </span>
                  <select
                    className="h-8 max-w-[10rem] rounded-md border border-border bg-bg px-1 text-[11px]"
                    value={l.skuId ?? ""}
                    onChange={(e) =>
                      setLines((rows) =>
                        rows.map((row, j) =>
                          j === i ? { ...row, skuId: e.target.value || undefined } : row,
                        ),
                      )
                    }
                  >
                    <option value="">Map SKU</option>
                    {skus.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </li>
              ))}
            </ul>
            {draft.steps.length > 0 && (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {draft.steps.map((s, i) => (
                  <li key={i}>
                    {s.text}
                    {s.seconds ? ` (${s.seconds}s)` : ""}
                  </li>
                ))}
              </ol>
            )}
            {(draft.allergens.length > 0 || draft.dietary.length > 0) && (
              <p className="text-xs text-muted-foreground">
                {[...draft.allergens, ...draft.dietary].join(" · ")}
              </p>
            )}
            {cost > 0 && (
              <p className="text-xs text-muted-foreground">
                Theoretical cost {formatCurrency(cost)} when SKU costs exist
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={confirm}>Confirm</Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Edit prompt
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        )}
        {error && (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        )}
        {flash && <p className="text-sm text-success">{flash}</p>}
      </DialogContent>
    </Dialog>
  );
}

function uidFallback(): string {
  return `mi_recipe_${Date.now().toString(36)}`;
}
