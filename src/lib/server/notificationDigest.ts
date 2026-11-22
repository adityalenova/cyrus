/* == server/notificationDigest.ts - send the digests that are owed ============
   Called by the cron route. For every person with email waiting, it asks the
   pure rule (digestDue) whether a slot in THEIR timezone has passed since their
   last digest, and if so sends everything waiting as one message.

   It is safe to call at any frequency and safe to overlap: the rows are claimed
   before sending, so two runs cannot send the same row, and a failed send puts
   the rows back. One person's failure never stops the run. == */
import { digestDue, isCategory, type DigestItem } from "../notificationPrefs";
import {
  claim, discardPending, emailOf, getStoredPrefs, oldestPending, pendingFor, release, stampDigest, usersWithPending,
} from "./notificationPrefs";
import { linksFor, renderDigest, sendMail } from "./notificationEmail";

export type DigestRun = { checked: number; sent: number; skipped: number; failed: number };

const MAX_PER_DIGEST = 50;

export async function runDigests(now: Date = new Date()): Promise<DigestRun> {
  const run: DigestRun = { checked: 0, sent: 0, skipped: 0, failed: 0 };
  for (const userId of await usersWithPending()) {
    run.checked++;
    try {
      const { prefs, lastDigestAt } = await getStoredPrefs(userId);
      if (prefs.unsubscribedAll) {
        await discardPending(userId); // they said stop; do not let it pile up
        run.skipped++;
        continue;
      }
      const since = lastDigestAt ?? (await oldestPending(userId));
      if (!since || !digestDue(prefs, now, since)) { run.skipped++; continue; }

      const [to, signed] = [await emailOf(userId), linksFor(userId)];
      if (!to || !signed) { run.skipped++; continue; }

      const waiting = await pendingFor(userId, MAX_PER_DIGEST);
      const claimed = await claim(userId, waiting.map((r) => r.id), now);
      if (!claimed.length) { run.skipped++; continue; }

      const items: DigestItem[] = claimed.flatMap((r) =>
        isCategory(r.category) ? [{ category: r.category, title: r.title, body: r.body, href: r.href }] : []);
      if (!items.length) { run.skipped++; continue; } // rows with a category this version does not know
      const ids = claimed.map((r) => r.id);
      const result = await sendMail({
        to,
        rendered: await renderDigest(items, prefs.frequency, signed.links),
        oneClickUrl: signed.oneClickUrl,
      });
      if (result.sent) {
        await stampDigest(userId, now);
        run.sent++;
      } else {
        await release(ids); // not lost: the next run tries again
        if ("demo" in result) run.skipped++;
        else run.failed++;
      }
    } catch {
      run.failed++;
    }
  }
  return run;
}
