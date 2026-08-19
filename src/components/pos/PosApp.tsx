import { useEffect, useState } from "react";
import { usePosStore } from "@/lib/pos/store";
import { usePlatformStore } from "@/lib/pos/platform-store";
import { useFullStore } from "@/lib/pos/full-store";
import { useIntegrationsStore } from "@/lib/pos/integrations-store";
import { useSaasStore } from "@/lib/pos/saas-store";
import { useOpsStore } from "@/lib/pos/ops-store";
import { useDevPreviewStore } from "@/lib/pos/dev-preview-store";
import { useMarketingStore } from "@/lib/pos/marketing-store";
import { useManualStore } from "@/lib/pos/manual-store";
import { useNotifyStore } from "@/lib/pos/notify-store";
import { useNetworkStore } from "@/lib/pos/network-store";
import { EntityLogin, EntityPicker } from "./EntityHome";
import { AppShell } from "./AppShell";
import { PosErrorBoundary } from "./PosErrorBoundary";
import { initNativeShell } from "@/lib/native-shell";
import { isVenueEntityId } from "@/lib/pos/entities";
import type { VenueEntityId } from "@/lib/pos/types";

const STORES = [
  usePosStore,
  usePlatformStore,
  useFullStore,
  useIntegrationsStore,
  useSaasStore,
  useOpsStore,
  useDevPreviewStore,
  useMarketingStore,
  useManualStore,
  useNotifyStore,
  useNetworkStore,
] as const;

function PosAppInner({ entityId }: { entityId?: string }) {
  const [ready, setReady] = useState(false);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const activeEntityId = usePosStore((s) => s.activeEntityId);
  const applyEntity = usePosStore((s) => s.applyEntity);

  useEffect(() => {
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const markReady = () => {
      if (!cancelled) setReady(true);
    };

    let remaining = STORES.length;
    const onOne = () => {
      remaining -= 1;
      if (remaining <= 0) markReady();
    };

    for (const store of STORES) {
      unsubs.push(store.persist.onFinishHydration(onOne));
      void store.persist.rehydrate();
      if (store.persist.hasHydrated()) onOne();
    }

    const timeout = window.setTimeout(markReady, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      unsubs.forEach((u) => u());
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (entityId && isVenueEntityId(entityId) && activeEntityId !== entityId) {
      applyEntity(entityId as VenueEntityId);
    }
  }, [ready, entityId, activeEntityId, applyEntity]);

  if (!ready) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
            Z
          </div>
          <p className="text-sm">Loading Zest…</p>
        </div>
      </div>
    );
  }

  if (entityId && isVenueEntityId(entityId)) {
    if (currentEmployeeId && activeEntityId === entityId) {
      return <AppShell />;
    }
    return <EntityLogin entityId={entityId as VenueEntityId} />;
  }

  if (currentEmployeeId) {
    return <AppShell />;
  }

  return <EntityPicker />;
}

export function PosApp({ entityId }: { entityId?: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    void initNativeShell();
  }, []);

  if (!mounted) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-bg pt-[var(--grok-banner-h,0px)] text-muted-foreground">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
            Z
          </div>
          <p className="text-sm">Loading Zest…</p>
        </div>
      </div>
    );
  }

  return (
    <PosErrorBoundary>
      <PosAppInner entityId={entityId} />
    </PosErrorBoundary>
  );
}
