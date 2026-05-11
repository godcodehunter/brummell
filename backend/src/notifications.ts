import { eq } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db/client";
import {
  Article,
  Comment,
  CommentTarget,
  articles,
  commentTargets,
  podcasts
} from "./db/schema";


const TELEGRAM_TIMEOUT_MS = 5_000;


async function notify(text: string): Promise<void> {
  if (!config.tg) return;
  const { botToken, chatId } = config.tg;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      console.error(
        `Telegram notify failed: ${res.status} ${await res.text()}`,
      );
    }
  } catch (err) {
    console.error("Telegram notify failed:", err);
  }
}

export function notifyBecameHot(article: Article) {
  notify(
    `🔥 An article is heating up\n\n` +
    `${article.headline}\n\n` +
    `Link: ${config.publicUrl}/article?id=${article.id}`,
  );
}

// Human-readable label for a target. Articles and podcasts have a
// headline; shots don't, so fall back to the numeric id.
function describeCommentTarget(target: CommentTarget): string {
  switch (target.type) {
    case "article": {
      const a = db.select()
        .from(articles)
        .where(
          eq(articles.id, target.entity_id)
        ).get()!;

      return `article "${a.headline}"`;
    }
    case "podcast": {
      const p = db.select()
        .from(podcasts)
        .where(
          eq(podcasts.id, target.entity_id)
        )
        .get()!;

      return `podcast "${p.headline}"`;
    }
    case "shot":
      return `shot #${target.entity_id}`;
  }
}

export function notifyNewComment(comment: Comment) {
  const commentTarget = db
    .select()
    .from(commentTargets)
    .where(eq(commentTargets.id, comment.target_id))
    .get()!;

  const targetLink =
    `${config.publicUrl}/${commentTarget.type}` +
    `?id=${commentTarget.entity_id}&msg=${comment.id}`;

  notify(
    `💬 A new message has been posted\n\n` +
    `Target: ${describeCommentTarget(commentTarget)}\n\n` +
    `Text:\n${comment.text}\n\n` +
    `Link: ${targetLink}`,
  );
}
