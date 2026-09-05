/**
 * Operators Guide packed at build time. Help reads this pack.
 * Stale guide = stale help. Feature work must update the guide in the same commit.
 * App publish (and location Publish) ships this bundle — there is no second knowledge store.
 */
import { GUIDE_TOPICS } from "@/lib/guide/catalog";
import { GUIDE_VERSION } from "@/lib/guide/types";
import type { GuideBlock, GuideTopic } from "@/lib/guide/types";
import type { HelpChunk } from "./retrieve";

export const HELP_PACK_VERSION = GUIDE_VERSION;

function blockText(b: GuideBlock): string[] {
  if (b.type === "why" || b.type === "p" || b.type === "tip" || b.type === "warn") return [b.text];
  if (b.type === "callout") return [b.title, b.text];
  if (b.type === "ul" || b.type === "ol" || b.type === "steps") return b.items;
  if (b.type === "screenshot") return [b.caption, b.alt];
  if (b.type === "cta") return [b.label, b.text ?? ""];
  return [];
}

function packTopic(t: GuideTopic): HelpChunk {
  const steps = t.blocks.flatMap((b) => (b.type === "steps" || b.type === "ol" ? b.items : []));
  const text = t.blocks.flatMap(blockText).join(" ").replace(/\s+/g, " ").trim().slice(0, 1600);
  return {
    id: t.id,
    title: t.title,
    summary: t.summary,
    roles: t.roles,
    visibility: t.visibility ?? "public",
    keywords: t.keywords ?? [],
    text,
    steps,
    openView: t.openView,
  };
}

export const HELP_CHUNKS: HelpChunk[] = GUIDE_TOPICS.map(packTopic);
