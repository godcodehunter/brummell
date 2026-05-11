import { eq } from "drizzle-orm";
import { config } from "./config";
import { db } from "./db/client";
import { Article, Comment, articles, targets } from "./db/schema";


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

export function notifyNewComment(comment: Comment) {
  const target = db
    .select()
    .from(targets)
    .where(
      eq(targets.id, comment.target_id)
    ).get()!;

  let targetLabel: string;
  let targetLink: string;
  switch (target.type) {
    case "article": {
      const article = db
        .select()
        .from(articles)
        .where(
          eq(articles.id, target.entity_id)
        ).get()!;

      targetLabel = `article "${article.headline}"`;
      targetLink = `${config.publicUrl}/article?id=${article.id}&msg=${comment.id}`;
      break;
    }
    // TODO: shots and podcasts aren't wired up yet — add cases when those
    // tables and frontend routes exist.
    case "shot":
    case "podcast":
      return;
  }

  notify(
    `💬 A new message has been posted\n\n` +
    `Target: ${targetLabel}\n\n` +
    `Text:\n${comment.text}\n\n` +
    `Link: ${targetLink}`,
  );
}
