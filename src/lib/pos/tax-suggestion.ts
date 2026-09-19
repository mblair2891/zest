import { create } from "zustand";
import type { TaxRateDef } from "./tax-rates";

type TaxSuggestionState = {
  bulletinId: string | null;
  suggestion: TaxRateDef | null;
  setSuggestion: (bulletinId: string, suggestion: TaxRateDef | null) => void;
  clear: () => void;
};

export const useTaxSuggestionStore = create<TaxSuggestionState>((set) => ({
  bulletinId: null,
  suggestion: null,
  setSuggestion: (bulletinId, suggestion) => set({ bulletinId, suggestion }),
  clear: () => set({ bulletinId: null, suggestion: null }),
}));
