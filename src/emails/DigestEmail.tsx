/* == emails/DigestEmail.tsx - a batch of notifications in one message ========
   Sent for the "daily digest" and "weekly digest" frequencies. Items are grouped
   by category in the same order the preferences panel lists them. == */
import { Link, Text } from "@react-email/components";
import { CATEGORY_LABEL, type Category, type Frequency } from "../lib/notificationPrefs";
import { colors, Layout, type Links } from "./Layout";

export type DigestGroup = { category: Category; items: { title: string; body: string; href: string }[] };

export type DigestEmailProps = {
  groups: DigestGroup[];
  frequency: Frequency;
  links: Links;
};

export default function DigestEmail({ groups, frequency, links }: DigestEmailProps) {
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const cadence = frequency === "weekly" ? "weekly" : "daily";
  return (
    <Layout
      preview={total === 1 ? "1 update since your last digest" : `${total} updates since your last digest`}
      why={`You get this ${cadence} digest because you chose email for some notifications on cyrus.ai.`}
      links={links}
    >
      <Text style={{ margin: "16px 0 4px", fontSize: "18px", fontWeight: 700, lineHeight: "24px", color: colors.ink }}>
        {total === 1 ? "1 update" : `${total} updates`} since your last digest
      </Text>
      {groups.map((g) => (
        <div key={g.category}>
          <Text style={{ margin: "18px 0 6px", fontSize: "11px", letterSpacing: ".12em", textTransform: "uppercase", color: colors.accent }}>
            {CATEGORY_LABEL[g.category]}
          </Text>
          {g.items.map((item, i) => (
            <div key={i} style={{ margin: "0 0 12px" }}>
              <Text style={{ margin: 0, fontSize: "14px", fontWeight: 600, lineHeight: "20px", color: colors.ink }}>
                {item.href ? <Link href={item.href} style={{ color: colors.ink, textDecoration: "underline" }}>{item.title}</Link> : item.title}
              </Text>
              {item.body ? <Text style={{ margin: "2px 0 0", fontSize: "13px", lineHeight: "19px", color: colors.muted }}>{item.body}</Text> : null}
            </div>
          ))}
        </div>
      ))}
    </Layout>
  );
}
