import { createFileRoute, redirect } from "@tanstack/react-router";

/** Public registration is closed. Same destination as /signup. */
export const Route = createFileRoute("/register")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
  component: () => null,
});
