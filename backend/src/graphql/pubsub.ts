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
