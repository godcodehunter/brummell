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
  type Article,
  type Owner,
  type ExternalLink,
} from "../db/schema.js";
import { pubsub } from "./pubsub.js";

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
