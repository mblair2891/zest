import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/station/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleStationPairRequest } = await import("@/lib/pos/station-pair-http.server");
        return handleStationPairRequest(request);
      },
    },
  },
});
