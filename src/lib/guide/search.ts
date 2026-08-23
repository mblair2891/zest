import { GUIDE_CHAPTERS, GUIDE_TOPICS, haystack, topicVisible } from "./catalog";
import type { GuideChapter, GuideRole, GuideTopic } from "./types";

export function searchTopics(
  query: string,
  roles: GuideRole[] | "all" = "all",
  opts?: { includePlatform?: boolean },
): GuideTopic[] {
  const q = query.trim().toLowerCase();
  return GUIDE_TOPICS.filter((t) => {
    if (!topicVisible(t, roles, opts)) return false;
    if (!q) return true;
    return haystack(t).includes(q);
  });
}

export function chaptersWithMatches(
  query: string,
  roles: GuideRole[] | "all" = "all",
  opts?: { includePlatform?: boolean },
): Array<{ chapter: GuideChapter; topics: GuideTopic[] }> {
  const topics = searchTopics(query, roles, opts);
  return GUIDE_CHAPTERS.map((chapter) => ({
    chapter,
    topics: topics.filter((t) => t.chapterId === chapter.id),
  })).filter((row) => row.topics.length > 0);
}
