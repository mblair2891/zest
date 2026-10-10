import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  formatWellUpcharge,
  wellLevelModifierName,
  wellMixerLabel,
  type WellLevelRow,
  type WellPour,
} from "@/lib/pos/well-book";
import { cn, formatCurrency } from "@/lib/utils";

/** Thumb sheet. Position and the pour row are inline so dialog animation and shrink-to-fit buttons cannot clip them. */
const SHEET_STYLE: CSSProperties = {
  position: "fixed",
  left: "50%",
  right: "auto",
  top: "auto",
  bottom: "0.75rem",
  transform: "translateX(-50%)",
  width: "min(100vw - 1rem, 28rem)",
  maxHeight: "85vh",
  zIndex: 80,
  margin: 0,
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1rem",
  overflowY: "auto",
  backgroundColor: "#ffffff",
  color: "#0a0a0a",
  border: "1px solid #e8e6e1",
  borderBottom: "0",
  borderRadius: "1.5rem 1.5rem 0 0",
  boxShadow: "0 -8px 32px rgb(0 0 0 / 0.18)",
};

const POUR_ROW: CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  width: "100%",
};

const POUR_BUTTON: CSSProperties = {
  flex: "1 1 0",
  minWidth: 0,
  width: "100%",
  minHeight: "4rem",
  height: "4rem",
};

const MIXER_LIST: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  width: "100%",
};

const MIXER_BUTTON: CSSProperties = {
  width: "100%",
  minHeight: "3.5rem",
  height: "3.5rem",
  justifyContent: "flex-start",
};

const LEVEL_LIST: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
  width: "100%",
};

const LEVEL_BUTTON: CSSProperties = {
  width: "100%",
  minHeight: "3.5rem",
  height: "3.5rem",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.75rem",
  padding: "0 1rem",
};

export function WellSpiritDialog({
  spiritName,
  spiritId,
  levels,
  bottle,
  pour,
  mixers,
  onBottle,
  onChangeBottle,
  onPour,
  onMixer,
  onClose,
}: {
  spiritName: string | null;
  spiritId: string | null;
  levels: WellLevelRow[];
  bottle: WellLevelRow | null;
  pour: WellPour | null;
  mixers: { id: string; name: string }[];
  onBottle: (row: WellLevelRow) => void;
  onChangeBottle: () => void;
  onPour: (pour: WellPour) => void;
  onMixer: (mixerId: string) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!spiritName) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [spiritName, onClose]);

  if (!spiritName || typeof document === "undefined") return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      <button
        type="button"
        aria-label="Close well"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: 0,
          background: "rgb(0 0 0 / 0.45)",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="well-spirit-title"
        data-well-spirit-popup=""
        data-well-spirit={spiritId ?? ""}
        style={SHEET_STYLE}
        className="bg-surface text-foreground"
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
          <div>
            <h2 id="well-spirit-title" className="text-xl font-semibold text-foreground">
              {spiritName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {bottle
                ? `${wellLevelModifierName(bottle)}. Single or double, then a mixer.`
                : "In-stock bottles, grouped by price level."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: "3rem",
              height: "3rem",
              flex: "0 0 auto",
              display: "grid",
              placeItems: "center",
              border: 0,
              borderRadius: "0.75rem",
              background: "transparent",
              color: "#5c5c5c",
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {bottle ? (
          <button
            type="button"
            data-well-change-bottle=""
            onClick={onChangeBottle}
            style={{
              alignSelf: "flex-start",
              border: 0,
              background: "transparent",
              color: "#5c5c5c",
              fontSize: "0.875rem",
              padding: 0,
              minHeight: "2rem",
            }}
          >
            Change bottle
          </button>
        ) : (
          <div style={LEVEL_LIST} data-well-levels="" data-well-rows={levels.length}>
            {levels.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing in stock for this spirit.</p>
            ) : (
              levels.map((row, index) => {
                const grouped = index > 0 && levels[index - 1]?.levelLabel !== row.levelLabel;
                const sameName = row.bottleName.trim().toLowerCase() === row.levelLabel.trim().toLowerCase();
                return (
                  <Button
                    key={row.bottleId}
                    type="button"
                    size="xl"
                    variant="outline"
                    className="text-lg font-semibold"
                    style={{ ...LEVEL_BUTTON, marginTop: grouped ? "0.25rem" : 0 }}
                    data-well-bottle={row.bottleId}
                    data-well-level={row.levelLabel}
                    data-well-upcharge={row.upchargeCents}
                    data-well-charge={row.chargeCents}
                    data-well-base={row.isWell ? row.basePriceCents : undefined}
                    onClick={() => onBottle(row)}
                  >
                    <span>{row.levelLabel}</span>
                    <span className="min-w-0 flex-1 truncate text-left font-medium">
                      {sameName ? "" : row.bottleName}
                    </span>
                    <span className="tabular">
                      {row.isWell ? formatCurrency(row.basePriceCents) : formatWellUpcharge(row.upchargeCents)}
                    </span>
                  </Button>
                );
              })
            )}
          </div>
        )}
        {bottle ? (
        <>
        <div style={POUR_ROW}>
          <Button
            type="button"
            size="xl"
            className={cn("text-lg", pour === "single" && "ring-2 ring-primary")}
            style={POUR_BUTTON}
            variant={pour === "single" ? "default" : "outline"}
            data-well-pour="single"
            onClick={() => onPour("single")}
          >
            Single
          </Button>
          <Button
            type="button"
            size="xl"
            className={cn("text-lg", pour === "double" && "ring-2 ring-primary")}
            style={POUR_BUTTON}
            variant={pour === "double" ? "default" : "outline"}
            data-well-pour="double"
            onClick={() => onPour("double")}
          >
            Double
          </Button>
        </div>
        {pour ? (
          <div style={MIXER_LIST} data-well-mixers="">
            {mixers.map((mixer) => (
              <Button
                key={mixer.id}
                type="button"
                size="xl"
                variant="outline"
                className="px-4 text-lg font-semibold"
                style={MIXER_BUTTON}
                data-well-mixer={mixer.id}
                onClick={() => onMixer(mixer.id)}
              >
                {wellMixerLabel(mixer.name)}
              </Button>
            ))}
          </div>
        ) : null}
        </>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
