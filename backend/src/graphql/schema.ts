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
import { and, asc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  shots,
  articles,
  podcasts,
  tagSets,
  tags,
  owners,
  comments,
  commentTargets,
  posters,
  ribbon,
  pageViews,
  type Article,
  type Shot,
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
import { runSearch } from "./querySearch.js";
import { notifyNewComment } from "../notifications.js"
import { randomBytes } from "node:crypto";
import {
  verifyPassword,
  issueToken,
  prepaireForStorage,
} from "../adminPass.js"
import { FILES_DIR, MIME_BY_EXT, resolveFilePath } from "../files.js";
import { compileArticleMDX, BUILD_DIR } from "../mdxBuild.js";
import { bundleMDX } from "mdx-bundler";
import * as fs from "node:fs/promises";
import path from "node:path";

export interface Context {
  token: string | null;
  isAuthorized: boolean;
}

type AuthPayloadShape = { token: string };

const builder = new SchemaBuilder<{
  Context: Context;
  Objects: {
    Article: Article;
    Shot: Shot;
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
    EditableItem: EditableItem,
    MDXBuild: { code: string | null; error: string | null };
  };
}>({});

interface EditableItem {
  id: string,
  // Item without type is considered a folder.
  contentType?: "shot" | "article" | "podcast" | "library" | "media" | "dir";
  // Only `shot`, `article` and `podcast` can be published or draft.
  publishStatus?: "published" | "draft";
}

const ContentTypeEnum = builder.enumType("ContentType", {
  values: ["shot", "article", "podcast", "library", "media", "dir"] as const,
});

const PublishStatusEnum = builder.enumType("PublishStatus", {
  values: ["published", "draft"] as const,
});

const CommentTargetTypeEnum = builder.enumType("CommentTargetType", {
  values: ["article", "shot", "podcast"] as const,
});

const BlogContentPayload = builder.unionType("BlogContentPayload", {
  types: ["Article", "Shot", "Podcast"],
  resolveType: (payload) => {
    if ("subtitles" in payload) return "Podcast";
    if ("illustration" in payload) return "Article";
    return "Shot";
  },
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

// Total page views for an entity = sum of the per-day counts in page_views.
function resolveViews(
  targetType: "article" | "shot" | "podcast",
  targetId: number,
): number {
  const rows = db
    .select()
    .from(pageViews)
    .where(
      and(eq(pageViews.target_type, targetType), eq(pageViews.target_id, targetId)),
    )
    .all();
  return rows.reduce((total, row) => total + row.count, 0);
}

builder.objectType("MDXBuild", {
  fields: (t) => ({
    code: t.exposeString("code", { nullable: true }),
    error: t.exposeString("error", { nullable: true }),
  }),
});

builder.objectType("EditableItem", {
  fields: (t) => ({
    id: t.exposeString("id"),
    contentType: t.field({
      type: ContentTypeEnum,
      nullable: true,
      resolve: (item) => item.contentType ?? null,
    }),
    publishStatus: t.field({
      type: PublishStatusEnum,
      nullable: true,
      resolve: (item) => item.publishStatus ?? null,
    }),
  }),
});

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
    tag: t.string({ resolve: () => "podcast" }),
    id: t.exposeID("id"),
    path: t.exposeString("path"),
    headline: t.exposeString("headline"),
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

builder.objectType("Shot", {
  fields: (t) => ({
    tag: t.string({ resolve: () => "shot" }),
    id: t.exposeID("id"),
    createdAt: t.exposeInt("created_at"),
    path: t.exposeString("path"),
    views: t.field({
      type: "Int",
      resolve: (shot) => resolveViews("shot", shot.id),
    }),
    tags: t.field({
      type: ["Tag"],
      resolve: (shot) => {
        const tagSet = db
          .select()
          .from(tagSets)
          .where(
            and(eq(tagSets.type, "shot"), eq(tagSets.entity_id, shot.id)),
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
    tag: t.string({ resolve: () => "article" }),
    id: t.exposeID("id"),
    path: t.exposeString("path"),
    kicker: t.exposeString("kicker"),
    headline: t.exposeString("headline"),
    illustration: t.exposeString("illustration"),
    preview_txt: t.exposeString("preview_txt"),
    reading_time_min: t.exposeInt("reading_time_min"),
    difficulty: t.exposeString("difficulty"),
    createdAt: t.exposeInt("created_at"),
    code: t.field({
      type: "String",
      nullable: true,
      resolve: (article) => compileArticleMDX(article.path),
    }),
    views: t.field({
      type: "Int",
      resolve: (article) => resolveViews("article", article.id),
    }),
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
    getEditableItems: t.field({
      type: ["EditableItem"],
      resolve: async () => {
        // First collect all db items
        let a = db.select().from(articles).all().map((article): EditableItem => ({
          id: article.path,
          // Reference to folder
          contentType: "article",
          publishStatus: article.publish_status,
        }));

        let p = db.select().from(podcasts).all().map((podcast): EditableItem => ({
          id: podcast.path,
          // Reference to file in fs
          contentType: "podcast",
          publishStatus: podcast.publish_status,
        }));

        let s = db.select().from(shots).all().map((shot): EditableItem => ({
          id: shot.path,
          contentType: "shot",
          publishStatus: shot.publish_status,
        }));

        let mirrowedItems = [...a, ...p, ...s];

        // Collect other types of items (libraries and media) from the filesystem. 
        const IsCantContainSubitem = (path: string): boolean => {
          return [...p, ...s].some(item => item.id === path);
        };

        const IsArticle = (path: string): boolean => {
          return a.some(item => item.id === path);
        }

        async function walk(currentDir: string, relativePath = ""): Promise<EditableItem[]> {
          let result: EditableItem[] = [];

          const entries = await fs.readdir(currentDir, { withFileTypes: true })

          for (const entry of entries) {
            const itemRelativePath = path.join(relativePath, entry.name);

            if (!IsCantContainSubitem(itemRelativePath)) {
              if (entry.isDirectory()) {
                if (!IsArticle(itemRelativePath)) {
                  result.push({
                    id: itemRelativePath,
                    contentType: "dir",
                  })
                }

                const nextDir = path.join(currentDir, entry.name);
                result.push(...(await walk(nextDir, itemRelativePath)));
              } else {
                const regex = /^.+\.lib\.mdx$/;

                if (regex.test(entry.name)) {
                  result.push({
                    id: itemRelativePath,
                    contentType: "library",
                  })
                } else {
                  result.push({
                    id: itemRelativePath,
                    contentType: MIME_BY_EXT[path.extname(entry.name)] ? "media" : undefined,
                  })
                }
              }
            }
          }

          return result;
        }

        let another = await walk(FILES_DIR);

        return [...mirrowedItems, ...another]
      }
    }),
    getBlogContent: t.field({
      type: [BlogContentPayload],
      resolve: () => {
        const articleRows = db.select().from(articles).all();
        const podcastRows = db.select().from(podcasts).all();
        const shotRows = db.select().from(shots).all();
        return [...articleRows, ...podcastRows, ...shotRows]
          .sort((a, b) => b.created_at - a.created_at);
      },
    }),
    searchBlogContent: t.field({
      type: [BlogContentPayload],
      args: {
        query: t.arg.string({ required: true }),
        // Tag *labels* (not IDs). An entity must carry every listed label.
        // Empty list = no tag filter.
        tagLabels: t.arg.stringList({ required: true }),
        // Entity discriminator: "article" | "shot" | "podcast". Empty list =
        // no type filter.
        contentTypes: t.arg.stringList({ required: true }),
      },
      resolve: (_, { query, tagLabels, contentTypes }) =>
        runSearch(query, tagLabels, contentTypes),
    }),
    getArticle: t.field({
      type: "Article",
      nullable: true,
      args: {
        id: t.arg.int({ required: true }),
      },
      resolve: (_, { id }) =>
        db.select().from(articles).where(eq(articles.id, id)).all()[0] ?? null,
    }),
    getPayload: t.field({
      type: "String",
      args: {
        path: t.arg.string({ required: true }),
      },
      resolve: async (_, { path: relPath }, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");

        const abs = resolveFilePath(`/files/${relPath.replace(/^\/+/, "")}`);
        if (!abs) throw new Error("INVALID_PATH");
        try {
          return await fs.readFile(abs, "utf8");
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("NOT_FOUND");
          }
          throw err;
        }
      },
    }),
    compileMDX: t.field({
      type: "MDXBuild",
      args: {
        source: t.arg.string({ required: true }),
      },
      resolve: async (_, { source }, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");
        try {
          const { code } = await bundleMDX({ source });
          return { code, error: null };
        } catch (err) {
          return { code: null, error: (err as Error).message };
        }
      },
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
        path: t.arg.string({ required: true }),
        publish_status: t.arg({ type: PublishStatusEnum, required: true }),
      },
      resolve: async (_, args, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");

        const abs = resolveFilePath(`/files/${args.path.replace(/^\/+/, "")}`);
        if (!abs) throw new Error("INVALID_PATH");

        try {
          await fs.mkdir(abs);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === "ENOENT") throw new Error("PARENT_NOT_FOUND");
          if (code === "EEXIST") throw new Error("ALREADY_EXISTS");
          throw err;
        }
        await fs.writeFile(path.join(abs, "main.mdx"), "");

        const created = db
          .insert(articles)
          .values({
            kicker: args.kicker,
            headline: args.headline,
            illustration: args.illustration,
            preview_txt: args.preview_txt,
            reading_time_min: args.reading_time_min,
            difficulty: args.difficulty,
            created_at: Math.floor(Date.now() / 1000),
            path: args.path,
            publish_status: args.publish_status,
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
    setPayload: t.field({
      type: "Boolean",
      args: {
        path: t.arg.string({ required: true }),
        content: t.arg.string({ required: true }),
      },
      resolve: async (_, { path: relPath, content }, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");

        const abs = resolveFilePath(`/files/${relPath.replace(/^\/+/, "")}`);
        if (!abs) throw new Error("INVALID_PATH");
        try {
          await fs.writeFile(abs, content);
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error("NOT_FOUND");
          }
          throw err;
        }
        return true;
      },
    }),
    createFolder: t.field({
      type: "Boolean",
      args: {
        path: t.arg.string({ required: true }),
      },
      resolve: async (_, { path: relPath }, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");

        const abs = resolveFilePath(`/files/${relPath.replace(/^\/+/, "")}`);
        if (!abs) throw new Error("INVALID_PATH");

        // Non-recursive mkdir: fails with ENOENT if the parent is missing
        // and EEXIST if the target already exists — both surfaced as the
        // GraphQL error.
        try {
          await fs.mkdir(abs);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === "ENOENT") throw new Error("PARENT_NOT_FOUND");
          if (code === "EEXIST") throw new Error("ALREADY_EXISTS");
          throw err;
        }
        return true;
      },
    }),
    // Move/rename a tracked path. Touches three places:
    //   1. The on-disk file or directory under FILES_DIR.
    //   2. The `path` column on articles/shots/podcasts whose paths either
    //      equal oldPath or live underneath it — rewritten to the new prefix.
    //   3. The MDX build cache. A renamed article folder owns a sibling
    //      cache file `${BUILD_DIR}/${oldPath}.js`; a renamed parent dir
    //      owns the cache subtree `${BUILD_DIR}/${oldPath}`. Both moves are
    //      attempted; ENOENT is fine (cache may not exist yet).
    renameObject: t.field({
      type: "Boolean",
      args: {
        oldPath: t.arg.string({ required: true }),
        newPath: t.arg.string({ required: true }),
      },
      resolve: async (_, { oldPath, newPath }, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");
        if (oldPath === newPath) return true;

        const oldAbs = resolveFilePath(`/files/${oldPath.replace(/^\/+/, "")}`);
        const newAbs = resolveFilePath(`/files/${newPath.replace(/^\/+/, "")}`);
        if (!oldAbs || !newAbs) throw new Error("INVALID_PATH");

        try {
          await fs.access(newAbs);
          throw new Error("ALREADY_EXISTS");
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
        }

        try {
          await fs.mkdir(path.dirname(newAbs), { recursive: true });
          await fs.rename(oldAbs, newAbs);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === "ENOENT") throw new Error("NOT_FOUND");
          throw err;
        }

        const prefixLike = `${oldPath}/%`;
        const remapPath = (current: string): string =>
          current === oldPath ? newPath : newPath + current.slice(oldPath.length);

        for (const table of [articles, shots, podcasts] as const) {
          const affected = db
            .select()
            .from(table)
            .where(or(eq(table.path, oldPath), like(table.path, prefixLike)))
            .all();
          for (const row of affected) {
            db.update(table)
              .set({ path: remapPath(row.path) })
              .where(eq(table.id, row.id))
              .run();
          }
        }

        const moveBuild = async (from: string, to: string) => {
          try {
            await fs.mkdir(path.dirname(to), { recursive: true });
            await fs.rename(from, to);
          } catch (err) {
            if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
          }
        };
        await moveBuild(path.join(BUILD_DIR, oldPath), path.join(BUILD_DIR, newPath));
        await moveBuild(path.join(BUILD_DIR, `${oldPath}.js`), path.join(BUILD_DIR, `${newPath}.js`));

        return true;
      },
    }),
    // Flip publish_status between "published" and "draft" for whichever of
    // articles/shots/podcasts owns this path. No-op (NOT_FOUND) if no row
    // matches — caller is expected to invoke this only on tracked content.
    togglePublishStatus: t.field({
      type: PublishStatusEnum,
      args: {
        path: t.arg.string({ required: true }),
      },
      resolve: (_, { path: relPath }, ctx) => {
        if (!ctx.isAuthorized) throw new Error("UNAUTHORIZED");
        for (const table of [articles, shots, podcasts] as const) {
          const row = db.select().from(table).where(eq(table.path, relPath)).all()[0];
          if (!row) continue;
          const next = row.publish_status === "published" ? "draft" : "published";
          db.update(table).set({ publish_status: next }).where(eq(table.id, row.id)).run();
          return next;
        }
        throw new Error("NOT_FOUND");
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
        const { password_hash, salt } = prepaireForStorage(password);
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
