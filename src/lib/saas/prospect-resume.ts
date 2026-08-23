import type { ProspectListItem } from "./prospect-types";

/** Where a signed-in user with no live org should land. */
export function prospectResumePath(rows: ProspectListItem[]): string {
  const setup = rows.find(
    (r) => r.status === "onboarding" || r.status === "contracted",
  );
  if (setup) return `/setup/${setup.publicToken}`;
  const quoted = rows.find((r) => r.status === "quoted" || r.status === "accepted");
  if (quoted) return `/quote/${quoted.publicToken}`;
  const live = rows.find((r) => r.status === "live");
  if (live) return "/dashboard";
  const intake = rows.find((r) => r.status === "prospect");
  if (intake) return `/get-pricing?t=${encodeURIComponent(intake.publicToken)}`;
  return "/get-pricing";
}
