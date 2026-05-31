// Daily badge ("ribbon") recomputation. For every published article/shot/podcast,
// builds an engagement score with exponential time-decay, then:
//   - "hot"  — score is a robust outlier (median + 1.5·MAD) AND ≥ absolute floor,
//              capped at top-N per target type.
//   - "new"  — created within the last NEW_TTL_SEC and not already hot.
// The ribbon table has a unique (target_type, target_id) — only one badge wins,
// and "hot" beats "new".
//
// When an article transitions into "hot" on this tick, we fire the Telegram
// notification from notifications.ts.

import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "./db/client.js";
import {
  articles,
  comments,
  commentTargets,
  pageViews,
  podcasts,
  ribbon as ribbonTable,
  shots,
  type RibbonKind,
  type RibbonTargetType,
} from "./db/schema.js";
import { notifyBecameHot } from "./notifications.js";

const DAY_SEC = 86_400;
const TAU_SEC = 7 * DAY_SEC;            // time-decay characteristic time
const COMMENT_WEIGHT = 20;              // 1 comment ≈ 20 views (engagement)
const ABSOLUTE_MIN_SCORE = 50;          // floor so quiet periods don't crown a hot
const TOP_N_CAP = 5;                    // at most N hot per target type
const MAD_THRESHOLD_K = 1.5;            // median + k·MAD → outlier cut
const NEW_TTL_SEC = 7 * DAY_SEC;        // "new" badge lifetime
const TICK_MS = 24 * 60 * 60 * 1000;    // recompute cadence: 1 day

type Score = {
  targetType: RibbonTargetType;
  targetId: number;
  score: number;
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

function mad(xs: number[]): number {
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

function computeScores(now: number): Score[] {
  const published = [
    ...db.select({ id: articles.id })
      .from(articles)
      .where(eq(articles.publish_status, "published"))
      .all()
      .map((r) => ({ type: "article" as const, id: r.id })),
    ...db.select({ id: shots.id })
      .from(shots)
      .where(eq(shots.publish_status, "published"))
      .all()
      .map((r) => ({ type: "shot" as const, id: r.id })),
    ...db.select({ id: podcasts.id })
      .from(podcasts)
      .where(eq(podcasts.publish_status, "published"))
      .all()
      .map((r) => ({ type: "podcast" as const, id: r.id })),
  ];

  return published.map(({ type, id }) => {
    const ct = db.select()
      .from(commentTargets)
      .where(and(eq(commentTargets.type, type), eq(commentTargets.entity_id, id)))
      .get();

    let commentsScore = 0;
    if (ct) {
      const rows = db.select({ created_at: comments.created_at })
        .from(comments)
        .where(eq(comments.target_id, ct.id))
        .all();
      for (const r of rows) {
        commentsScore += Math.exp(-(now - r.created_at) / TAU_SEC);
      }
    }

    let viewsScore = 0;
    const vrows = db.select({ day: pageViews.day, count: pageViews.count })
      .from(pageViews)
      .where(and(eq(pageViews.target_type, type), eq(pageViews.target_id, id)))
      .all();
    for (const r of vrows) {
      viewsScore += r.count * Math.exp(-(now - r.day) / TAU_SEC);
    }

    return {
      targetType: type,
      targetId: id,
      score: COMMENT_WEIGHT * commentsScore + viewsScore,
    };
  });
}

function pickHot(scores: Score[]): Set<string> {
  const hot = new Set<string>();
  for (const type of ["article", "shot", "podcast"] as const) {
    const byType = scores.filter((s) => s.targetType === type);
    if (byType.length === 0) continue;

    const values = byType.map((s) => s.score);
    const threshold = median(values) + MAD_THRESHOLD_K * mad(values);

    byType
      .filter((s) => s.score >= threshold && s.score >= ABSOLUTE_MIN_SCORE)
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_N_CAP)
      .forEach((c) => hot.add(`${c.targetType}:${c.targetId}`));
  }
  return hot;
}

function pickNew(now: number): Set<string> {
  const since = now - NEW_TTL_SEC;
  const out = new Set<string>();

  for (const r of db.select({ id: articles.id })
    .from(articles)
    .where(and(eq(articles.publish_status, "published"), gte(articles.created_at, since)))
    .all()) {
    out.add(`article:${r.id}`);
  }
  for (const r of db.select({ id: shots.id })
    .from(shots)
    .where(and(eq(shots.publish_status, "published"), gte(shots.created_at, since)))
    .all()) {
    out.add(`shot:${r.id}`);
  }
  for (const r of db.select({ id: podcasts.id })
    .from(podcasts)
    .where(and(eq(podcasts.publish_status, "published"), gte(podcasts.created_at, since)))
    .all()) {
    out.add(`podcast:${r.id}`);
  }
  return out;
}

export function recomputeRibbons(): void {
  const now = Math.floor(Date.now() / 1000);

  const scores = computeScores(now);
  const hot = pickHot(scores);
  const fresh = pickNew(now);

  // "hot" wins over "new" — unique index allows only one badge per target.
  const desired = new Map<string, RibbonKind>();
  for (const k of fresh) desired.set(k, "new");
  for (const k of hot) desired.set(k, "hot");

  const current = new Map<string, { id: number; kind: RibbonKind }>();
  for (const row of db.select().from(ribbonTable).all()) {
    current.set(
      `${row.target_type}:${row.target_id}`,
      { id: row.id, kind: row.ribbon },
    );
  }

  const newlyHotArticles: number[] = [];

  db.transaction((tx) => {
    for (const [key, kind] of desired) {
      const [target_type, target_id_s] = key.split(":") as [RibbonTargetType, string];
      const target_id = Number(target_id_s);
      const prev = current.get(key);

      if (!prev) {
        tx.insert(ribbonTable)
          .values({ target_type, target_id, ribbon: kind })
          .run();
        if (kind === "hot" && target_type === "article") {
          newlyHotArticles.push(target_id);
        }
      } else if (prev.kind !== kind) {
        tx.update(ribbonTable)
          .set({ ribbon: kind })
          .where(eq(ribbonTable.id, prev.id))
          .run();
        if (kind === "hot" && prev.kind !== "hot" && target_type === "article") {
          newlyHotArticles.push(target_id);
        }
      }
    }
    for (const [key, { id }] of current) {
      if (!desired.has(key)) {
        tx.delete(ribbonTable).where(eq(ribbonTable.id, id)).run();
      }
    }
  });

  // Side-effect (Telegram) lives outside the transaction so a network hiccup
  // can't roll back the ribbon state we just committed.
  if (newlyHotArticles.length > 0) {
    const rows = db.select()
      .from(articles)
      .where(inArray(articles.id, newlyHotArticles))
      .all();
    for (const a of rows) notifyBecameHot(a);
  }
}

export function startRibbonScheduler(): void {
  const tick = () => {
    try {
      recomputeRibbons();
    } catch (err) {
      console.error("🚨 ribbon recompute failed:", err);
    }
  };
  tick();
  setInterval(tick, TICK_MS);
  console.log("🎀 Ribbon scheduler started (24h tick)");
}
