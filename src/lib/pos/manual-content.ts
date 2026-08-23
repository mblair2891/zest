/**
 * Compatibility shim. Guide content lives in src/lib/guide/.
 */
export {
  GUIDE_VERSION as MANUAL_VERSION,
  GUIDE_EDITION as MANUAL_EDITION,
} from "@/lib/guide/types";
export { GUIDE_UPDATES as PRODUCT_UPDATES } from "@/lib/guide/updates";
export {
  updatesForRoles as updatesForRole,
  latestUpdateId,
  isNewerThan,
  hasUnseenUpdates,
} from "@/lib/guide/updates";
