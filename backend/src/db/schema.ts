import { sqliteTable, integer, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const posters = sqliteTable("posters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider", { enum: ["github", "google", "anonymous"] }).notNull(),
  // String to hold both the GitHub numeric id and the Google sub.
  provider_user_id: text("provider_user_id").notNull(),
  display_name: text("display_name").notNull(),
  avatar_url: text("avatar_url"),  
  email: text("email"),       
  // Unix timestamp    
  created_at: integer("created_at").notNull(),
}, (t) => ({
  uniqueProviderUser: uniqueIndex("posters_provider_user_uq")
    .on(t.provider, t.provider_user_id),
}));


export const commentTargets = sqliteTable("comment_targets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["article", "shot", "podcast"] }).notNull(),
  entity_id: integer("entity_id").notNull(),
}, (t) => ({
  uniqueEntity: uniqueIndex("targets_type_entity_uq").on(t.type, t.entity_id),
}));

export const comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target_id: integer("target_id")
    .notNull()
    .references(() => commentTargets.id, { onDelete: "cascade" }),
  poster: integer("poster_id").notNull(),
  text: text("text").notNull(),
  // Unix timestamp
  created_at: integer("created_at").notNull(),
});

export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  kicker: text("kicker").notNull(),
  headline: text("headline").notNull(),
  // Stored inline as a base64 data URL.
  illustration: text("illustration").notNull(),
  preview_txt: text("preview_txt").notNull(),
  difficulty: text("difficulty", { enum: ["easy", "medium", "hard", "extra_hard"] }).notNull(),
  reading_time_min: integer("reading_time_min").notNull(),
  // Unix timestamp
  created_at: integer("created_at").notNull(),
  path: text("path").notNull(),
  publish_status: text("publish_status", { enum: ["published", "draft"] }).notNull(),
});

export const shots = sqliteTable("shots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  // Unix timestamp
  created_at: integer("created_at").notNull(),
  // Pseudo-path used purely as a tree slug (no on-disk file). Nullable so
  // freshly created shots can show up before the user assigns one; kept
  // as a column so rename/delete-by-path treat shots uniformly with the
  // other entities.
  path: text("path"),
  // Tweet-style body — the actual shot content.
  text: text("text").notNull().default(""),
  publish_status: text("publish_status", { enum: ["published", "draft"] }).notNull(),
});

// Half-open interval over the podcast's audio timeline, in seconds.
export type TimeRange = { start: number; end: number };
// Guest image is stored inline as a base64 data URL
export type PodcastGuest = { image: string; name: string; who_is: string };
export type Topics = { range: TimeRange, title: String };
export type Subtitles = { 
  speakerIdx: number,
  words: {range: TimeRange; text: string}[],
};

export const podcasts = sqliteTable("podcasts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  headline: text("headline").notNull(),
  guests: text("guests", { mode: "json" })
    .$type<PodcastGuest[]>()
    .notNull()
    .default([]),
  topics: text("topics", { mode: "json" })
    .$type<Topics[]>()
    .notNull()
    .default([]),
  subtitles: text("subtitles", { mode: "json" })
    .$type<Subtitles[]>()
    .notNull()
    .default([]),
  // Unix timestamp in seconds.
  created_at: integer("created_at").notNull(),
  // Audio file path under FILES_DIR. Nullable — the podcast can exist as
  // a row before its sound asset is uploaded.
  path: text("path"),
  publish_status: text("publish_status", { enum: ["published", "draft"] }).notNull(),
});

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  color: text("color").notNull(),
  tooltip: text("tooltip").notNull(),
});

export const tagSets = sqliteTable("tag_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["article", "shot", "podcast"] }).notNull(),
  entity_id: integer("entity_id").notNull(),
  tag_ids: text("tag_ids", { mode: "json" }).$type<number[]>().notNull(),
}, (t) => ({
  uniqueEntity: uniqueIndex("tag_sets_type_entity_uq").on(t.type, t.entity_id),
}));

export const ribbon = sqliteTable("ribbon", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target_type: text("target_type", { enum: ["article", "shot", "podcast"] }).notNull(),
  target_id: integer("target_id").notNull(),
  ribbon: text("ribbon", { enum: ["hot", "new"] }).notNull(),
}, (t) => ({
  uniqueTarget: uniqueIndex("ribbon_target_uq").on(t.target_type, t.target_id),
}));

export type ExternalLink = { svg_icon: string; url: string };

export const owners = sqliteTable("owners", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  password_hash: text("password_hash").notNull(),
  password_salt: text("password_salt").notNull(),
  // Stored inline as a base64 data URL.
  avatar: text("avatar").notNull().default(""),
  nickname: text("nickname").notNull().default(""),
  about_myself: text("about_myself").notNull().default(""),
  external_links: text("external_links", { mode: "json" })
    .$type<ExternalLink[]>()
    .notNull()
    .default([]),
});

export const pageViews = sqliteTable("page_views", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target_type: text("target_type", { enum: ["article", "shot", "podcast"] }).notNull(),
  target_id: integer("target_id").notNull(),
  // Unix timestamp rounded to the beginning of the day UTC
  day: integer("day").notNull(),       
  count: integer("count").notNull().default(0),
}, (t) => ({
  uniqueDay: uniqueIndex("page_views_target_day_uq").on(t.target_type, t.target_id, t.day),
}));

// Inferred TypeScript types for read rows. 
//  - `$inferSelect` reflects what a SELECT returns; 
//  - `$inferInsert` would reflect what INSERT accepts.
export type Comment = typeof comments.$inferSelect;
export type CommentTarget = typeof commentTargets.$inferSelect;
export type CommentTargetType = CommentTarget["type"];
export type Poster = typeof posters.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Shot = typeof shots.$inferSelect;
export type Podcast = typeof podcasts.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TagSet = typeof tagSets.$inferSelect;
export type TagSetType = TagSet["type"];
export type Owner = typeof owners.$inferSelect;
export type Ribbon = typeof ribbon.$inferSelect;
export type RibbonTargetType = Ribbon["target_type"];
export type RibbonKind = Ribbon["ribbon"];
