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
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
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
  type Owner,
  type ExternalLink,
  type Comment,
  type Poster,
  type CommentTargetType,
} from "../db/schema.js";
import { pubsub, commentTopicKey } from "./pubsub.js";

// The shape of a tag as the GraphQL layer sees it. Both `entityTags` rows
// and `tags` rows are structurally compatible with this — they both have
// `label/color/tooltip` — so we use one GraphQL type for both.
type TagShape = { label: string; color: string; tooltip: string };

type AuthPayloadShape = { token: string };

// Password hashing via Node's built-in scrypt — no extra deps. Salt is per-row
// (so identical passwords produce different hashes) and stored next to the
// hash. timingSafeEqual avoids leaking equality info via comparison time.
const SCRYPT_KEYLEN = 64;

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
}

function verifyPassword(password: string, salt: string, expectedHex: string): boolean {
  const computed = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHex, "hex");
  if (computed.length !== expected.length) return false;
  return timingSafeEqual(computed, expected);
}

// In-memory session store. Lost on restart — fine for a single-owner demo.
// For persistence move to a `sessions` table and check by token on each
// authenticated mutation.
const sessions = new Set<string>();

function issueToken(): string {
  const token = randomBytes(32).toString("hex");
  sessions.add(token);
  return token;
}

// Exported so the Yoga context factory in server.ts can decide whether
// the incoming Authorization header carries a live session.
export function isValidToken(token: string): boolean {
  return sessions.has(token);
}

// Available in every resolver as the third argument. The context is built
// per-request by Yoga (see server.ts); resolvers consult `isAuthorized` to
// gate authenticated operations.
export interface Context {
  token: string | null;
  isAuthorized: boolean;
}

const builder = new SchemaBuilder<{
  Context: Context;
  Objects: {
    Article: Article;
    Tag: TagShape;
    Owner: Owner;
    ExternalLink: ExternalLink;
    AuthPayload: AuthPayloadShape;
    Comment: Comment;
    Poster: Poster;
  };
}>({});

// Enum of supported chat targets — kept in sync with the `type` column on
// `comment_targets`. Pothos will surface this as a GraphQL enum so clients
// get autocompletion and the server rejects garbage values.
const CommentTargetTypeEnum = builder.enumType("CommentTargetType", {
  values: ["article", "shot", "podcast"] as const,
});

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
    kicker: t.exposeString("kicker"),
    headline: t.exposeString("headline"),
    illustration: t.exposeString("illustration"),
    preview_txt: t.exposeString("preview_txt"),
    reading_time_min: t.exposeInt("reading_time_min"),
    created_at: t.exposeInt("created_at"),
    // `tags` is computed: for each Article we run a separate query to fetch
    // its tags. Note: this is the classic "N+1" pattern — fine for a tiny
    // demo, but a real app would batch with DataLoader.
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
    // The row stores poster as an integer FK. We load the row lazily here
    // — fine for chat-sized result sets, would need DataLoader for scale.
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
        content: t.arg.string({ required: true }),
        author: t.arg.string({ required: true }),
      },
      resolve: (_, { content }) => {
        // Insert and grab the inserted row (with its auto-incremented id).
        const created = db
          .insert(articles)
          .values({
            kicker: "",
            headline: content.slice(0, 80),
            illustration: "",
            preview_txt: content,
            reading_time_min: 1,
            created_at: Math.floor(Date.now() / 1000),
          })
          .returning()
          .all()[0]!;

        // Notify everyone subscribed to `newArticle`.
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
        const salt = randomBytes(16).toString("hex");
        const password_hash = hashPassword(password, salt);
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
