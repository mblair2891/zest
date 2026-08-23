export {
  GUIDE_VERSION,
  GUIDE_EDITION,
  GUIDE_TITLE,
  GUIDE_ROLES,
  GUIDE_ROLE_LABEL,
  GUIDE_ROLE_BLURB,
  type GuideRole,
  type GuideAudience,
  type GuideBlock,
  type GuideChapter,
  type GuideTopic,
  type GuideUpdate,
  type GuideRoleFilter,
} from "./types";
export { GUIDE_CHAPTERS, GUIDE_TOPICS, topicById, relatedTopics, topicVisible } from "./catalog";
export { searchTopics, chaptersWithMatches } from "./search";
export {
  GUIDE_UPDATES,
  updatesForRoles,
  latestUpdateId,
  hasUnseenUpdates,
} from "./updates";
export { employeeToGuideRoles, saasRoleToGuideRoles, topicMatchesRoles } from "./roles";
export { useGuideStore, useManualStore } from "./store";
