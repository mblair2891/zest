import type { GuideBlock, GuideTopic } from "../types";

export function why(text: string): GuideBlock {
  return { type: "why", text };
}

export function p(text: string): GuideBlock {
  return { type: "p", text };
}

export function tip(text: string): GuideBlock {
  return { type: "tip", text };
}

export function warn(text: string): GuideBlock {
  return { type: "warn", text };
}

export function callout(title: string, text: string): GuideBlock {
  return { type: "callout", title, text };
}

export function shot(caption: string, alt: string): GuideBlock {
  return { type: "screenshot", caption, alt };
}

export function ul(...items: string[]): GuideBlock {
  return { type: "ul", items };
}

export function ol(...items: string[]): GuideBlock {
  return { type: "ol", items };
}

export function steps(...items: string[]): GuideBlock {
  return { type: "steps", items };
}

export function related(...topicIds: string[]): GuideBlock {
  return { type: "related", topicIds };
}

export function topic(t: GuideTopic): GuideTopic {
  return t;
}
