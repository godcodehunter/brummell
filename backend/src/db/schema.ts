import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";


export const articles = sqliteTable("articles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  headline: text("headline").notNull(),
  // The illustration is stored inline as a base64 data URL — see seed.ts.
  // For a real app you'd usually store a path/URL and serve the file
  // separately. Keeping it inline makes the demo self-contained.
  illustration: text("illustration").notNull(),
  preview_txt: text("preview_txt").notNull(),
  reading_time_min: integer("reading_time_min").notNull(),
  // Unix timestamp in seconds.
  publication_time: integer("publication_time").notNull(),
});

// Tags attached to a specific article (denormalised on purpose — each row
// carries its own label/color/tooltip rather than referencing a shared tag).
// This matches the original demo data which had inline tag arrays.
export const articleTags = sqliteTable("article_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  article_id: integer("article_id")
    .notNull()
    // ON DELETE CASCADE: when an article is removed, its tags go with it.
    .references(() => articles.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  color: text("color").notNull(),
  tooltip: text("tooltip").notNull(),
});

// Global tag list used by the search/picker UI on the frontend. Separate
// from `article_tags` because those serve a different purpose (per-article
// display) and may diverge in fields later.
export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  label: text("label").notNull(),
  color: text("color").notNull(),
  tooltip: text("tooltip").notNull(),
});

// Relations let Drizzle's relational query API understand "an article has
// many tags". We don't use that API yet, but it's good practice to declare
// it for future joins.
export const articlesRelations = relations(articles, ({ many }) => ({
  tags: many(articleTags),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, {
    fields: [articleTags.article_id],
    references: [articles.id],
  }),
}));

// Inferred TypeScript types for read rows. `$inferSelect` reflects what a
// SELECT returns; `$inferInsert` would reflect what INSERT accepts.
export type Article = typeof articles.$inferSelect;
export type ArticleTag = typeof articleTags.$inferSelect;
export type Tag = typeof tags.$inferSelect;
