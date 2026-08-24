import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/demo/$type")({
  ssr: false,
  component: () => <Navigate to="/get-pricing" />,
});
