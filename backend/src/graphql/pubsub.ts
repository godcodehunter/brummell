// Tiny in-process publish/subscribe bus from graphql-yoga.
//
// "In-process" means it only works inside this Node process — if we ever
// scale to multiple servers we'd swap this out for Redis or similar.
//
// The generic declares the events we publish and the payload shape for each.
// The `[string, Comment]` form means newComment is routed by a string key
// (we use `${targetType}:${targetId}`), so subscribers see only events for
// the target they care about.

import { createPubSub } from "graphql-yoga";
import type { Article, Comment } from "../db/schema.js";

export const pubsub = createPubSub<{
  newArticle: [Article];
  newComment: [string, Comment];
}>();

export function commentTopicKey(
  targetType: "article" | "shot" | "podcast",
  targetId: number,
): string {
  return `${targetType}:${targetId}`;
}
