import db from "./db";
import { sendPushToUser } from "./webpush";

// How long after the last new-chapter event for a (user, series) pair we wait
// before flushing the batch. Tuned to swallow back-fills without sitting on
// truly fresh news too long.
const BATCH_WINDOW_MS = 10 * 60 * 1000;

// Replaces the old "fire one push per chapter" path. For each favoriter of
// the given series, upsert an outbox row; the flusher will coalesce them
// into a single push once the window is quiet.
export function enqueueChapterNotification(seriesId: number, chapterNumber: number): void {
  const subs = db.prepare(
    "SELECT user_id FROM favorites WHERE series_id = ?"
  ).all(seriesId) as { user_id: number }[];
  if (subs.length === 0) return;

  const stmt = db.prepare(`
    INSERT INTO notification_outbox (user_id, series_id, chapter_count, latest_chapter, first_at, last_at)
    VALUES (?, ?, 1, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id, series_id) DO UPDATE SET
      chapter_count = chapter_count + 1,
      latest_chapter = excluded.latest_chapter,
      last_at = datetime('now')
  `);
  const txn = db.transaction((rows: { user_id: number }[]) => {
    for (const r of rows) stmt.run(r.user_id, seriesId, chapterNumber);
  });
  txn(subs);
}

interface OutboxRow {
  user_id: number;
  series_id: number;
  chapter_count: number;
  latest_chapter: number | null;
  first_at: string;
  last_at: string;
  title: string;
  one_shot: number;
}

async function flushOutbox(): Promise<void> {
  // Rows whose last enqueue is older than the batch window are ready to send.
  const cutoff = `datetime('now', '-${Math.floor(BATCH_WINDOW_MS / 1000)} seconds')`;
  const ready = db.prepare(`
    SELECT o.user_id, o.series_id, o.chapter_count, o.latest_chapter,
           o.first_at, o.last_at, s.title, s.one_shot
    FROM notification_outbox o
    JOIN series s ON s.id = o.series_id
    WHERE o.last_at <= ${cutoff}
  `).all() as OutboxRow[];

  if (ready.length === 0) return;

  for (const row of ready) {
    const body = formatBody(row);
    try {
      await sendPushToUser(row.user_id, {
        title: row.title,
        body,
        url: `/library/${row.series_id}`,
      });
    } catch (e) {
      console.warn("[outbox] push failed:", (e as Error).message);
    }
    db.prepare(
      "DELETE FROM notification_outbox WHERE user_id = ? AND series_id = ?"
    ).run(row.user_id, row.series_id);
  }
}

function formatBody(row: OutboxRow): string {
  if (row.one_shot === 1) return "Now available in your library";
  if (row.chapter_count === 1) {
    const n = row.latest_chapter;
    return n != null ? `Chapter ${formatChapter(n)} downloaded` : "New chapter available";
  }
  return `${row.chapter_count} new chapters available`;
}

function formatChapter(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

let interval: NodeJS.Timeout | null = null;

export function startOutboxFlusher(): void {
  if (interval) return;
  // Poll frequently; the window check inside flushOutbox decides what's ready.
  interval = setInterval(() => {
    flushOutbox().catch((e) => console.warn("[outbox] flush error:", (e as Error).message));
  }, 30_000);
  interval.unref?.();
}
