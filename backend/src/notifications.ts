import { eq } from "drizzle-orm";
import { Agent } from "undici";
import { config } from "./config";
import { db } from "./db/client";
import {
  Article,
  Comment,
  CommentTarget,
  articles,
  podcasts
} from "./db/schema";


const TELEGRAM_TIMEOUT_MS = 30_000;

// undici has its own connectTimeout (default 10s) that fires *before* our
// AbortSignal — so on slow/throttled links to api.telegram.org we'd get
// UND_ERR_CONNECT_TIMEOUT before the AbortSignal ever got a chance. This
// dispatcher widens the TCP/TLS handshake budget so the overall AbortSignal
// stays the single source of truth for "give up".
const telegramDispatcher = new Agent({
  connectTimeout: TELEGRAM_TIMEOUT_MS,
  headersTimeout: TELEGRAM_TIMEOUT_MS,
  bodyTimeout: TELEGRAM_TIMEOUT_MS,
});


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
        // `dispatcher` is undici-specific; TS lib.dom doesn't know about it.
        dispatcher: telegramDispatcher,
      } as RequestInit,
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

export function notifyNewComment(comment: Comment, target: CommentTarget) {
  const targetLink =
    `${config.publicUrl}/${target.type}` +
    `?id=${target.entity_id}&msg=${comment.id}`;

  notify(
    `💬 A new message has been posted\n\n` +
    `Target: ${describeCommentTarget(target)}\n\n` +
    `Text:\n${comment.text}\n\n` +
    `Link: ${targetLink}`,
  );
}
