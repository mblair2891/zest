import { useEffect, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { OperatorsGuide } from "@/components/guide/OperatorsGuide";
import { useGuideStore } from "@/lib/guide/store";
import { GUIDE_TITLE } from "@/lib/guide/types";

export const Route = createFileRoute("/guide")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>): { topic?: string } => {
    const topic = typeof s.topic === "string" && s.topic.length > 0 ? s.topic : undefined;
    return topic ? { topic } : {};
  },
  head: () => ({
    meta: [{ title: `${GUIDE_TITLE} · Summex` }],
  }),
  component: GuidePage,
});

function GuidePage() {
  const { topic } = Route.useSearch();
  const navigate = useNavigate({ from: "/guide" });
  const searchRef = useRef<HTMLInputElement>(null);
  const setFocus = useGuideStore((s) => s.setFocusTopic);

  useEffect(() => {
    void useGuideStore.persist.rehydrate();
    if (topic) setFocus(topic);
  }, [topic, setFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <OperatorsGuide
      variant="page"
      topicId={topic ?? null}
      searchRef={searchRef}
      onTopicChange={(id) => {
        void navigate({
          search: { topic: id },
          replace: true,
        });
      }}
    />
  );
}
