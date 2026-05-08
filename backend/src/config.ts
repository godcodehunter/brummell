// Reads command-line flags and resolves runtime configuration.
//
// Supported flags:
//   --db-dir <path>   Directory where the SQLite file lives.
//                     Created automatically if missing.
//                     Defaults to "./data" (relative to current working dir).
//
//  --port <int>       The port the server will use

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "db-dir": { type: "string", default: "./data" },
    "port": { type: "string", default: "4000" },
  },
  allowPositionals: false,
});

// Parse port value
const port = parseInt(values["port"]!, 10);

// Resolve to an absolute path
const dbDir = path.resolve(values["db-dir"]!);

// Make sure the directory exists. `recursive: true` is a no-op if it already
// does — so this is safe to call on every startup.
fs.mkdirSync(dbDir, { recursive: true });

export const config = {
  dbDir,
  dbFile: path.join(dbDir, "app.db"),
  port,
};
