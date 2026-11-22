/* == server/notificationDelivery.ts - the one place a notification is routed ==
   Anything that wants to tell a person something calls deliverNotification()
   and gets their choices honoured: the bell, an email now, an email in the
   next digest, or nothing. The decision itself is routeNotification() in
   lib/notificationPrefs.ts; this file only carries it out.

   The bell (issue #185) has four kinds, so only the categories that map onto
   one of them can be shown in-app today; the others are routed but, for the
   in-app channel, report that nothing was stored. == */
import type { NotifKind } from "../notifications";
import { routeNotification, type Category, type Route } from "../notificationPrefs";
import { createNotification } from "./notifications";
import { enqueue, emailOf, getPrefs } from "./notificationPrefs";
import { linksFor, renderNotification, sendMail, type NotificationEvent } from "./notificationEmail";

const IN_APP_KIND: Partial<Record<Category, NotifKind>> = { deadlines: "deadline", mentions: "mention" };

export type Delivery = { route: Route; delivered: boolean; reason?: string };

/** Callers must have checked backendReady() first, like the rest of server/. */
export async function deliverNotification(userId: string, category: Category, event: NotificationEvent): Promise<Delivery> {
  const route = routeNotification(await getPrefs(userId), category);

  if (route === "none") return { route, delivered: false };

  if (route === "in_app") {
    const kind = IN_APP_KIND[category];
    if (!kind) return { route, delivered: false, reason: "the bell has no kind for this category yet" };
    return { route, delivered: Boolean(await createNotification(userId, { kind, ...event })) };
  }

  if (route === "email_digest") {
    await enqueue(userId, { category, ...event });
    return { route, delivered: true };
  }

  const [to, signed] = [await emailOf(userId), linksFor(userId)];
  if (!to) return { route, delivered: false, reason: "this account has no email address" };
  if (!signed) return { route, delivered: false, reason: "no signed unsubscribe link can be made (SESSION_SECRET)" };
  const result = await sendMail({ to, rendered: await renderNotification(category, event, signed.links), oneClickUrl: signed.oneClickUrl });
  if (result.sent) return { route, delivered: true };
  return { route, delivered: false, reason: "demo" in result ? "email is not configured (RESEND_API_KEY)" : result.error };
}
