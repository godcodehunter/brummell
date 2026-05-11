import { config } from "./config";
import { Article, Comment } from "./db/schema";

const TELEGRAM_TIMEOUT_MS = 5_000;

// Fire-and-forget Telegram DM. Never throws — a broken notification
// must not break the caller's flow. No-ops when --tg was not supplied.
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
  const msg = `

  `

  notify(msg)
}
