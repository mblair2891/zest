import type { ErrorComponentProps } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";
import { StationPairScreen } from "@/components/pos/StationPairScreen";
import { readStationPair } from "@/lib/pos/station-pair";
import { staffSetupMessage, stationSetupNotice } from "@/lib/pos/setup-response";

function unpairedStation(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/station") && !readStationPair();
}

export function AppErrorComponent({ error }: ErrorComponentProps) {
  const raw = error instanceof Error ? error.message || String(error) : "";
  if (unpairedStation()) {
    return (
      <StationPairScreen
        notice={stationSetupNotice(raw)}
        onPaired={(row) => {
          const q = new URLSearchParams();
          if (row.locationId) q.set("loc", row.locationId);
          window.location.assign(`/station/${row.station}?${q.toString()}`);
        }}
      />
    );
  }
  const recovered = staffSetupMessage(raw);
  const message = recovered ?? (raw || "An unexpected error occurred. Try reloading the page.");
  return (
    <main
      className={
        "flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center " +
        "bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50"
      }
    >
      <span className="text-red-500" aria-hidden="true">
        <TriangleAlert className="size-10" strokeWidth={2} />
      </span>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm break-words text-zinc-500 dark:text-zinc-400">{message}</p>
      {recovered ? (
        <button
          type="button"
          className="mt-2 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      ) : null}
    </main>
  );
}
