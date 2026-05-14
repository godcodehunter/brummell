import { sqlite } from "./client.js";

export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kicker TEXT NOT NULL,
      headline TEXT NOT NULL,
      illustration TEXT NOT NULL,
      preview_txt TEXT NOT NULL,
      reading_time_min INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'easy'
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

    CREATE TABLE IF NOT EXISTS posters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      email TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS posters_provider_user_uq
      ON posters(provider, provider_user_id);

    CREATE TABLE IF NOT EXISTS comment_targets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      entity_id INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS targets_type_entity_uq
      ON comment_targets(type, entity_id);

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_id INTEGER NOT NULL REFERENCES comment_targets(id) ON DELETE CASCADE,
      poster_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  console.log("✅ Database scheme initialized");
}