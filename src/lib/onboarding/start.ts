import { startTour } from "@/lib/demo/tour-store";
import { useGuideStore } from "@/lib/guide/store";
import { getWalkthrough } from "./walkthrough-scripts";
import type { WalkthroughKey } from "./context";
import { walkthroughTourId } from "./context";

export function startRoleWalkthrough(
  key: WalkthroughKey,
  opts?: { autoPlay?: boolean },
): boolean {
  const def = getWalkthrough(key);
  if (!def) return false;
  useGuideStore.getState().closeGuide();
  const id = key === "busser" ? "walkthrough:server" : walkthroughTourId(key);
  return startTour(id, { autoPlay: opts?.autoPlay ?? false });
}
