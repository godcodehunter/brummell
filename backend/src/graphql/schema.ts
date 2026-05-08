// GraphQL schema, defined with Pothos.
//
// Pothos is a "code-first" schema builder: instead of writing GraphQL SDL
// (the `type Article { ... }` strings), we declare types and fields in TS
// and Pothos generates the schema. Big advantage: every resolver is fully
// typed against our DB rows.
//
// The flow inside this file:
//   1. Tell Pothos the names of our object types and what TS shape backs
//      each one (the `Objects` map in the builder generic).
//   2. `objectType(...)` — declare which fields each GraphQL type exposes.
//   3. `queryType / mutationType / subscriptionType` — declare the entry
//      points clients can call.
//   4. `builder.toSchema()` — produce the executable schema for Yoga.

import SchemaBuilder from "@pothos/core";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { articles, articleTags, tags, type Article } from "../db/schema.js";
import { pubsub } from "./pubsub.js";

// The shape of a tag as the GraphQL layer sees it. Both `articleTags` rows
// and `tags` rows are structurally compatible with this — they both have
// `label/color/tooltip` — so we use one GraphQL type for both.
type TagShape = { label: string; color: string; tooltip: string };

const builder = new SchemaBuilder<{
  Objects: {
    Article: Article;
    Tag: TagShape;
  };
}>({});

builder.objectType("Tag", {
  // `t.exposeString("label")` is shorthand for "this GraphQL field is
  // a String, and its value is the row's `label` property."
  fields: (t) => ({
    label: t.exposeString("label"),
    color: t.exposeString("color"),
    tooltip: t.exposeString("tooltip"),
  }),
});

builder.objectType("Article", {
  fields: (t) => ({
    id: t.exposeID("id"),
    headline: t.exposeString("headline"),
    illustration: t.exposeString("illustration"),
    preview_txt: t.exposeString("preview_txt"),
    reading_time_min: t.exposeInt("reading_time_min"),
    publication_time: t.exposeInt("publication_time"),
    // `tags` is computed: for each Article we run a separate query to fetch
    // its tags. Note: this is the classic "N+1" pattern — fine for a tiny
    // demo, but a real app would batch with DataLoader.
    tags: t.field({
      type: ["Tag"],
      resolve: (article) =>
        db
          .select()
          .from(articleTags)
          .where(eq(articleTags.article_id, article.id))
          .all(),
    }),
  }),
});

// Read-only entry points.
builder.queryType({
  fields: (t) => ({
    getArticle: t.field({
      type: ["Article"],
      resolve: () => db.select().from(articles).all(),
    }),
    getTag: t.field({
      type: ["Tag"],
      resolve: () => db.select().from(tags).all(),
    }),
  }),
});

// Write entry points.
builder.mutationType({
  fields: (t) => ({
    addNewArticle: t.field({
      type: "Article",
      args: {
        content: t.arg.string({ required: true }),
        author: t.arg.string({ required: true }),
      },
      resolve: (_, { content }) => {
        // Insert and grab the inserted row (with its auto-incremented id).
        const created = db
          .insert(articles)
          .values({
            headline: content.slice(0, 80),
            illustration: "",
            preview_txt: content,
            reading_time_min: 1,
            publication_time: Math.floor(Date.now() / 1000),
          })
          .returning()
          .all()[0]!;

        // Notify everyone subscribed to `newArticle`.
        pubsub.publish("newArticle", created);
        return created;
      },
    }),
  }),
});

// Live updates pushed to clients over WebSocket.
builder.subscriptionType({
  fields: (t) => ({
    newArticle: t.field({
      type: "Article",
      // `subscribe` returns an async iterator. Yoga keeps the connection
      // open and forwards every yielded payload to the client.
      subscribe: () => pubsub.subscribe("newArticle"),
      // `resolve` shapes each payload before it goes to the client. Here
      // we just hand it through unchanged.
      resolve: (payload: Article) => payload,
    }),
  }),
});

export const schema = builder.toSchema();
