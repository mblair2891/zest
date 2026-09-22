import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { saveBrandLogoFn, clearBrandLogoFn } from "@/lib/brand/logos-api";
import { prepareLogoFile } from "@/lib/brand/prepare-logo";
import { usePosStore } from "@/lib/pos/store";
import type { BrandLogoMap } from "@/lib/brand/logos";

export function BrandLogoField({
  locationId,
  operatorId,
  label,
  hint,
  write,
}: {
  locationId: string;
  /** Empty string is the building slot. */
  operatorId: string;
  label: string;
  hint: string;
  write: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const brandLogos = usePosStore((s) => s.settings.brandLogos);
  const updateSettings = usePosStore((s) => s.updateSettings);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slot = operatorId.trim();
  const current = slot ? brandLogos?.entities?.[slot] : brandLogos?.location;
  const screen = current?.screenUrl || "";

  const apply = (map: BrandLogoMap, configVersion: number) => {
    updateSettings({ brandLogos: map, configVersion });
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !write) return;
    setBusy(true);
    setError(null);
    try {
      const prepared = await prepareLogoFile(file);
      const saved = await saveBrandLogoFn({
        data: {
          locationId,
          operatorId: slot,
          mime: prepared.mime,
          originalBase64: prepared.originalBase64,
          screenUrl: prepared.screenUrl,
          receipt: prepared.receipt,
        },
      });
      apply(saved.brandLogos, saved.configVersion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not store that logo");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const clear = async () => {
    if (!write) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await clearBrandLogoFn({ data: { locationId, operatorId: slot } });
      apply(saved.brandLogos, saved.configVersion);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear that logo");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2" data-logo-slot={slot || "location"}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {screen ? (
        <img src={screen} alt="" className="h-14 w-auto max-w-[12rem] object-contain" />
      ) : (
        <p className="text-xs text-muted-foreground">Name text until a file is stored.</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
        className="hidden"
        disabled={!write || busy}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {write && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
            {busy ? "Saving…" : "Upload PNG, JPG, or SVG"}
          </Button>
          {screen && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void clear()}>
              Clear
            </Button>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">One file, 2MB max. Clear falls back to the name.</p>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
