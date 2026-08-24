import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/demo/")({
  ssr: false,
  component: () => <Navigate to="/get-pricing" />,
});
