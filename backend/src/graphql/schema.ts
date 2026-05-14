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
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  articles,
  tagSets,
  tags,
  owners,
  comments,
  commentTargets,
  posters,
  type Article,
  type Tag,
  type Owner,
  type ExternalLink,
  type Comment,
  type Poster,
  type CommentTargetType,
} from "../db/schema.js";
import { pubsub, commentTopicKey } from "./pubsub.js";
import { notifyNewComment } from "../notifications.js"
import { randomBytes } from "node:crypto";
import {
  verifyPassword,
  issueToken,
  prepaireForStorage,
} from "../admin_pass.js"

export interface Context {
  token: string | null;
  isAuthorized: boolean;
}

type AuthPayloadShape = { token: string };

const builder = new SchemaBuilder<{
  Context: Context;
  Objects: {
    Article: Article;
    Tag: Tag;
    Owner: Owner;
    ExternalLink: ExternalLink;
    AuthPayload: AuthPayloadShape;
    Comment: Comment;
    Poster: Poster;
  };
}>({});

const CommentTargetTypeEnum = builder.enumType("CommentTargetType", {
  values: ["article", "shot", "podcast"] as const,
});

const DifficultyEnum = builder.enumType("Difficulty", {
  values: ["easy", "medium", "hard", "extra_hard"] as const,
});

builder.objectType("Tag", {
  fields: (t) => ({
    id: t.exposeID("id"),
    label: t.exposeString("label"),
    color: t.exposeString("color"),
    tooltip: t.exposeString("tooltip"),
  }),
});

builder.objectType("Article", {
  fields: (t) => ({
    id: t.exposeID("id"),
    kicker: t.exposeString("kicker"),
    headline: t.exposeString("headline"),
    illustration: t.exposeString("illustration"),
    preview_txt: t.exposeString("preview_txt"),
    reading_time_min: t.exposeInt("reading_time_min"),
    created_at: t.exposeInt("created_at"),
    tags: t.field({
      type: ["Tag"],
      resolve: (article) => {
        const target = db
          .select()
          .from(tagSets)
          .where(
            and(eq(tagSets.type, "article"), eq(tagSets.entity_id, article.id)),
          )
          .all()[0];
        if (!target || target.tag_ids.length === 0) return [];
        return db.select().from(tags).where(inArray(tags.id, target.tag_ids)).all();
      },
    }),
  }),
});

builder.objectType("ExternalLink", {
  fields: (t) => ({
    svg_icon: t.exposeString("svg_icon"),
    url: t.exposeString("url"),
  }),
});

// Public profile of the blog owner. Note: password_hash/password_salt are
// columns on the `Owner` row but deliberately not exposed here.
builder.objectType("Owner", {
  fields: (t) => ({
    id: t.exposeID("id"),
    nickname: t.exposeString("nickname"),
    about_myself: t.exposeString("about_myself"),
    avatar: t.exposeString("avatar"),
    external_links: t.field({
      type: ["ExternalLink"],
      resolve: (owner) => owner.external_links,
    }),
  }),
});

builder.objectType("AuthPayload", {
  fields: (t) => ({
    token: t.exposeString("token"),
  }),
});

builder.objectType("Poster", {
  fields: (t) => ({
    id: t.exposeID("id"),
    provider: t.exposeString("provider"),
    display_name: t.exposeString("display_name"),
    avatar_url: t.exposeString("avatar_url", { nullable: true }),
  }),
});

