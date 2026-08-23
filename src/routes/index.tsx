import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "@/components/marketing/HomePage";
import { resolveSurface } from "@/lib/platform/hosts";
import { PosApp } from "@/components/pos/PosApp";

export const Route = createFileRoute("/")({
  ssr: false,
  component: IndexPage,
});

function IndexPage() {
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  if (resolveSurface(host, "/") === "app") {
    return <PosApp />;
  }
  return <HomePage />;
}
