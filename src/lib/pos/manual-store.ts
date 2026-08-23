/**
 * Compatibility shim. The Operators Guide store is the source of truth.
 * Existing POS chrome still imports this path.
 */
export { useGuideStore as useManualStore, useGuideStore } from "@/lib/guide/store";
