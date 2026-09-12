import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/demos")({
  beforeLoad: () => {
    throw redirect({ to: "/demo" });
  },
  component: () => null,
});
