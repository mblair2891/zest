import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { PackageId } from "./packages";

export type PackagePreviewMode = "location" | "all" | PackageId;

interface DevPreviewState {
  /** Dev: which package entitlement lens is applied in POS shell */
  packagePreview: PackagePreviewMode;
  setPackagePreview: (mode: PackagePreviewMode) => void;
}

export const useDevPreviewStore = create<DevPreviewState>()(
  persist(
    (set) => ({
      packagePreview: "location",
      setPackagePreview: (packagePreview) => set({ packagePreview }),
    }),
    {
      name: "summex-dev-preview-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);
