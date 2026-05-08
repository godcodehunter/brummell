// Database client.
//
// We use:
//   - better-sqlite3 — a synchronous SQLite driver. "Synchronous" means each
//     query blocks the event loop until SQLite responds. SQLite is so fast
//     for local files that this is usually not a problem and the API is much
//     simpler than the async one.
//   - drizzle-orm — a thin, typed query builder on top of better-sqlite3.
//     It gives us auto-completion and compile-time checks for our SQL.

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { config } from "../config.js";

// Open (or create) the SQLite file at the path resolved by config.ts.
const sqlite = new Database(config.dbFile);

// WAL = "Write-Ahead Logging". Lets readers and one writer work in parallel
// without blocking each other. Faster and safer than the default mode.
sqlite.pragma("journal_mode = WAL");

// SQLite doesn't enforce foreign-key constraints unless you ask it to.
// We have FKs in the schema (article_tags -> articles), so turn them on.
sqlite.pragma("foreign_keys = ON");

// `db` is the typed Drizzle wrapper — use this for queries everywhere.
// `sqlite` is the raw driver — use only for things Drizzle doesn't expose
// (e.g. running CREATE TABLE DDL during bootstrap).
export const db = drizzle(sqlite, { schema });
export { sqlite };
