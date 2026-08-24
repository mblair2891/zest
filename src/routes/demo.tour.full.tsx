import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/demo/tour/full")({
  ssr: false,
  component: () => <Navigate to="/get-pricing" />,
});
