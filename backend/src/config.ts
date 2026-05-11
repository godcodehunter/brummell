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
//  --tg <string>         Telegram bot credentials for notifications,
//                        in the form "<bot-token>:<chat-id>". The
//                        bot token itself contains a colon, so the
//                        chat id is parsed off the LAST colon.
//                        Notifications are disabled when missing.

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "db-dir": { type: "string", default: "./data" },
    "port": { type: "string", default: "4000" },
    "llm-token": { type: "string" },
    "tg": { type: "string" },
  },
  allowPositionals: false,
});

const port = parseInt(values["port"]!, 10);

const dbDir = path.resolve(values["db-dir"]!);

fs.mkdirSync(dbDir, { recursive: true });

function parseTg(raw: string | undefined): { botToken: string; chatId: string } | undefined {
  if (!raw) return undefined;
  const lastColon = raw.lastIndexOf(":");
  if (lastColon <= 0 || lastColon === raw.length - 1) {
    throw new Error(`--tg must be in "<bot-token>:<chat-id>" form`);
  }
  return {
    botToken: raw.slice(0, lastColon),
    chatId: raw.slice(lastColon + 1),
  };
}

export const config = {
  dbDir,
  dbFile: path.join(dbDir, "app.db"),
  port,
  llmToken: values["llm-token"],
  tg: parseTg(values["tg"]),
};
