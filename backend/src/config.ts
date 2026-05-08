// Reads command-line flags and resolves 
// runtime configuration.
//
// Supported flags:
//   --db-dir <path>   Directory where the SQLite 
//                     file lives.
//                     Created automatically if missing.
//                     Defaults to "./data" (relative to 
//                     current working dir).
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

const port = parseInt(values["port"]!, 10);

const dbDir = path.resolve(values["db-dir"]!);

fs.mkdirSync(dbDir, { recursive: true });

export const config = {
  dbDir,
  dbFile: path.join(dbDir, "app.db"),
  port,
};
