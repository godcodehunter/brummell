// Reads command-line flags and resolves runtime configuration.
//
// Supported flags:
//   --db-dir <path>   Directory where the SQLite file lives.
//                     Created automatically if missing.
//                     Defaults to "./data" (relative to current working dir).

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "db-dir": { type: "string", default: "./data" },
  },
  allowPositionals: false,
});

// Resolve to an absolute path so behavior doesn't depend on where the
// process is started from.
const dbDir = path.resolve(values["db-dir"]!);

// Make sure the directory exists. `recursive: true` is a no-op if it already
// does — so this is safe to call on every startup.
fs.mkdirSync(dbDir, { recursive: true });

export const config = {
  dbDir,
  dbFile: path.join(dbDir, "app.db"),
  port: 4000,
};
