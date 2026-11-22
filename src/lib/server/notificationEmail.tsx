/* == server/notificationEmail.tsx - render a notification and hand it to Resend
   Rendering uses the React Email templates in src/emails. Sending is the same
   plain fetch to the Resend HTTP API that the sign-in code email uses (same
   RESEND_API_KEY and EMAIL_FROM, same safe error text), plus the two headers
   mail clients need for their own "Unsubscribe" button: List-Unsubscribe and
   List-Unsubscribe-Post (RFC 8058 one-click).

   An email is only ever sent with an unsubscribe link in it: when no signed
   link can be made (no SESSION_SECRET) nothing is sent. == */
import { render } from "@react-email/components";
import DigestEmail from "../../emails/DigestEmail";
import NotificationEmail from "../../emails/NotificationEmail";
import type { Links } from "../../emails/Layout";
import {
  CATEGORIES, digestSubject, groupByCategory, SAMPLE_EVENTS,
  type Category, type DigestItem, type Frequency, type PreviewTemplate,
} from "../notificationPrefs";
import { SITE_ORIGIN } from "../seo";
import { resendReason, TEST_FROM } from "./email";
import { signUnsubscribeToken } from "./unsubscribeToken";

export type Rendered = { subject: string; html: string; text: string };
export type MailResult = { sent: true } | { sent: false; demo: true } | { sent: false; error: string };
export type NotificationEvent = { title: string; body: string; href: string };

/** an on-site path or an http(s) URL, made absolute; anything else (a
 *  javascript: URL, a bare word) becomes "" and the email just has no button */
export function absoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return `${SITE_ORIGIN}${href}`;
  return "";
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

const PREFERENCES_URL = `${SITE_ORIGIN}/dashboard/settings`;

/** the two links every email carries, signed for this person, or null when
 *  the deploy cannot sign (and so must not send) */
export function linksFor(userId: string): { links: Links; oneClickUrl: string } | null {
  const token = signUnsubscribeToken(userId);
  if (!token) return null;
  return {
    links: { unsubscribeUrl: `${SITE_ORIGIN}/unsubscribe?t=${token}`, preferencesUrl: PREFERENCES_URL },
    oneClickUrl: `${SITE_ORIGIN}/api/notifications/unsubscribe?t=${token}`,
  };
}

async function both(element: React.ReactElement): Promise<{ html: string; text: string }> {
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);
  return { html, text };
}

export async function renderNotification(category: Category, event: NotificationEvent, links: Links): Promise<Rendered> {
  const { html, text } = await both(
    <NotificationEmail category={category} title={event.title} body={event.body} href={absoluteUrl(event.href)} links={links} />,
  );
  return { subject: oneLine(event.title).slice(0, 120) || "A notification from cyrus.ai", html, text };
}

export async function renderDigest(items: DigestItem[], frequency: Frequency, links: Links): Promise<Rendered> {
  const groups = groupByCategory(items).map((g) => ({
    category: g.category,
    items: g.items.map((i) => ({ title: i.title, body: i.body, href: absoluteUrl(i.href) })),
  }));
  const { html, text } = await both(<DigestEmail groups={groups} frequency={frequency} links={links} />);
  return { subject: digestSubject(items.length, frequency), html, text };
}

/** a template with sample content and placeholder links, for the panel's
 *  preview. It never touches a user's data and sends nothing. */
export async function renderPreview(template: PreviewTemplate): Promise<Rendered> {
  const links: Links = { unsubscribeUrl: `${SITE_ORIGIN}/unsubscribe`, preferencesUrl: PREFERENCES_URL };
  if (template === "digest") {
    const items: DigestItem[] = CATEGORIES.map((category) => ({ category, ...SAMPLE_EVENTS[category] }));
    return renderDigest(items, "daily", links);
  }
  return renderNotification(template, SAMPLE_EVENTS[template], links);
}

export async function sendMail(opts: { to: string; rendered: Rendered; oneClickUrl: string }): Promise<MailResult> {
  const key = (process.env.RESEND_API_KEY ?? "").trim();
  if (!key) return { sent: false, demo: true };
  const from = (process.env.EMAIL_FROM ?? "").trim();
  if (!from && process.env.NODE_ENV === "production") {
    return { sent: false, error: "email not configured: EMAIL_FROM must be a sender on a domain verified in Resend" };
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: from || TEST_FROM,
        to: [opts.to.trim()],
        subject: opts.rendered.subject,
        html: opts.rendered.html,
        text: opts.rendered.text,
        headers: {
          "List-Unsubscribe": `<${opts.oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    });
    if (!r.ok) return { sent: false, error: await resendReason(r) };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : "send failed" };
  }
}
