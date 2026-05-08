// Tiny in-process publish/subscribe bus from graphql-yoga.
//
// "In-process" means it only works inside this Node process — if we ever
// scale to multiple servers we'd swap this out for Redis or similar.
//
// The generic `<{ newArticle: [Article] }>` declares the events we publish
// and the payload shape for each. TypeScript will complain if we publish
// the wrong type or subscribe to an unknown event — that's the whole point
// of declaring it here.

import { createPubSub } from "graphql-yoga";
import type { Article } from "../db/schema.js";

export const pubsub = createPubSub<{
  newArticle: [Article];
}>();
