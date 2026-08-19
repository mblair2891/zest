import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppStoreView } from "@/components/pos/AppStoreView";
import { initNativeShell } from "@/lib/native-shell";

function AppsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    void initNativeShell();
  }, []);
  if (!mounted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg text-muted-foreground">
        Loading Zest Store…
      </div>
    );
  }
  return <AppStoreView />;
}

export const Route = createFileRoute("/apps")({
  ssr: false,
  component: AppsPage,
});
