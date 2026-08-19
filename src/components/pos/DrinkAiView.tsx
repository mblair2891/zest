import { useMemo, useState } from "react";
import { Sparkles, Wine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { suggestDrinks } from "@/lib/pos/ops-store";
import { usePosStore } from "@/lib/pos/store";
import type {
  DrinkSuggestion,
  FlavorProfile,
  SpiritBase,
} from "@/lib/pos/ops-types";
import { cn } from "@/lib/utils";

const SPIRITS: { id: SpiritBase; label: string }[] = [
  { id: "vodka", label: "Vodka" },
  { id: "rum", label: "Rum" },
  { id: "gin", label: "Gin" },
  { id: "whiskey", label: "Whiskey" },
  { id: "tequila", label: "Tequila" },
  { id: "any", label: "Surprise me" },
  { id: "none", label: "No spirit" },
];

const PROFILES: { id: FlavorProfile; label: string; hint: string }[] = [
  { id: "sweet_fruity", label: "Sweet & fruity", hint: "Berry, citrus candy" },
  { id: "savory", label: "Savory / herbal", hint: "Garden, salt, umami" },
  { id: "sour_citrus", label: "Sour & citrus", hint: "Bright, tart" },
  { id: "bitter", label: "Bitter", hint: "Aperitivo edge" },
  { id: "creamy", label: "Creamy", hint: "Dessert vibes" },
  { id: "spicy", label: "Spicy", hint: "Ginger, heat" },
  { id: "light_refreshing", label: "Light & refreshing", hint: "Sessionable" },
];

export function DrinkAiView() {
  const [step, setStep] = useState(0);
  const [spirit, setSpirit] = useState<SpiritBase | null>(null);
  const [profile, setProfile] = useState<FlavorProfile | null>(null);
  const [strength, setStrength] = useState<"session" | "standard" | "strong">(
    "standard",
  );
  const [suggestions, setSuggestions] = useState<DrinkSuggestion[] | null>(
    null,
  );
  const [flash, setFlash] = useState<string | null>(null);

  const activeOrderId = usePosStore((s) => s.activeOrderId);
  const orders = usePosStore((s) => s.orders);
  const menuItems = usePosStore((s) => s.menuItems);
  const addItem = usePosStore((s) => s.addItem);

  const foodOnOrder = useMemo(() => {
    const o = orders.find((x) => x.id === activeOrderId);
    if (!o) return [] as string[];
    return o.lines
      .filter((l) => !l.voided && l.course !== "drink")
      .map((l) => l.name);
  }, [orders, activeOrderId]);

  const run = () => {
    if (!spirit || !profile) return;
    const res = suggestDrinks({ spirit, profile, strength }, foodOnOrder);
    setSuggestions(res);
    setStep(3);
  };

  const reset = () => {
    setStep(0);
    setSpirit(null);
    setProfile(null);
    setStrength("standard");
    setSuggestions(null);
    setFlash(null);
  };

  const addToCheck = (s: DrinkSuggestion) => {
    if (!activeOrderId) {
      setFlash("Open a table/order first, then add the drink");
      return;
    }
    // Prefer mapped menu item; else first available bar item with similar name
    let menuItemId = s.menuItemId;
    if (!menuItemId || !menuItems.some((m) => m.id === menuItemId)) {
      const hit = menuItems.find(
        (m) =>
          m.available &&
          m.station === "bar" &&
          m.name.toLowerCase().includes(s.spirit.toLowerCase().slice(0, 3)),
      );
      menuItemId = hit?.id ?? menuItems.find((m) => m.station === "bar")?.id;
    }
    if (!menuItemId) {
      setFlash("No bar menu items to attach");
      return;
    }
    addItem(menuItemId, { note: `AI suggest: ${s.name}` });
    setFlash(`Added ${s.name} to the check`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Drink AI · bartender assist</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Guest questionnaire → builds. Food on the open check influences pairing.
        </p>
        {foodOnOrder.length > 0 && (
          <p className="mt-1 text-xs text-primary">
            Food on check: {foodOnOrder.join(", ")}
          </p>
        )}
        {flash && (
          <p className="mt-1 text-xs text-primary" role="status">
            {flash}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {step === 0 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              1 · What spirit sounds good?
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {SPIRITS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSpirit(s.id);
                    setStep(1);
                  }}
                  className={cn(
                    "rounded-2xl border border-border bg-surface px-3 py-4 text-left text-sm font-medium transition hover:border-primary",
                    spirit === s.id && "border-primary bg-primary/10",
                  )}
                >
                  <Wine className="mb-1 h-4 w-4 text-muted-foreground" />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">
              2 · Sweet & fruity, savory, or something else?
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {PROFILES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setProfile(p.id);
                    setStep(2);
                  }}
                  className={cn(
                    "rounded-2xl border border-border bg-surface px-4 py-3 text-left transition hover:border-primary",
                    profile === p.id && "border-primary bg-primary/10",
                  )}
                >
                  <p className="font-medium">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.hint}</p>
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3"
              onClick={() => setStep(0)}
            >
              Back
            </Button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="mb-3 text-sm font-semibold">3 · How strong?</h3>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["session", "Session / light"],
                  ["standard", "Standard"],
                  ["strong", "Strong"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  variant={strength === id ? "default" : "outline"}
                  onClick={() => setStrength(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={run}>
                <Sparkles className="h-3.5 w-3.5" />
                Suggest drinks
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
            </div>
          </div>
        )}

        {step === 3 && suggestions && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Suggested for this guest</h3>
              <Button size="sm" variant="outline" onClick={reset}>
                New guest
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {spirit} · {profile?.replace(/_/g, " ")} · {strength}
              {foodOnOrder.length > 0 && " · paired with food on check"}
            </p>
            {suggestions.map((s, i) => (
              <div
                key={s.id}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <div className="flex flex-wrap items-start gap-2">
                  <Badge variant="info">#{i + 1}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.tagline}</p>
                  </div>
                  <Badge variant="secondary">
                    {Math.round(s.confidence * 100)}% fit
                  </Badge>
                </div>
                <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
                  {s.ingredients.map((ing) => (
                    <li key={ing}>{ing}</li>
                  ))}
                </ul>
                <p className="mt-2 text-xs">
                  <span className="text-muted-foreground">Build:</span> {s.build}{" "}
                  · {s.glass}
                </p>
                {s.pairsWith && (
                  <p className="text-xs text-primary">Pairs: {s.pairsWith}</p>
                )}
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => addToCheck(s)}
                >
                  {activeOrderId ? "Add to open check" : "Needs open check"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
