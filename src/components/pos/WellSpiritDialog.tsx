import { useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { wellMixerLabel, type WellPour } from "@/lib/pos/well-book";
import { cn } from "@/lib/utils";

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

export function WellSpiritDialog({
  spiritName,
  spiritId,
  pour,
  mixers,
  onPour,
  onMixer,
  onClose,
}: {
  spiritName: string | null;
  spiritId: string | null;
  pour: WellPour | null;
  mixers: { id: string; name: string }[];
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
            <p className="text-sm text-muted-foreground">Single or double, then a mixer.</p>
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
      </div>
    </div>,
    document.body,
  );
}