builder.objectType("Comment", {
  fields: (t) => ({
    id: t.exposeID("id"),
    text: t.exposeString("text"),
    created_at: t.exposeInt("created_at"),
    poster: t.field({
      type: "Poster",
      resolve: (comment) => {
        const row = db.select().from(posters).where(eq(posters.id, comment.poster)).all()[0];
        if (!row) throw new Error("POSTER_NOT_FOUND");
        return row;
      },
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
    // Returns null when no owner has been set up yet — that's the signal
    // for the client to switch into "create owner" mode.
    getOwner: t.field({
      type: "Owner",
      nullable: true,
      resolve: () => db.select().from(owners).all()[0] ?? null,
    }),
    // True iff the request carries a still-live token. Client uses it to
    // decide whether the cached localStorage token is worth trusting after
    // a server restart (which wipes the in-memory `sessions` set).
    validateToken: t.field({
      type: "Boolean",
      resolve: (_root, _args, ctx) => ctx.isAuthorized,
    }),

    // All comments for a given target, oldest first. Returns an empty list
    // if no `comment_targets` row exists yet (i.e. nobody has posted here).
    getComments: t.field({
      type: ["Comment"],
      args: {
        targetType: t.arg({ type: CommentTargetTypeEnum, required: true }),
        targetId: t.arg.int({ required: true }),
      },
      resolve: (_, { targetType, targetId }) => {
        const target = db
          .select()
          .from(commentTargets)
          .where(
            and(
              eq(commentTargets.type, targetType),
              eq(commentTargets.entity_id, targetId),
            ),
          )
          .all()[0];
        if (!target) return [];
        return db
          .select()
          .from(comments)
          .where(eq(comments.target_id, target.id))
          .all();
      },
    }),
  }),
});

// Write entry points.
builder.mutationType({
  fields: (t) => ({
    addNewArticle: t.field({
      type: "Article",
      args: {
        kicker: t.arg.string({ required: true }),
        headline: t.arg.string({ required: true }),
        illustration: t.arg.string({ required: true }),
        preview_txt: t.arg.string({ required: true }),
        reading_time_min: t.arg.int({ required: true }),
        difficulty: t.arg({ type: DifficultyEnum, required: true }),
      },
      resolve: (_, args, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");

        // Insert and grab the inserted row (with its auto-incremented id).
        const created = db
          .insert(articles)
          .values({
            kicker: args.kicker,
            headline: args.headline,
            illustration: args.illustration,
            preview_txt: args.preview_txt,
            reading_time_min: args.reading_time_min,
            difficulty: args.difficulty,
            created_at: Math.floor(Date.now() / 1000) ,
          })
          .returning()
          .all()[0]!;

        pubsub.publish("newArticle", created);
        return created;
      },
    }),

    // First-run bootstrap: creates the single Owner row with a freshly
    // generated salt + hashed password. Errors out if an owner already
    // exists, so this can't be used to overwrite credentials.
    setupOwner: t.field({
      type: "AuthPayload",
      args: {
        password: t.arg.string({ required: true }),
      },
      resolve: (_, { password }) => {
        const existing = db.select().from(owners).all();
        if (existing.length > 0) {
          throw new Error("OWNER_ALREADY_EXISTS");
        }
        const {password_hash, salt} = prepaireForStorage(password);
        db.insert(owners)
          .values({ password_hash, password_salt: salt })
          .run();
        return { token: issueToken() };
      },
    }),

    // Verifies a password against the stored hash and issues a session
    // token. Distinguishable error codes let the client tell "no owner
    // yet" apart from "wrong password".
    signIn: t.field({
      type: "AuthPayload",
      args: {
        password: t.arg.string({ required: true }),
      },
      resolve: (_, { password }) => {
        const owner = db.select().from(owners).all()[0];
        if (!owner) throw new Error("OWNER_NOT_FOUND");
        if (!verifyPassword(password, owner.password_salt, owner.password_hash)) {
          throw new Error("INVALID_PASSWORD");
        }
        return { token: issueToken() };
      },
    }),

    // Anonymous-only for now: each message creates a fresh `posters` row
    // tagged provider="anonymous" with a random provider_user_id (the unique
    // index on (provider, provider_user_id) requires uniqueness). OAuth
    // sign-in paths will reuse an existing poster instead.
    postComment: t.field({
      type: "Comment",
      args: {
        targetType: t.arg({ type: CommentTargetTypeEnum, required: true }),
        targetId: t.arg.int({ required: true }),
        text: t.arg.string({ required: true }),
        displayName: t.arg.string({ required: true }),
      },
      resolve: (_, { targetType, targetId, text, displayName }) => {
        const now = Math.floor(Date.now() / 1000);

        // Find-or-create the target row. Two concurrent posts on a brand
        // new target would race here; the unique index would force one to
        // fail. Good enough for a single-process demo.
        let target = db
          .select()
          .from(commentTargets)
          .where(
            and(
              eq(commentTargets.type, targetType),
              eq(commentTargets.entity_id, targetId),
            ),
          )
          .all()[0];
        if (!target) {
          target = db
            .insert(commentTargets)
            .values({ type: targetType, entity_id: targetId })
            .returning()
            .all()[0]!;
        }

        const poster = db
          .insert(posters)
          .values({
            provider: "anonymous",
            provider_user_id: randomBytes(8).toString("hex"),
            display_name: displayName,
            created_at: now,
          })
          .returning()
          .all()[0]!;

        const created = db
          .insert(comments)
          .values({
            target_id: target.id,
            poster: poster.id,
            text,
            created_at: now,
          })
          .returning()
          .all()[0]!;

        notifyNewComment(created, target);
        pubsub.publish(
          "newComment",
          commentTopicKey(targetType as CommentTargetType, targetId),
          created,
        );
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

    // Each subscriber gets only events whose routing key matches the
    // (targetType, targetId) they supplied — the pubsub bus does the
    // filtering for us via the second arg to `subscribe`.
    newComment: t.field({
      type: "Comment",
      args: {
        targetType: t.arg({ type: CommentTargetTypeEnum, required: true }),
        targetId: t.arg.int({ required: true }),
      },
      subscribe: (_, { targetType, targetId }) =>
        pubsub.subscribe(
          "newComment",
          commentTopicKey(targetType as CommentTargetType, targetId),
        ),
      resolve: (payload: Comment) => payload,
    }),
  }),
});

export const schema = builder.toSchema();
