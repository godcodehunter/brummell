// Reads command-line flags and resolves 
// runtime configuration.
//
// Supported flags:
//   --db-dir <path>      Directory where the SQLite 
//                        file lives.
//                        Created automatically if missing.
//                        Defaults to "./data" (relative to 
//                        current working dir).
//
//  --port <int>          The port the server will use.
//
//  --llm-token <string>  DeepSeek API key (https://api.deepseek.com).
//                        Used by the article review feature in
//                        `llmIntegration.ts`. The review endpoint is
//                        disabled when this flag is missing.
//
//  --email <string>      Used for notifications.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "db-dir": { type: "string", default: "./data" },
    "port": { type: "string", default: "4000" },
    "llm-token": { type: "string" },
    "email": { type: "string" },
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
