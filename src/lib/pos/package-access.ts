import {
  PACKAGE_BY_ID,
  ZEST_PACKAGES,
  packageForView,
  type PackageId,
} from "./packages";
import type { PackagePreviewMode } from "./dev-preview-store";

/** Whether a POS view is allowed under location packages + optional dev preview lens */
export function allowsView(
  view: string,
  enabledPackages: string[],
  preview: PackagePreviewMode,
): boolean {
  if (preview === "all") return true;

  const need = packageForView(view);
  if (!need) return true;

  // Live location entitlements
  if (preview === "location") {
    return enabledPackages.includes(need);
  }

  // Dev: single-package lens — core always available + selected package views
  const pkg = preview;
  if (need === "pos_core") return true;
  if (need === pkg) return true;
  const own = PACKAGE_BY_ID[pkg]?.views ?? [];
  return own.includes(view);
}

export function previewLabel(mode: PackagePreviewMode): string {
  if (mode === "location") return "Location packages";
  if (mode === "all") return "All packages (dev)";
  return PACKAGE_BY_ID[mode]?.shortName ?? mode;
}

export const PREVIEW_OPTIONS: { id: PackagePreviewMode; label: string }[] = [
  { id: "location", label: "Location packages (live)" },
  { id: "all", label: "All packages (dev)" },
  ...ZEST_PACKAGES.filter((p) => p.id !== "saas_console").map((p) => ({
    id: p.id as PackagePreviewMode,
    label: `Only: ${p.shortName}`,
  })),
];
