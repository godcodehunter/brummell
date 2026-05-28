// HTTP handlers for the /files/* namespace. Three verbs:
//   GET     — serve a file with ETag + short cache. Public.
//   PUT     — overwrite or create. Body is raw bytes of the file
//             (no multipart). Requires admin token.
//   DELETE  — remove a file. Requires admin token.
//
// Files live under ${config.dbDir}/files/, mirroring the URL after
// "/files/". E.g. PUT /files/articles/foo/hero.jpg writes to
// <dbDir>/files/articles/foo/hero.jpg.
//
// Why PUT-with-raw-body and not POST-multipart: the client can do a
// one-liner `fetch(path, { method: 'PUT', body: file })` where `file`
// is a Blob/File, no multipart encoding, no parser on the server, no
// extra dependency. Trade-off — only one file per request. Fine for now.

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { config } from "./config.js";
import { isValidToken } from "./adminPass.js";
import { extractBearerToken } from "./utils.js"

export const FILES_DIR = path.join(config.dbDir, "files");
fs.mkdirSync(FILES_DIR, { recursive: true });

// Cap so an authenticated client can't accidentally fill the disk.
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mdx": "text/markdown; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

// Map a URL path to an absolute filesystem path inside FILES_DIR.
// Returns null for anything that looks unsafe so we don't have to
// chase weird traversal cases inside handlers.
export function resolveFilePath(urlPath: string): string | null {
  if (!urlPath.startsWith("/files/")) return null;
  const rel = urlPath.slice("/files/".length);
  if (rel.length === 0) return null;
  // Only ASCII letters/digits and a few safe punctuation marks. Reject
  // anything else outright — Windows-style backslashes, query strings,
  // URL-encoded surprises, ...
  if (!/^[a-zA-Z0-9._\-/]+$/.test(rel)) return null;
  // Defence in depth: even after the regex, explicitly reject "..".
  if (rel.split("/").some((s) => s === "" || s === "..")) return null;
  return path.join(FILES_DIR, rel);
}

function isAuthorized(req: IncomingMessage): boolean {
  const token = extractBearerToken(req.headers.authorization);
  return token !== null && isValidToken(token);
}

async function serveFile(
  req: IncomingMessage,
  res: ServerResponse,
  urlPath: string,
): Promise<void> {
  const abs = resolveFilePath(urlPath);
  if (!abs) return void res.writeHead(400).end("Bad path");

  let stat: fs.Stats;
  try {
    stat = await fsp.stat(abs);
  } catch {
    return void res.writeHead(404).end("Not found");
  }
  if (!stat.isFile()) return void res.writeHead(404).end("Not a file");

  // Weak ETag derived from size + mtime — no need to read the file. If
  // someone overwrites the file, mtime changes, ETag changes, cache
  // re-validates. Browsers send `If-None-Match` on revalidation; we
  // reply 304 when it matches, so the body never gets transferred again.
  const etag = `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
  if (req.headers["if-none-match"] === etag) {
    return void res.writeHead(304, { ETag: etag }).end();
  }

  const mime =
    MIME_BY_EXT[path.extname(abs).toLowerCase()] ?? "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": mime,
    "Content-Length": String(stat.size),
    // Short max-age — browser can still serve from memory for a few
    // minutes without hitting us, but it will revalidate via ETag after
    // that.
    "Cache-Control": "public, max-age=300",
    ETag: etag,
    "Last-Modified": stat.mtime.toUTCString(),
  });
  if (req.method === "HEAD") return void res.end();
  fs.createReadStream(abs).pipe(res);
}

async function writeFile(
  req: IncomingMessage,
  res: ServerResponse,
  urlPath: string,
): Promise<void> {
  if (!isAuthorized(req)) return void res.writeHead(401).end("Unauthorized");
  const abs = resolveFilePath(urlPath);
  if (!abs) return void res.writeHead(400).end("Bad path");

  const declared = Number(req.headers["content-length"]);
  if (!Number.isFinite(declared) || declared <= 0) {
    return void res.writeHead(411).end("Content-Length required");
  }
  if (declared > MAX_UPLOAD_BYTES) {
    return void res.writeHead(413).end("Payload too large");
  }

  await fsp.mkdir(path.dirname(abs), { recursive: true });

  // Write to a temp file first, then atomically rename. Otherwise a
  // crash mid-upload leaves a partial file at the final path that
  // would be served as-is on next GET.
  const tmp = `${abs}.${process.pid}.${Date.now()}.tmp`;
  const out = fs.createWriteStream(tmp);
  let received = 0;
  let aborted = false;

  req.on("data", (chunk: Buffer) => {
    received += chunk.length;
    if (received > MAX_UPLOAD_BYTES && !aborted) {
      aborted = true;
      req.destroy();
      out.destroy();
    }
  });

  try {
    await new Promise<void>((resolve, reject) => {
      req.pipe(out);
      out.on("finish", () => resolve());
      out.on("error", reject);
      req.on("error", reject);
    });
    if (aborted) {
      await fsp.unlink(tmp).catch(() => {});
      return void res.writeHead(413).end("Payload too large");
    }
    await fsp.rename(tmp, abs);
  } catch (err) {
    await fsp.unlink(tmp).catch(() => {});
    throw err;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ path: urlPath, size: received }));
}

async function deleteFile(
  req: IncomingMessage,
  res: ServerResponse,
  urlPath: string,
): Promise<void> {
  if (!isAuthorized(req)) return void res.writeHead(401).end("Unauthorized");
  const abs = resolveFilePath(urlPath);
  if (!abs) return void res.writeHead(400).end("Bad path");

  try {
    await fsp.unlink(abs);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return void res.writeHead(404).end("Not found");
    }
    throw err;
  }
  res.writeHead(204).end();
}

// Returns true if the request was handled (so the caller knows to skip
// the GraphQL handler). Returns false for non-/files/ URLs.
export function handleFileRequest(
  req: IncomingMessage,
  res: ServerResponse,
): boolean {
  const urlPath = (req.url ?? "/").split("?")[0]!;
  if (!urlPath.startsWith("/files/")) return false;

  const method = req.method ?? "GET";
  // Top-level await isn't allowed here; we fire-and-forget the async
  // handlers and rely on their internal error paths to write a response.
  // Any rejection lands in the unhandledRejection logger.
  const run = (p: Promise<void>) => {
    p.catch((err) => {
      console.error(`[files] ${method} ${urlPath} failed:`, err);
      if (!res.headersSent) res.writeHead(500).end("Internal error");
    });
  };

  if (method === "GET" || method === "HEAD") {
    run(serveFile(req, res, urlPath));
    return true;
  }
  if (method === "PUT") {
    run(writeFile(req, res, urlPath));
    return true;
  }
  if (method === "DELETE") {
    run(deleteFile(req, res, urlPath));
    return true;
  }
  res.writeHead(405, { Allow: "GET, HEAD, PUT, DELETE" }).end("Method not allowed");
  return true;
}
