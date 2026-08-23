import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useGuideStore } from "@/lib/guide/store";
import { OperatorsGuide } from "./OperatorsGuide";

/**
 * Global overlay + keyboard. Mount once in the document shell so Guide is
 * reachable from POS, platform, login, and empty states without per-page copies.
 */
export function GuideHost() {
  const open = useGuideStore((s) => s.guideOpen);
  const close = useGuideStore((s) => s.closeGuide);
  const searchRef = useRef<HTMLInputElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onGuidePage = pathname === "/guide" || pathname.startsWith("/guide/");

  useEffect(() => {
    const done = () => undefined;
    const u = useGuideStore.persist.onFinishHydration(done);
    void useGuideStore.persist.rehydrate();
    return () => u();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "Escape" && open) {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === "/" && open && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (onGuidePage || !open) return null;

  return (
    <OperatorsGuide
      variant="overlay"
      onClose={close}
      searchRef={searchRef}
    />
  );
}

/** @deprecated old name — overlay now lives in GuideHost */
export function OperatorsGuideOverlay() {
  return <GuideHost />;
}
