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
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  articles,
  podcasts,
  tagSets,
  tags,
  owners,
  comments,
  commentTargets,
  posters,
  ribbon,
  type Article,
  type Tag,
  type Owner,
  type ExternalLink,
  type Comment,
  type Poster,
  type CommentTargetType,
  type Podcast,
  type PodcastGuest,
  type Topics,
  type Subtitles,
  type TimeRange,
} from "../db/schema.js";
import { pubsub, commentTopicKey } from "./pubsub.js";
import { notifyNewComment } from "../notifications.js"
import { randomBytes } from "node:crypto";
import {
  verifyPassword,
  issueToken,
  prepaireForStorage,
} from "../adminPass.js"

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
    Podcast: Podcast,
    PodcastGuest: PodcastGuest;
    Topic: Topics;
    TimeRange: TimeRange;
    Subtitle: Subtitles;
    SubtitleWord: { range: TimeRange; text: string };
  };
}>({});

const CommentTargetTypeEnum = builder.enumType("CommentTargetType", {
  values: ["article", "shot", "podcast"] as const,
});

const DifficultyEnum = builder.enumType("Difficulty", {
  values: ["easy", "medium", "hard", "extra_hard"] as const,
});

const RibbonEnum = builder.enumType("Ribbon", {
  values: ["hot", "new"] as const,
});

const ExternalLinkInput = builder.inputType("ExternalLinkInput", {
  fields: (t) => ({
    svgIcon: t.string({ required: true }),
    url: t.string({ required: true }),
  }),
});

// Looks up the ribbon ("hot"/"new" banner) attached to a given entity, if any.
function resolveRibbon(targetType: "article" | "podcast", targetId: number) {
  const row = db
    .select()
    .from(ribbon)
    .where(
      and(eq(ribbon.target_type, targetType), eq(ribbon.target_id, targetId)),
    )
    .all()[0];
  return row?.ribbon ?? null;
}

// Half-open interval over the podcast's audio timeline, in seconds.
builder.objectType("TimeRange", {
  fields: (t) => ({
    start: t.exposeInt("start"),
    end: t.exposeInt("end"),
  }),
});

builder.objectType("PodcastGuest", {
  fields: (t) => ({
    // Stored inline as a base64 data URL.
    image: t.exposeString("image"),
    name: t.exposeString("name"),
    whoIs: t.exposeString("who_is"),
  }),
});

builder.objectType("Topic", {
  fields: (t) => ({
    range: t.field({
      type: "TimeRange",
      resolve: (topic) => topic.range,
    }),
    title: t.string({ resolve: (topic) => String(topic.title) }),
  }),
});

builder.objectType("SubtitleWord", {
  fields: (t) => ({
    range: t.field({
      type: "TimeRange",
      resolve: (word) => word.range,
    }),
    text: t.exposeString("text"),
  }),
});

builder.objectType("Subtitle", {
  fields: (t) => ({
    speakerIdx: t.exposeInt("speakerIdx"),
    words: t.field({
      type: ["SubtitleWord"],
      resolve: (subtitle) => subtitle.words,
    }),
  }),
});

builder.objectType("Podcast", {
  fields: (t) => ({
    id: t.exposeID("id"),
    headline: t.exposeString("headline"),
    sound: t.exposeString("sound"),
    createdAt: t.exposeInt("created_at"),
    ribbon: t.field({
      type: RibbonEnum,
      nullable: true,
      resolve: (podcast) => resolveRibbon("podcast", podcast.id),
    }),
    guests: t.field({
      type: ["PodcastGuest"],
      resolve: (podcast) => podcast.guests,
    }),
    topics: t.field({
      type: ["Topic"],
      resolve: (podcast) => podcast.topics,
    }),
    subtitles: t.field({
      type: ["Subtitle"],
      resolve: (podcast) => podcast.subtitles,
    }),
    tags: t.field({
      type: ["Tag"],
      resolve: (podcast) => {
        const tagSet = db
          .select()
          .from(tagSets)
          .where(
            and(eq(tagSets.type, "podcast"), eq(tagSets.entity_id, podcast.id)),
          )
          .all()[0];
        if (!tagSet || tagSet.tag_ids.length === 0) return [];
        return db.select().from(tags).where(inArray(tags.id, tagSet.tag_ids)).all();
      },
    }),
  }),
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
    createdAt: t.exposeInt("created_at"),
    ribbon: t.field({
      type: RibbonEnum,
      nullable: true,
      resolve: (article) => resolveRibbon("article", article.id),
    }),
    tags: t.field({
      type: ["Tag"],
      resolve: (article) => {
        const tagSet = db
          .select()
          .from(tagSets)
          .where(
            and(eq(tagSets.type, "article"), eq(tagSets.entity_id, article.id)),
          )
          .all()[0];
        if (!tagSet || tagSet.tag_ids.length === 0) return [];
        return db.select().from(tags).where(inArray(tags.id, tagSet.tag_ids)).all();
      },
    }),
  }),
});

builder.objectType("ExternalLink", {
  fields: (t) => ({
    svgIcon: t.exposeString("svg_icon"),
    url: t.exposeString("url"),
  }),
});

builder.objectType("Owner", {
  fields: (t) => ({
    id: t.exposeID("id"),
    nickname: t.exposeString("nickname"),
    aboutMyself: t.exposeString("about_myself"),
    avatar: t.exposeString("avatar"),
    externalLinks: t.field({
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
    createdAt: t.exposeInt("created_at"),
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

builder.queryType({
  fields: (t) => ({
    getArticle: t.field({
      type: ["Article"],
      resolve: () => db.select().from(articles).all(),
    }),
    getPodcast: t.field({
      type: "Podcast",
      nullable: true,
      args: {
        id: t.arg.int({ required: true }),
      },
      resolve: (_, { id }) =>
        db.select().from(podcasts).where(eq(podcasts.id, id)).all()[0] ?? null,
    }),
    getTag: t.field({
      type: ["Tag"],
      resolve: () => db.select().from(tags).all(),
    }),
    getOwner: t.field({
      type: "Owner",
      nullable: true,
      resolve: () => db.select().from(owners).all()[0] ?? null,
    }),
    validateToken: t.field({
      type: "Boolean",
      resolve: (_root, _args, ctx) => ctx.isAuthorized,
    }),
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
          .orderBy(asc(comments.created_at))
          .all();
      },
    }),
  }),
});

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
    updateOwner: t.field({
      type: "Owner",
      args: {
        nickname: t.arg.string({ required: true }),
        aboutMyself: t.arg.string({ required: true }),
        avatar: t.arg.string({ required: true }),
        externalLinks: t.arg({ type: [ExternalLinkInput], required: true }),
      },
      resolve: (_, args, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");
        const owner = db.select().from(owners).all()[0];
        if (!owner) throw new Error("OWNER_NOT_FOUND");
        const updated = db
          .update(owners)
          .set({
            nickname: args.nickname,
            about_myself: args.aboutMyself,
            avatar: args.avatar,
            external_links: args.externalLinks.map((l) => ({
              svg_icon: l.svgIcon,
              url: l.url,
            })),
          })
          .where(eq(owners.id, owner.id))
          .returning()
          .all()[0]!;
        return updated;
      },
    }),
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
