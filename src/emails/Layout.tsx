/* == emails/Layout.tsx - the frame every notification email sits in =========
   React Email components, inline styles only (mail clients ignore classes and
   most stylesheets). The footer is where the two links the issue requires live:
   one-click unsubscribe, and the way back to the preferences panel. Colors
   match the sign-in code email so both read as the same sender. == */
import { Body, Container, Head, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";
import type { ReactNode } from "react";

export const colors = { page: "#f5efe7", card: "#ffffff", line: "#e7dccd", ink: "#241b13", muted: "#6e6153", accent: "#b4602c" };

const font = "-apple-system,Segoe UI,Helvetica,Arial,sans-serif";

export type Links = {
  /** absolute URL of the confirm-and-unsubscribe page */
  unsubscribeUrl: string;
  /** absolute URL of the preferences panel */
  preferencesUrl: string;
};

export function Layout({ preview, why, links, children }: { preview: string; why: string; links: Links; children: ReactNode }) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, backgroundColor: colors.page, fontFamily: font, padding: "32px 12px" }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", backgroundColor: colors.card, border: `1px solid ${colors.line}`, borderRadius: "16px", padding: "28px" }}>
          <Text style={{ margin: 0, fontWeight: 800, fontSize: "15px", color: colors.ink, letterSpacing: ".02em" }}>cyrus.ai</Text>
          {children}
          <Hr style={{ borderColor: colors.line, margin: "24px 0 16px" }} />
          <Section>
            <Text style={{ margin: "0 0 8px", fontSize: "12px", lineHeight: "18px", color: colors.muted }}>{why}</Text>
            <Text style={{ margin: 0, fontSize: "12px", lineHeight: "18px", color: colors.muted }}>
              <Link href={links.preferencesUrl} style={{ color: colors.muted, textDecoration: "underline" }}>Change what you get</Link>
              {" | "}
              <Link href={links.unsubscribeUrl} style={{ color: colors.muted, textDecoration: "underline" }}>Unsubscribe from all email</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
