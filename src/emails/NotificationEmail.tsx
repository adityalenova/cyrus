/* == emails/NotificationEmail.tsx - one notification, sent as it happens ======
   Used for the "immediately" frequency. The title and body are plain text, never
   markup: whatever a producer passes is escaped by React, so a title cannot
   inject HTML into someone's inbox. == */
import { Button, Text } from "@react-email/components";
import { CATEGORY_LABEL, type Category } from "../lib/notificationPrefs";
import { colors, Layout, type Links } from "./Layout";

export type NotificationEmailProps = {
  category: Category;
  title: string;
  body: string;
  /** absolute URL to open, or "" for none */
  href: string;
  links: Links;
};

export default function NotificationEmail({ category, title, body, href, links }: NotificationEmailProps) {
  return (
    <Layout
      preview={title}
      why={`You get this because you chose email for ${CATEGORY_LABEL[category].toLowerCase()} on cyrus.ai.`}
      links={links}
    >
      <Text style={{ margin: "16px 0 4px", fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: colors.accent }}>
        {CATEGORY_LABEL[category]}
      </Text>
      <Text style={{ margin: "0 0 8px", fontSize: "18px", fontWeight: 700, lineHeight: "24px", color: colors.ink }}>{title}</Text>
      {body ? <Text style={{ margin: "0 0 16px", fontSize: "14px", lineHeight: "21px", color: colors.muted }}>{body}</Text> : null}
      {href ? (
        <Button href={href} style={{ backgroundColor: colors.accent, color: "#ffffff", borderRadius: "10px", fontSize: "14px", fontWeight: 600, padding: "10px 18px", textDecoration: "none" }}>
          Open on cyrus.ai
        </Button>
      ) : null}
    </Layout>
  );
}
