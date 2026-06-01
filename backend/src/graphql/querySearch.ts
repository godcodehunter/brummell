// Search backend for `searchBlogContent`. Lives apart from schema.ts so the
// GraphQL layer just calls runSearch() and isn't cluttered with the candidate
// gathering / filtering logic.
//
// Flow:
//   1. Get candidate (type, id) pairs:
//        - non-empty query → Google CSE (or local LIKE if env vars are unset)
//        - empty query     → every entity in the DB
//   2. Filter by content type (subset of "article"/"podcast"/"shot").
//   3. Filter by tag labels — entity must carry *every* requested label.
//   4. Hydrate full rows, sorted by created_at desc.

import { and, eq, inArray, like } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  articles,
  podcasts,
  shots,
  tagSets,
  tags,
  type Article,
  type Podcast,
  type Shot,
} from "../db/schema.js";

export type EntityType = "article" | "podcast" | "shot";
export type Candidate = { type: EntityType, id: number };

const isEntityType = (s: string): s is EntityType =>
  s === "article" || s === "podcast" || s === "shot";

// Pull candidate pairs from a SearXNG instance (self-hosted meta-search).
// Returns null if `SEARXNG_URL` is unset — caller falls back to the local
// search path. Returns [] on a successful but empty response.
//
// Env:
//   SEARXNG_URL  — base URL of the SearXNG instance, e.g. http://searxng:8080
//   SITE_URL     — site we restrict results to via the `site:` operator (the
//                  bare domain, no protocol). If unset, the operator is
//                  omitted and the search runs across the whole web.
async function searchSearXNG(query: string): Promise<Candidate[] | null> {
  const base = process.env.SEARXNG_URL;
  if (!base) return null;
  const site = process.env.SITE_URL;

  const q = site ? `${query} site:${site}` : query;
  const params = new URLSearchParams({
    q,
    format: "json",
    // Keep the response light — only general web results, no images/news/etc.
    categories: "general",
  });
  const url = `${base.replace(/\/$/, "")}/search?${params.toString()}`;

  const res = await fetch(url, {
    headers: {
      // Some SearXNG deployments reject the default node fetch UA.
      "User-Agent": "brummell-backend/1.0",
    },
  });
  if (!res.ok) {
    console.warn(`[searchSearXNG] HTTP ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { results?: { url: string }[] };
  console.log("🔍 SearXNG query run result:", JSON.stringify(json));
  const results = json.results ?? [];

  // Dedupe identical URLs — SearXNG aggregates multiple upstream engines and
  // the same blog page often appears more than once.
  const seen = new Set<string>();
  return results.flatMap<Candidate>((it) => {
    if (seen.has(it.url)) return [];
    seen.add(it.url);
    try {
      const u = new URL(it.url);
      const path = u.pathname.replace(/^\/+|\/+$/g, "");
      const id = Number(u.searchParams.get("id"));
      if (!Number.isInteger(id) || id <= 0) return [];
      if (!isEntityType(path)) return [];
      return [{ type: path, id }];
    } catch {
      return [];
    }
  });
}

// Dev fallback — Google can't index localhost, so look up matches by headline
// substring directly in the DB. Shots have no headline so they're skipped.
function searchLocal(query: string): Candidate[] {
  const pattern = `%${query}%`;
  const articleHits = db
    .select({ id: articles.id })
    .from(articles)
    .where(like(articles.headline, pattern))
    .all()
    .map<Candidate>(r => ({ type: "article", id: r.id }));
  const podcastHits = db
    .select({ id: podcasts.id })
    .from(podcasts)
    .where(like(podcasts.headline, pattern))
    .all()
    .map<Candidate>(r => ({ type: "podcast", id: r.id }));
  const result = [...articleHits, ...podcastHits];
  console.log("🔍 Local query run result:", JSON.stringify(result));
  return result;
}

function allEntityCandidates(): Candidate[] {
  return [
    ...db.select({ id: articles.id }).from(articles).all()
      .map<Candidate>(r => ({ type: "article", id: r.id })),
    ...db.select({ id: podcasts.id }).from(podcasts).all()
      .map<Candidate>(r => ({ type: "podcast", id: r.id })),
    ...db.select({ id: shots.id }).from(shots).all()
      .map<Candidate>(r => ({ type: "shot", id: r.id })),
  ];
}

// Entity passes the tag filter when its tag_set contains every requested tag.
function filterByTags(candidates: Candidate[], tagLabels: string[]): Candidate[] {
  if (tagLabels.length === 0) return candidates;
  const requiredTagIds = db
    .select({ id: tags.id })
    .from(tags)
    .where(inArray(tags.label, tagLabels))
    .all()
    .map(r => r.id);
  // Unknown label → nothing can satisfy the filter.
  if (requiredTagIds.length < tagLabels.length) return [];

  return candidates.filter((c) => {
    const row = db
      .select({ tag_ids: tagSets.tag_ids })
      .from(tagSets)
      .where(and(eq(tagSets.type, c.type), eq(tagSets.entity_id, c.id)))
      .all()[0];
    if (!row) return false;
    return requiredTagIds.every(tid => row.tag_ids.includes(tid));
  });
}

function filterByType(candidates: Candidate[], contentTypes: string[]): Candidate[] {
  if (contentTypes.length === 0) return candidates;
  const allowed = new Set<EntityType>(contentTypes.filter(isEntityType));
  return candidates.filter(c => allowed.has(c.type));
}

// Fetch the full DB row for each candidate so the union resolver can
// discriminate Article vs Shot vs Podcast off of the row shape. Drafts
// never reach the public surface — drop them here so every upstream
// candidate source (SearXNG / local / "all entities") is filtered uniformly.
function hydrate(candidates: Candidate[]): (Article | Shot | Podcast)[] {
  const out: (Article | Shot | Podcast)[] = [];
  for (const c of candidates) {
    let row: Article | Shot | Podcast | undefined;
    if (c.type === "article") {
      row = db.select().from(articles).where(eq(articles.id, c.id)).all()[0];
    } else if (c.type === "podcast") {
      row = db.select().from(podcasts).where(eq(podcasts.id, c.id)).all()[0];
    } else {
      row = db.select().from(shots).where(eq(shots.id, c.id)).all()[0];
    }
    if (!row) continue;
    if (row.publish_status !== "published") continue;
    out.push(row);
  }
  return out.sort((a, b) => b.created_at - a.created_at);
}

export async function runSearch(
  query: string,
  tagLabels: string[],
  contentTypes: string[],
): Promise<(Article | Shot | Podcast)[]> {
  const trimmed = query.trim();

  let candidates: Candidate[];
  if (trimmed) {
    const external = await searchSearXNG(trimmed);
    candidates = external ?? searchLocal(trimmed);
  } else {
    candidates = allEntityCandidates();
  }

  candidates = filterByType(candidates, contentTypes);
  candidates = filterByTags(candidates, tagLabels);
  return hydrate(candidates);
}
