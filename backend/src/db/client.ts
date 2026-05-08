
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { config } from "../config.js";

const sqlite = new Database(config.dbFile);

// WAL = "Write-Ahead Logging". Lets readers and 
// one writer work in parallel without blocking 
// each other. Faster and safer than the default mode.
sqlite.pragma("journal_mode = WAL");
// SQLite doesn't enforce foreign-key constraints 
// unless you ask it to.
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { sqlite };
