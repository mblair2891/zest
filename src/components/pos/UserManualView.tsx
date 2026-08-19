import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  Search,
  Sparkles,
  X,
  Lightbulb,
  AlertTriangle,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usePosStore } from "@/lib/pos/store";
import { useManualStore } from "@/lib/pos/manual-store";
import {
  MANUAL_EDITION,
  MANUAL_SECTIONS,
  MANUAL_VERSION,
  searchSections,
  sectionVisibleToRole,
  type ManualBlock,
  type ManualSection,
} from "@/lib/pos/manual-content";
import { ROLE_LABEL, canAccessView } from "@/lib/pos/rbac";
import type { EmployeeRole, PosView } from "@/lib/pos/types";
import { cn } from "@/lib/utils";

function roleLabel(role: EmployeeRole) {
  return ROLE_LABEL[role];
}

function AudienceBadges({ audience }: { audience: ManualSection["audience"] }) {
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
        <Badge key={r} variant="info" className="text-[10px] capitalize">
          {roleLabel(r)}
        </Badge>
      ))}
    </div>
  );
}

function BlockView({ block }: { block: ManualBlock }) {
  if (block.type === "p" && block.text) {
    return (
      <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>
    );
  }
  if (block.type === "tip" && block.text) {
    return (
      <div className="flex gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm text-foreground">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <span className="font-semibold text-primary">Tip · </span>
          {block.text}
        </p>
      </div>
    );
  }
  if (block.type === "warn" && block.text) {
    return (
      <div className="flex gap-2 rounded-xl border border-warn/40 bg-warn/10 px-3 py-2.5 text-sm text-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
        <p>
          <span className="font-semibold text-warn">Note · </span>
          {block.text}
        </p>
      </div>
    );
  }
  if (
    (block.type === "ul" || block.type === "ol" || block.type === "steps") &&
    block.items
  ) {
    const ordered = block.type === "ol" || block.type === "steps";
    const ListTag = ordered ? "ol" : "ul";
    return (
      <div className="space-y-2">
        {block.type === "steps" && (
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <ListOrdered className="h-3.5 w-3.5" />
            Steps
          </p>
        )}
        <ListTag
          className={cn(
            "space-y-1.5 text-sm text-muted-foreground",
            ordered ? "list-decimal pl-5" : "list-disc pl-5",
          )}
        >
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">
              {item}
            </li>
          ))}
        </ListTag>
      </div>
    );
  }
  return null;
}

export function UserManualOverlay() {
  const open = useManualStore((s) => s.manualOpen);
  const close = useManualStore((s) => s.closeManual);
  const focusSectionId = useManualStore((s) => s.focusSectionId);
  const setFocus = useManualStore((s) => s.setFocusSection);
  const openWhatsNew = useManualStore((s) => s.openWhatsNew);
  const updatesFor = useManualStore((s) => s.updatesFor);

  const employees = usePosStore((s) => s.employees);
  const currentEmployeeId = usePosStore((s) => s.currentEmployeeId);
  const setView = usePosStore((s) => s.setView);
  const emp = employees.find((e) => e.id === currentEmployeeId);
  const role: EmployeeRole = emp?.role ?? "server";

  const [query, setQuery] = useState("");
  const [filterMine, setFilterMine] = useState(false);

  const sections = useMemo(() => {
    return searchSections(query, filterMine ? role : "all");
  }, [query, filterMine, role]);

  const activeId =
    focusSectionId && sections.some((s) => s.id === focusSectionId)
      ? focusSectionId
      : (sections[0]?.id ?? MANUAL_SECTIONS[0]!.id);

  const active = MANUAL_SECTIONS.find((s) => s.id === activeId) ?? sections[0];

  useEffect(() => {
    if (!open) return;
    if (focusSectionId) return;
    setFocus("intro");
  }, [open, focusSectionId, setFocus]);

  if (!open) return null;

  const roleUpdates = updatesFor(role, 5);

  const jumpToView = (view: PosView) => {
    if (!canAccessView(role, view)) return;
    setView(view);
    close();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-bg pt-[var(--grok-banner-h,0px)] text-foreground"
      role="dialog"
      aria-modal="true"
      aria-label="Zest user manual"
    >
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 sm:px-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-black text-primary-foreground">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Zest user manual</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {MANUAL_EDITION} · v{MANUAL_VERSION} · signed in as{" "}
            <span className="font-medium text-primary">{roleLabel(role)}</span>
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="hidden sm:inline-flex"
          onClick={() => {
            close();
            openWhatsNew();
          }}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          What’s new
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={close}
          aria-label="Close manual"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[40vh] w-full shrink-0 flex-col border-b border-border bg-surface md:max-h-none md:max-w-[19rem] md:border-b-0 md:border-r">
          <div className="space-y-2 border-b border-border p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-9 pl-8"
                placeholder="Search manual…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="accent-primary"
                checked={filterMine}
                onChange={(e) => setFilterMine(e.target.checked)}
              />
              Only chapters for {roleLabel(role)}
            </label>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto p-2">
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Chapters ({sections.length})
            </p>
            {sections.map((s) => {
              const forMe = sectionVisibleToRole(s, role);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setFocus(s.id)}
                  className={cn(
                    "mb-0.5 w-full rounded-xl px-2.5 py-2 text-left transition",
                    activeId === s.id
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <span className="block text-sm font-medium leading-snug">
                    {s.title}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug opacity-80">
                    {s.summary}
                  </span>
                  {!forMe && (
                    <span className="mt-1 inline-block text-[10px] text-muted-foreground">
                      Cross-training
                    </span>
                  )}
                </button>
              );
            })}
            {sections.length === 0 && (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                No chapters match.
              </p>
            )}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          {active && (
            <article className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
              <div className="space-y-2">
                <AudienceBadges audience={active.audience} />
                <h1 className="text-2xl font-black tracking-tight">
                  {active.title}
                </h1>
                <p className="text-sm text-muted-foreground">{active.summary}</p>
                {active.openView && canAccessView(role, active.openView) && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => jumpToView(active.openView!)}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open in app
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                {active.blocks.map((b, i) => (
                  <BlockView key={i} block={b} />
                ))}
              </div>

              {active.id === "intro" && roleUpdates.length > 0 && (
                <section className="mt-8 rounded-2xl border border-border bg-surface p-4">
                  <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Recent updates for {roleLabel(role)}
                  </h2>
                  <ul className="space-y-3">
                    {roleUpdates.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          className="w-full rounded-xl border border-border bg-bg px-3 py-2.5 text-left hover:border-primary/40"
                          onClick={() =>
                            u.manualSectionId && setFocus(u.manualSectionId)
                          }
                        >
                          <p className="text-xs text-muted-foreground">
                            {u.date}
                          </p>
                          <p className="text-sm font-medium">{u.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {u.summary}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <footer className="border-t border-border pt-4 text-[11px] text-muted-foreground">
                Zest Hospitality OS · Interactive manual · Update chapters when
                features ship so staff always have current docs.
              </footer>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
