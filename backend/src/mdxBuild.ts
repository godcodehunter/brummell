// Compiles an article's main.mdx into a JS bundle suitable for
// `getMDXComponent` on the client. Results are cached on disk under
// ${dbDir}/build/, keyed by source mtime — a request only pays the
// esbuild cost when main.mdx is newer than the cached build.

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { bundleMDX } from "mdx-bundler";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { config } from "./config.js";
import { FILES_DIR } from "./files.js";

export const BUILD_DIR = path.join(config.dbDir, "build");

// Shared MDX pipeline options. remark-math parses $...$ / $$...$$ blocks
// and rehype-katex turns them into KaTeX HTML at build time, so the client
// only needs the KaTeX CSS — no JS runtime, no per-page math compile.
export const mdxOptionsWithMath = (opts: Parameters<NonNullable<Parameters<typeof bundleMDX>[0]["mdxOptions"]>>[0]) => {
  opts.remarkPlugins = [...(opts.remarkPlugins ?? []), remarkMath];
  opts.rehypePlugins = [...(opts.rehypePlugins ?? []), rehypeKatex];
  return opts;
};

// `articlePath` is the relative path stored in the articles row (e.g.
// "articles/lock-free-queues"). Returns null when main.mdx is missing.
export async function compileArticleMDX(articlePath: string): Promise<string | null> {
  const sourcePath = path.join(FILES_DIR, articlePath, "main.mdx");

  let sourceStat;
  try {
    sourceStat = await fs.stat(sourcePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }

  const cachePath = path.join(BUILD_DIR, `${articlePath}.js`);
  try {
    const cacheStat = await fs.stat(cachePath);
    if (cacheStat.mtimeMs >= sourceStat.mtimeMs) {
      return await fs.readFile(cachePath, "utf8");
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  const source = await fs.readFile(sourcePath, "utf8");
  const { code } = await bundleMDX({
    source,
    cwd: path.dirname(sourcePath),
    mdxOptions: mdxOptionsWithMath,
  });

  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, code);
  return code;
}
