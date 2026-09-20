import { create } from "zustand";
import type { TaxRateDef } from "./tax-rates";
import type { SuggestedLabor } from "@/lib/saas/reg-calendar";

type TaxSuggestionState = {
  bulletinId: string | null;
  suggestion: TaxRateDef | null;
  labor: SuggestedLabor | null;
  applyOn: string | null;
  setSuggestion: (bulletinId: string, suggestion: TaxRateDef | null, labor?: SuggestedLabor | null) => void;
  clear: () => void;
};

export const useTaxSuggestionStore = create<TaxSuggestionState>((set) => ({
  bulletinId: null,
  suggestion: null,
  labor: null,
  applyOn: null,
  setSuggestion: (bulletinId, suggestion, labor = null) =>
    set({ bulletinId, suggestion, labor: labor ?? null }),
  clear: () => set({ bulletinId: null, suggestion: null, labor: null, applyOn: null }),
}));
