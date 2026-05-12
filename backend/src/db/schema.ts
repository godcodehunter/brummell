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
});

export const shots = sqliteTable("shots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  text: text("text").notNull(),
  // Unix timestamp
  created_at: integer("created_at").notNull(),
});

// Half-open interval over the podcast's audio timeline, in seconds.
export type TimeRange = { start: number; end: number };
// Guest image is stored inline as a base64 data URL
export type PodcastGuest = { image: string; name: string; who_is: string };
export type PodcastSegment = { range: TimeRange; text: string };

export const podcasts = sqliteTable("podcasts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  headline: text("headline").notNull(),
  // Stored inline as a base64 data URL
  sound: text("sound").notNull(),
  guests: text("guests", { mode: "json" })
    .$type<PodcastGuest[]>()
    .notNull()
    .default([]),
  topics: text("topics", { mode: "json" })
    .$type<PodcastSegment[]>()
    .notNull()
    .default([]),
  subtitles: text("subtitles", { mode: "json" })
    .$type<PodcastSegment[]>()
    .notNull()
    .default([]),
  // Unix timestamp in seconds.
  created_at: integer("created_at").notNull(),
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

export const baged = sqliteTable("baged", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  target_type: text("target_type", { enum: ["article", "shot", "podcast"] }).notNull(),
  target_id: integer("target_id").notNull(),
  bage: text("bage", { enum: ["hot", "new"] }).notNull(),
}, (t) => ({
  uniqueTarget: uniqueIndex("baged_target_uq").on(t.target_type, t.target_id),
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

// Inferred TypeScript types for read rows. `$inferSelect` reflects what a
// SELECT returns; `$inferInsert` would reflect what INSERT accepts.
export type Comment = typeof comments.$inferSelect;
export type CommentTarget = typeof commentTargets.$inferSelect;
export type CommentTargetType = CommentTarget["type"];
export type Article = typeof articles.$inferSelect;
export type Shot = typeof shots.$inferSelect;
export type Podcast = typeof podcasts.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type TagSet = typeof tagSets.$inferSelect;
export type TagSetType = TagSet["type"];
export type Owner = typeof owners.$inferSelect;
export type Baged = typeof baged.$inferSelect;
export type BagedTargetType = Baged["target_type"];
export type BageKind = Baged["bage"];
