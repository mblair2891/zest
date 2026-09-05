/** Rank packed guide chunks. Platform CRM never reaches servers. */

function tokenize(q: string): string[] {
  const stop = new Set(["the", "a", "an", "to", "of", "and", "or", "for", "in", "on", "how", "do", "i", "we", "my", "this", "that", "is", "it", "please", "can", "what"]);
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter((t) => t.length >= 2 && !stop.has(t));
}

export type HelpChunk = {
  id: string;
  title: string;
  summary: string;
  roles: string[] | "all";
  visibility: "public" | "signed" | "platform";
  keywords: string[];
  text: string;
  steps: string[];
  openView?: string;
};

export function chunkVisibleTo(
  chunk: HelpChunk,
  roles: string[],
  includePlatform: boolean,
): boolean {
  if (chunk.visibility === "platform" && !includePlatform) return false;
  if (chunk.id === "platform-crm" && !includePlatform) return false;
  if (chunk.roles === "all") return true;
  if (roles.length === 0) return includePlatform || chunk.visibility !== "platform";
  if (chunk.roles.every((r) => r === "platform_admin") && !includePlatform) return false;
  return chunk.roles.some((r) => roles.includes(r));
}

export function scoreHelpChunk(chunk: HelpChunk, tokens: string[], screen?: string): number {
  if (!tokens.length) return screen && chunk.openView === screen ? 2 : 0;
  const hay = `${chunk.title} ${chunk.summary} ${chunk.keywords.join(" ")} ${chunk.text}`.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (chunk.title.toLowerCase().includes(t)) score += 5;
    if (chunk.keywords.some((k) => k.toLowerCase().includes(t))) score += 3;
    if (hay.includes(t)) score += 1;
  }
  if (screen && chunk.openView === screen) score += 4;
  return score;
}

export function selectHelpChunks(
  chunks: HelpChunk[],
  query: string,
  roles: string[],
  opts: { includePlatform: boolean; screen?: string; limit?: number },
): HelpChunk[] {
  const tokens = tokenize(query);
  const visible = chunks.filter((c) => chunkVisibleTo(c, roles, opts.includePlatform));
  const ranked = visible
    .map((c) => ({ c, s: scoreHelpChunk(c, tokens, opts.screen) }))
    .filter((r) => r.s > 0)
    .sort((a, b) => b.s - a.s);
  const limit = opts.limit ?? 6;
  const picked = (ranked.length ? ranked : visible.map((c) => ({ c, s: 0 }))).slice(0, limit);
  return picked.map((r) => r.c);
}
