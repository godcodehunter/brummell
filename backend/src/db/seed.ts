// One-shot bootstrap that runs on every server start:
//   1. Make sure the tables exist (idempotent — safe to call repeatedly).
//   2. If the DB is empty, fill it with demo content.
//
// In a real project we'd use Drizzle Kit migrations (`drizzle-kit generate` +
// `migrate(...)`). For a tiny demo we keep it inline.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sqlite, db } from "./client.js";
import { articles, tagSets, tags } from "./schema.js";

// In ES modules `__dirname` is not defined automatically; this is the
// canonical replacement.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Map a file extension to its IANA media type. Used when we encode the
// demo image as a base64 data URL below.
const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

// Reads a binary file and produces a string like:
//   data:image/jpeg;base64,/9j/4AAQ...
// The frontend can put that string directly into `<img src=...>`.
function encodeImageAsDataUrl(absolutePath: string): string {
  const ext = path.extname(absolutePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const base64 = fs.readFileSync(absolutePath).toString("base64");
  return `data:${mime};base64,${base64}`;
}

// Creates tables if they don't exist. We do this with raw SQL because we're
// skipping the migration tool for now. `IF NOT EXISTS` makes it a no-op on
// subsequent boots.
function ensureSchema() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kicker TEXT NOT NULL,
      headline TEXT NOT NULL,
      illustration TEXT NOT NULL,
      preview_txt TEXT NOT NULL,
      reading_time_min INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      label TEXT NOT NULL,
      color TEXT NOT NULL,
      tooltip TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tag_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      tag_ids TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS tag_sets_type_entity_uq
      ON tag_sets(type, entity_id);

    CREATE TABLE IF NOT EXISTS owners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      about_myself TEXT NOT NULL DEFAULT '',
      avatar TEXT NOT NULL DEFAULT '',
      external_links TEXT NOT NULL DEFAULT '[]'
    );
  `);
}

export function initDatabase() {
  ensureSchema();

  // If anything is already there, don't touch it.
  const existing = db.select().from(articles).all();
  if (existing.length > 0) return;

  // Encode the demo illustration once and reuse it for every article.
  const illustration = encodeImageAsDataUrl(
    path.join(__dirname, "..", "resources", "illustration.jpg"),
  );

  const seedTags = [
    { label: "banana", color: "#327878", tooltip: "Test tooltip" },
    { label: "ball", color: "#327878", tooltip: "Test tooltip" },
    { label: "beicon", color: "#327878", tooltip: "Test tooltip" },
  ];

  // Each article references tags by index into `seedTags` — resolved to
  // real tag ids after the tag rows are inserted.
  const seedArticles = [
    {
      kicker: "Industry",
      headline: "January Yepp",
      preview_txt:
        "In November 2011, Amazon added what it called “Time To Read” to its new Kindle Touch, but disabled it by default. With the release of Kindle Paperwhite in October 2012, it enabled Time To Read and started advertising the feature. It was so popular that people with older versions of Kindle tried to figure out how to get it.",
      reading_time_min: 9,
      created_at: 1706416211,
      tag_indices: [0],
    },
    {
      kicker: "Opinion",
      headline: "February Oyy",
      preview_txt: "Test txt",
      reading_time_min: 9,
      created_at: 1709094611,
      tag_indices: [] as number[],
    },
  ];

  // A transaction either commits everything or nothing. If any insert
  // throws, the database stays empty and we won't have half-seeded state.
  db.transaction((tx) => {
    const insertedTags = seedTags.map(
      (tag) => tx.insert(tags).values(tag).returning().all()[0]!,
    );

    // Repeat 6 times so the grid on the front page has enough cards
    // to look interesting.
    for (let i = 0; i < 6; i++) {
      for (const article of seedArticles) {
        // `.returning().all()` gives us back the inserted row (including
        // the auto-generated `id`) so we can attach tags to it.
        const inserted = tx
          .insert(articles)
          .values({
            kicker: article.kicker,
            headline: article.headline,
            illustration,
            preview_txt: article.preview_txt,
            reading_time_min: article.reading_time_min,
            created_at: article.created_at,
          })
          .returning()
          .all()[0]!;

        if (article.tag_indices.length > 0) {
          tx.insert(tagSets)
            .values({
              type: "article",
              entity_id: inserted.id,
              tag_ids: article.tag_indices.map((idx) => insertedTags[idx]!.id),
            })
            .run();
        }
      }
    }
  });

  console.log("✅ Database seeded");
}
