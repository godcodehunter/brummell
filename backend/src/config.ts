// Settings (flag / env / purpose):
//   --db-dir       DB_DIR        Directory for the SQLite file. Created
//                                if missing.
//   --port         PORT          Port the server listens on.
//   --llm-token    LLM_TOKEN     DeepSeek API key. 
//   --draw-new     DRAW_NET      Draw net API key.
//   --tg           TG            Telegram bot credentials in the form
//                                "<bot-token>:<chat-id>". Disables 
//                                notifications when missing.
//   --public-url   PUBLIC_URL    Public base URL.

const DEFAULT_DB_PATH = "./data"
const DEFAULT_PORT = "4000"
const DEFAULT_URL = "http://localhost"

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    "db-dir": { type: "string" },
    "port": { type: "string" },
    "llm-token": { type: "string" },
    "tg": { type: "string" },
    "public-url": { type: "string" },
  },
  allowPositionals: false,
});

function pick(flag: string | undefined, envKey: string): string | undefined {
  if (flag !== undefined) return flag;
  const envVal = process.env[envKey];
  return envVal && envVal.length > 0 ? envVal : undefined;
}

const dbDir = path.resolve(pick(values["db-dir"], "DB_DIR") ?? DEFAULT_DB_PATH);
const port = parseInt(pick(values["port"], "PORT") ?? DEFAULT_PORT, 10);

fs.mkdirSync(dbDir, { recursive: true });

function parseTg(raw: string | undefined): { botToken: string; chatId: string } | undefined {
  if (!raw) return undefined;
  const lastColon = raw.lastIndexOf(":");
  if (lastColon <= 0 || lastColon === raw.length - 1) {
    throw new Error(`tg credentials must be in "<bot-token>:<chat-id>" form`);
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
  llmToken: pick(values["llm-token"], "LLM_TOKEN"),
  tg: parseTg(pick(values["tg"], "TG")),
  publicUrl: pick(values["public-url"], "PUBLIC_URL") ?? `${DEFAULT_URL}:${port}`,
};

if(config.tg !== undefined) {
  console.log("📞 Telegram notify is used");
}

if(config.llmToken !== undefined) {
  console.log("🧠 LLM integration is used")
}

if(config.llmToken !== undefined) {
  console.log("🖌️ Draw net integration is used")
}