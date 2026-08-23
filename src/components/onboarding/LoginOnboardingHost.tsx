import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { LatestUpdatesModal } from "./LatestUpdatesModal";
import { WalkthroughOffer } from "./WalkthroughOffer";
import { useGuideStore } from "@/lib/guide/store";
import { updatesForContext } from "@/lib/guide/updates";
import {
  isOnboardingSurface,
  useOnboardingContext,
  type WalkthroughKey,
} from "@/lib/onboarding/context";
import { useOnboardingStore } from "@/lib/onboarding/store";
import { startRoleWalkthrough } from "@/lib/onboarding/start";
import { getWalkthrough } from "@/lib/onboarding/walkthrough-scripts";
import { useTourStore } from "@/lib/demo/tour-store";
import { useDemoDeviceStore } from "@/lib/demo/device-session";
import { usePosStore } from "@/lib/pos/store";

type Phase = "idle" | "updates" | "offer";

/**
 * After session + role/location resolve: Latest updates, then a role walkthrough offer.
 * Does not block login when the feed is empty.
 */
export function LoginOnboardingHost() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ctx = useOnboardingContext(pathname);
  const tourRunning = useTourStore((s) => Boolean(s.tour));
  const notifyLogin = useGuideStore((s) => s.notifyLogin);
  const shouldShowWhatsNew = useGuideStore((s) => s.shouldShowWhatsNew);
  const dismissWhatsNew = useGuideStore((s) => s.dismissWhatsNew);
  const forceWhatsNew = useGuideStore((s) => s.forceWhatsNew);
  const isComplete = useOnboardingStore((s) => s.isWalkthroughComplete);
  const markComplete = useOnboardingStore((s) => s.markWalkthroughComplete);
  const markOffered = useOnboardingStore((s) => s.markOffered);
  const wasOffered = useOnboardingStore((s) => s.wasOffered);
  const resetSession = useOnboardingStore((s) => s.resetSession);

  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const lastLoginRef = useRef<string | null>(null);
  const lastRoleRef = useRef<string | null>(null);
  const closingUpdates = useRef(false);

  useEffect(() => {
    const done = () => setHydrated(true);
    const u1 = useGuideStore.persist.onFinishHydration(done);
    const u2 = useOnboardingStore.persist.onFinishHydration(done);
    void useGuideStore.persist.rehydrate();
    void useOnboardingStore.persist.rehydrate();
    void usePosStore.persist.rehydrate();
    if (useGuideStore.persist.hasHydrated() && useOnboardingStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    const t = window.setTimeout(done, 800);
    return () => {
      u1();
      u2();
      window.clearTimeout(t);
    };
  }, []);

  const onSurface = isOnboardingSurface(pathname);
  const guestKiosk =
    pathname.startsWith("/kiosk") &&
    !(ctx.isDemo && ctx.demoEntered && ctx.demoDevice === "kiosk");

  const loginFingerprint = ctx.emp?.id ?? (ctx.isPlatformAdmin ? `plat:${ctx.userKey}` : null);
  const demoEntered = useDemoDeviceStore((s) => s.entered);

  const roles = ctx.guideRoles.length ? ctx.guideRoles : ("all" as const);
  const entries = updatesForContext(
    {
      roles,
      entityType: ctx.entityType,
      includePlatform: ctx.isPlatformAdmin,
      isDemo: ctx.isDemo,
    },
    10,
  );

  const waitingDemoEmp =
    ctx.isDemo && demoEntered && ctx.demoDevice === "pos" && !ctx.emp;
  const waitingDemoEnter = ctx.isDemo && !demoEntered;

  const readyForOnboarding =
    hydrated &&
    onSurface &&
    !guestKiosk &&
    !waitingDemoEnter &&
    !waitingDemoEmp &&
    !tourRunning &&
    Boolean(loginFingerprint || (ctx.isDemo && demoEntered));

  useEffect(() => {
    if (!readyForOnboarding) return;
    const fp = loginFingerprint ?? (ctx.isDemo && demoEntered ? "demo" : null);
    if (!fp) return;

    const roleKey = ctx.walkthroughKey;
    const loginChanged = lastLoginRef.current !== fp;
    if (loginChanged) {
      lastLoginRef.current = fp;
      lastRoleRef.current = roleKey;
      notifyLogin();
      resetSession();
      const t = window.setTimeout(() => {
        const show = shouldShowWhatsNew(roles, {
          userKey: ctx.userKey,
          employeeRole: ctx.employeeRole,
          entityType: ctx.entityType,
          includePlatform: ctx.isPlatformAdmin,
          isDemo: ctx.isDemo,
        });
        if (show && entries.length > 0) {
          setPhase("updates");
          return;
        }
        maybeOffer(roleKey);
      }, 480);
      return () => window.clearTimeout(t);
    }

    if (roleKey && roleKey !== lastRoleRef.current) {
      lastRoleRef.current = roleKey;
      const t = window.setTimeout(() => maybeOffer(roleKey), 360);
      return () => window.clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    readyForOnboarding,
    loginFingerprint,
    ctx.walkthroughKey,
    ctx.userKey,
    demoEntered,
  ]);

  useEffect(() => {
    if (forceWhatsNew && entries.length > 0) setPhase("updates");
  }, [forceWhatsNew, entries.length]);

  function maybeOffer(roleKey: WalkthroughKey | null) {
    if (!roleKey) {
      setPhase("idle");
      return;
    }
    if (!getWalkthrough(roleKey)) {
      setPhase("idle");
      return;
    }
    if (isComplete(ctx.userKey, roleKey)) {
      setPhase("idle");
      return;
    }
    if (wasOffered(roleKey)) {
      setPhase("idle");
      return;
    }
    markOffered(roleKey);
    setPhase("offer");
  }

  const closeUpdates = (silenceUntilNext: boolean) => {
    if (closingUpdates.current) return;
    closingUpdates.current = true;
    dismissWhatsNew({
      userKey: ctx.userKey,
      role: ctx.employeeRole,
      guideRoles: ctx.guideRoles,
      silenceUntilNext,
      lastSeenId: entries[0]?.id,
    });
    if (forceWhatsNew) {
      setPhase("idle");
      window.setTimeout(() => {
        closingUpdates.current = false;
      }, 400);
      return;
    }
    maybeOffer(ctx.walkthroughKey);
    window.setTimeout(() => {
      closingUpdates.current = false;
    }, 400);
  };

  const startWalk = () => {
    const key = ctx.walkthroughKey;
    setPhase("idle");
    if (!key) return;
    startRoleWalkthrough(key);
  };

  const skipWalk = () => {
    const key = ctx.walkthroughKey;
    if (key) markComplete(ctx.userKey, key);
    setPhase("idle");
  };

  const laterWalk = () => {
    setPhase("idle");
  };

  return (
    <>
      <div
        hidden
        data-onboarding-host
        data-phase={phase}
        data-ready={readyForOnboarding ? "1" : "0"}
        data-walk={ctx.walkthroughKey ?? ""}
        data-entered={ctx.demoEntered ? "1" : "0"}
        data-emp={ctx.employeeRole ?? ""}
        data-demo={ctx.isDemo ? "1" : "0"}
        data-hydrated={hydrated ? "1" : "0"}
        data-surface={onSurface ? "1" : "0"}
      />
      <LatestUpdatesModal
        open={phase === "updates" && entries.length > 0 && !tourRunning}
        entries={entries}
        onClose={closeUpdates}
      />
      {ctx.walkthroughKey && (
        <WalkthroughOffer
          open={phase === "offer" && !tourRunning}
          walkthroughKey={ctx.walkthroughKey}
          onStart={startWalk}
          onSkip={skipWalk}
          onLater={laterWalk}
        />
      )}
    </>
  );
}
