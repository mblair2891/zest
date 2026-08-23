import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Lightbulb,
  ListOrdered,
  PanelRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideBlock } from "@/lib/guide/types";
import { topicById } from "@/lib/guide/catalog";

export function GuideBlocks({
  blocks,
  onOpenTopic,
}: {
  blocks: GuideBlock[];
  onOpenTopic: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) => (
        <GuideBlockView key={i} block={b} onOpenTopic={onOpenTopic} />
      ))}
    </div>
  );
}

function GuideBlockView({
  block,
  onOpenTopic,
}: {
  block: GuideBlock;
  onOpenTopic: (id: string) => void;
}) {
  if (block.type === "why") {
    return (
      <div className="rounded-xl border border-border bg-surface-2/60 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Why it matters
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{block.text}</p>
      </div>
    );
  }
  if (block.type === "p") {
    return <p className="text-sm leading-relaxed text-muted-foreground">{block.text}</p>;
  }
  if (block.type === "tip") {
    return (
      <div className="flex gap-2 rounded-xl border border-info/25 bg-info/5 px-3 py-2.5 text-sm text-foreground">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-info" />
        <p>
          <span className="font-semibold text-info">Tip · </span>
          {block.text}
        </p>
      </div>
    );
  }
  if (block.type === "warn") {
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
  if (block.type === "callout") {
    return (
      <div className="flex gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm">
        <PanelRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          <span className="font-semibold text-foreground">{block.title} · </span>
          <span className="text-muted-foreground">{block.text}</span>
        </p>
      </div>
    );
  }
  if (block.type === "screenshot") {
    return (
      <figure className="overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface-2">
        <div
          className="flex min-h-[7.5rem] items-center justify-center gap-2 px-4 py-8 text-muted-foreground"
          role="img"
          aria-label={block.alt}
        >
          <Camera className="h-5 w-5 shrink-0" />
          <span className="max-w-sm text-center text-xs leading-relaxed">{block.alt}</span>
        </div>
        <figcaption className="border-t border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
          {block.caption}
        </figcaption>
      </figure>
    );
  }
  if (block.type === "ul" || block.type === "ol" || block.type === "steps") {
    const ordered = block.type === "ol" || block.type === "steps";
    const ListTag = ordered ? "ol" : "ul";
    return (
      <div className="space-y-2">
        {block.type === "steps" && (
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
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
  if (block.type === "related") {
    const topics = block.topicIds
      .map((id) => topicById(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    if (topics.length === 0) return null;
    return (
      <div className="border-t border-border pt-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Related topics
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {topics.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpenTopic(t.id)}
                className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-primary/40"
              >
                {t.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return null;
}

export function CompleteCheck({ on }: { on: boolean }) {
  return (
    <CheckCircle2
      className={cn(
        "h-3.5 w-3.5 shrink-0",
        on ? "text-success" : "text-border-strong",
      )}
    />
  );
}
