import type { NavigateOptions } from "@tanstack/react-router";
import type { TourRoute } from "./tour-scripts";
import { enterDemoSession } from "./session";

type NavigateFn = (opts: NavigateOptions) => Promise<void> | void;

export async function navigateTourRoute(
  navigate: NavigateFn,
  route: TourRoute,
): Promise<void> {
  if (route.to === "/demo/$type") {
    enterDemoSession(route.params.type);
    await navigate({ to: "/demo/$type", params: { type: route.params.type } });
    return;
  }
  if (route.to === "/demo") {
    await navigate({ to: "/demo" });
    return;
  }
  if (route.to === "/kiosk") {
    await navigate({ to: "/kiosk" });
    return;
  }
  if (route.to === "/guide") {
    await navigate({
      to: "/guide",
      search: route.search?.topic ? { topic: route.search.topic } : undefined,
    });
    return;
  }
  if (route.to === "/dashboard") {
    await navigate({ to: "/dashboard" });
    return;
  }
  if (route.to === "/get-pricing") {
    await navigate({ to: "/get-pricing" });
  }
}
