import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookOpen,
  CheckCircle2,
  CircleHelp,
  ExternalLink,
  Printer,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { useGuideStore } from "@/lib/guide/store";
import {
  GUIDE_EDITION,
  GUIDE_ROLE_LABEL,
  GUIDE_ROLES,
  GUIDE_TITLE,
  GUIDE_VERSION,
  type GuideRole,
  type GuideRoleFilter,
} from "@/lib/guide/types";
import { GUIDE_TOPICS, topicById, topicVisible } from "@/lib/guide/catalog";
import { chaptersWithMatches } from "@/lib/guide/search";
import { canAccessView } from "@/lib/pos/rbac";
import type { EmployeeRole, PosView } from "@/lib/pos/types";
import { cn } from "@/lib/utils";
import { useGuideAudience } from "@/lib/guide/use-guide-audience";
import { GuideBlocks, CompleteCheck } from "./GuideBlocks";

function roleLabel(role: GuideRole) {
  return GUIDE_ROLE_LABEL[role];
}

export function OperatorsGuide({
  variant,
  onClose,
  topicId,
  onTopicChange,
  searchRef,
}: {
  variant: "overlay" | "page";
  onClose?: () => void;
  topicId?: string | null;
  onTopicChange?: (id: string) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
}) {
  const storeFocus = useGuideStore((s) => s.focusTopicId);
  const setFocus = useGuideStore((s) => s.setFocusTopic);
  const rememberTopic = useGuideStore((s) => s.rememberTopic);
  const toggleComplete = useGuideStore((s) => s.toggleComplete);
  const isComplete = useGuideStore((s) => s.isComplete);
  const continueTopicId = useGuideStore((s) => s.continueTopicId);
  const completedCount = useGuideStore((s) => s.completedCount);

  const { roles: sessionRoles, userKey, hasSessionRole } = useGuideAudience();
  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const setView = usePosStore((s) => s.setView);
  const emp = employees.find((e) => e.id === currentEmployeeId);
  const pinRole: EmployeeRole | null = emp?.role ?? null;

  const [query, setQuery] = useState("");
  const innerSearch = useRef<HTMLInputElement>(null);
  const inputRef = searchRef ?? innerSearch;

  const [filter, setFilter] = useState<GuideRoleFilter>(
    hasSessionRole ? "mine" : "all",
  );

  useEffect(() => {
    if (hasSessionRole) setFilter((f) => (f === "all" ? "mine" : f));
  }, [hasSessionRole]);

  const activeRoles: GuideRole[] | "all" = useMemo(() => {
    if (filter === "all") return "all";
    if (filter === "mine") return sessionRoles.length ? sessionRoles : "all";
    return [filter];
  }, [filter, sessionRoles]);

  const grouped = useMemo(
    () => chaptersWithMatches(query, activeRoles),
    [query, activeRoles],
  );

  const requested = topicId ?? storeFocus;
  const visibleIds = grouped.flatMap((g) => g.topics.map((t) => t.id));
  const activeId =
    requested && (visibleIds.includes(requested) || topicById(requested))
      ? requested
      : (visibleIds[0] ?? GUIDE_TOPICS[0]!.id);
  const active = topicById(activeId) ?? grouped[0]?.topics[0];

  useEffect(() => {
    if (!active) return;
    rememberTopic(userKey, active.id);
    if (variant === "overlay") setFocus(active.id);
    onTopicChange?.(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, userKey, variant]);

  const done = active ? isComplete(userKey, active.id) : false;
  const continueId = continueTopicId(userKey);
  const continueTopic = continueId ? topicById(continueId) : undefined;
  const progress = completedCount(userKey);

  const openTopic = (id: string) => {
    setFocus(id);
    onTopicChange?.(id);
  };

  const jumpToView = (view: PosView) => {
    if (!pinRole || !canAccessView(pinRole, view)) return;
    setView(view);
    onClose?.();
  };

  const header = (
    <header className="guide-no-print flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookOpen className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{GUIDE_TITLE}</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {GUIDE_EDITION} · v{GUIDE_VERSION}
          {hasSessionRole ? (
            <>
              {" "}
              ·{" "}
              <span className="font-medium text-foreground">
                {sessionRoles.map(roleLabel).join(" · ")}
              </span>
            </>
          ) : (
            " · all roles"
          )}
        </p>
      </div>
      <p className="hidden text-[11px] text-muted-foreground sm:block">
        {progress} marked complete
      </p>
      <Button
        size="icon"
        variant="ghost"
        className="hidden sm:inline-flex"
        onClick={() => window.print()}
        aria-label="Print topic"
      >
        <Printer className="h-4 w-4" />
      </Button>
      {variant === "overlay" && (
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close guide">
          <X className="h-5 w-5" />
        </Button>
      )}
      {variant === "page" && (
        <Link
          to="/"
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Home
        </Link>
      )}
    </header>
  );

  return (
    <div
      className={cn(
        "guide-print-root flex flex-col bg-bg text-foreground",
        variant === "overlay"
          ? "fixed inset-0 z-[60] pt-[var(--grok-banner-h,0px)]"
          : "min-h-[100dvh] pt-[var(--grok-banner-h,0px)]",
      )}
      role={variant === "overlay" ? "dialog" : undefined}
      aria-modal={variant === "overlay" ? true : undefined}
      aria-label={GUIDE_TITLE}
    >
      {header}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="guide-no-print flex max-h-[42vh] w-full shrink-0 flex-col border-b border-border bg-surface md:max-h-none md:max-w-[20rem] md:border-b-0 md:border-r">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={inputRef}
                className="h-9 pl-8"
                placeholder="Search the guide…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search operators guide"
              />
            </div>
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
              <FilterChip
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </FilterChip>
              {hasSessionRole && (
                <FilterChip
                  active={filter === "mine"}
                  onClick={() => setFilter("mine")}
                >
                  My role
                </FilterChip>
              )}
              {GUIDE_ROLES.map((r) => (
                <FilterChip
                  key={r}
                  active={filter === r}
                  onClick={() => setFilter(r)}
                >
                  {roleLabel(r)}
                </FilterChip>
              ))}
            </div>
            {continueTopic && continueTopic.id !== activeId && (
              <button
                type="button"
                onClick={() => openTopic(continueTopic.id)}
                className="w-full rounded-lg border border-border bg-bg px-2.5 py-2 text-left text-[11px] leading-snug hover:border-primary/40"
              >
                <span className="font-semibold text-foreground">
                  Continue where you left off
                </span>
                <span className="mt-0.5 block text-muted-foreground">
                  {continueTopic.title}
                </span>
              </button>
            )}
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            {grouped.map(({ chapter, topics }) => (
              <div key={chapter.id} className="mb-3">
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {chapter.title}
                </p>
                {topics.map((t) => {
                  const mine = topicVisible(t, sessionRoles.length ? sessionRoles : "all");
                  const complete = isComplete(userKey, t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => openTopic(t.id)}
                      className={cn(
                        "mb-0.5 flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition",
                        activeId === t.id
                          ? "bg-primary/10 text-foreground"
                          : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                      )}
                    >
                      <CompleteCheck on={complete} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug">
                          {t.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                          {t.summary}
                        </span>
                        {filter === "all" && hasSessionRole && !mine && (
                          <span className="mt-1 inline-block text-[10px] text-muted-foreground">
                            Cross-training
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No topics match. Try “chargeback” or “multi-operator”.
              </p>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {active && (
            <article className="guide-article mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
              <div className="space-y-2">
                <AudienceBadges audience={active.roles} />
                <h1 className="text-2xl font-semibold tracking-tight">{active.title}</h1>
                <p className="text-sm text-muted-foreground">{active.summary}</p>
                <div className="flex flex-wrap gap-2">
                  {active.openView && pinRole && canAccessView(pinRole, active.openView) && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => jumpToView(active.openView!)}
                    >
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      Open in app
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={done ? "outline" : "default"}
                    onClick={() => toggleComplete(userKey, active.id)}
                  >
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                    {done ? "Completed" : "Mark complete"}
                  </Button>
                </div>
              </div>

              <GuideBlocks blocks={active.blocks} onOpenTopic={openTopic} />

              <footer className="border-t border-border pt-4 text-[11px] text-muted-foreground">
                Summex, powered by Quantum Reach · {GUIDE_TITLE} · Guest cards via
                Quantum Payments. Press Esc to close · / to search.
              </footer>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-surface-2 text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function AudienceBadges({
  audience,
}: {
  audience: GuideRole[] | "all";
}) {
  if (audience === "all") {
    return (
      <Badge variant="secondary" className="text-[10px]">
        All roles
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      {audience.map((r) => (
        <Badge key={r} variant="info" className="text-[10px]">
          {roleLabel(r)}
        </Badge>
      ))}
    </div>
  );
}

export function GuideTriggerButton({
  topicId = "intro",
  size = "sm",
  label,
}: {
  topicId?: string;
  size?: "sm" | "icon";
  label?: string;
}) {
  const openGuide = useGuideStore((s) => s.openGuide);
  if (size === "icon") {
    return (
      <Button
        size="icon"
        variant="outline"
        className="h-9 w-9"
        onClick={() => openGuide(topicId)}
        aria-label="Open operators guide"
        title="Operators Guide"
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      className="h-9 gap-1.5 bg-primary px-3 font-semibold text-primary-foreground hover:bg-primary/90"
      onClick={() => openGuide(topicId)}
      aria-label="Open operators guide"
    >
      <BookOpen className="h-4 w-4" />
      <span className="hidden sm:inline">{label ?? "Guide"}</span>
      <span className="sm:hidden">?</span>
    </Button>
  );
}
