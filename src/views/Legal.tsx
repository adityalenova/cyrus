"use client"
/* ══ Legal.tsx — privacy, terms, cookies, affiliations ══════
   One honest article template; the four documents live in DOCS.
   Copy is written for what this site actually does: a catalog with a
   real sign-in server, and everything else still kept in localStorage.   */
import { Link } from "@/lib/router";
import type { ReactNode } from "react";

export type LegalKind = "privacy" | "terms" | "cookies" | "affiliations";

interface Sec { id: string; h: string; body: ReactNode }
interface Doc { title: string; kicker: string; updated: string; intro: string; secs: Sec[] }

const P = ({ children }: { children: ReactNode }) => (
  <p className="text-cocoa text-[14.5px] leading-[1.75]">{children}</p>
);
const UL = ({ items }: { items: ReactNode[] }) => (
  <ul className="grid gap-2 my-1">
    {items.map((it, i) => (
      <li key={i} className="flex gap-2.5 text-cocoa text-[14.5px] leading-[1.65]">
        <i className="w-[6px] h-[6px] rounded-full bg-accent shrink-0 mt-[9px]" aria-hidden />
        <span>{it}</span>
      </li>
    ))}
  </ul>
);
const C = ({ children }: { children: ReactNode }) => (
  <code className="font-mono text-[12.5px] bg-paper border border-line rounded-[6px] px-1.5 py-[2px] text-ink">{children}</code>
);

const DOCS: Record<LegalKind, Doc> = {
  privacy: {
    title: "Privacy policy",
    kicker: "What a sign-in touches, and what stays on your device",
    updated: "Last updated: 24 October 2026",
    intro:
      "cyrus.ai is a catalog you can browse with no account at all. Sign-in is the one part that involves our server: it checks your Google token or your emailed code and hands your browser a session cookie. Everything else - saves, theme, dashboard preferences, application drafts - lives only on your device, in your browser's local storage, and only you can read it.",
    secs: [
      {
        id: "what-we-store", h: "What is stored, and where",
        body: (<>
          <P>These items are written to your browser's <C>localStorage</C> under keys prefixed <C>agenthub.*</C>. They never leave your device and clearing your browser data removes them permanently:</P>
          <UL items={[
            <>Saved projects and organizations - the stars and follows you tap on cards.</>,
            <>A local copy of your signed-in display name and provider, so the dashboard can greet you and still work offline.</>,
            <>Preferences - light or dark theme and the dashboard notification toggles.</>,
            <>Application drafts and watchlists you build in the dashboard.</>,
          ]} />
          <P>On the server side, signing in stores one thing: a signed session cookie (<C>cyrus.session</C>, <C>httpOnly</C>, valid 30 days) holding your display name, your sign-in provider and an id derived from your account. It is not a profile, it is not readable without the server's signing secret, and signing out deletes it. If a database is attached to the deployment, an account row is also kept with the name, email, avatar and provider your provider sent us, so saves can follow you between devices; that is currently <b className="text-ink">not</b> attached, so nothing about you is kept in a database.</P>
        </>),
      },
      {
        id: "google-sign-in", h: "If you sign in with Google",
        body: (<>
          <P>Google sign-in is optional and uses the standard OAuth redirect. Google returns a token to the site; that token is sent to <C>/api/auth/google</C>, where the server checks with Google that it was really issued for this client before anything is stored. We receive your name, email address, profile-picture URL and Google account id - basic profile, nothing more. Those go into the session cookie and into the local session copy; a database row is only written when one is attached to the deployment. We never see your Google password, and we do not request access to any other Google data.</P>
          <P>Email sign-in is the same trade in the other direction: you type an address, the server keeps a one-way hash of the six-digit code it sends (through Resend, an email provider, for ten minutes with a capped number of tries) and, once you enter the code, issues the cookie above. The address itself is what identifies your account on that path; nothing else about your browsing is attached to it.</P>
        </>),
      },
      {
        id: "third-party-assets", h: "Third-party images and requests",
        body: (<>
          <P>Because this is a catalog of real open-source work, pages load some assets from third parties, which means your browser makes requests to them (your IP address is visible to them, as with any website visit):</P>
          <UL items={[
            <>GitHub - organization and repository avatars are fetched from GitHub's image CDN.</>,
            <>Google - <C>accounts.google.com</C> serves the consent page while you are signing in, and your profile picture is loaded from Google's image CDN afterwards.</>,
            <>Outbound links - program and repository cards link to organizers' and maintainers' own sites; their privacy practices are theirs, not ours.</>,
            <>Our own server - only the sign-in endpoints are called by name. Those requests go to the site's host (Vercel), which records ordinary request metadata such as an IP address in its platform logs; the catalog pages themselves are served without any per-visitor storage.</>,
          ]} />
        </>),
      },
      {
        id: "no-tracking", h: "What we do not do",
        body: (<>
          <P>No advertising networks, no analytics scripts, no heatmaps, no session recording, no email marketing list, and no sale or sharing of personal data. The only address that ever reaches us is the one you type into email sign-in, and the only use made of it is sending your code. Sign in with Google instead and no email address is stored by us at all beyond the claims in your session.</P>
        </>),
      },
      {
        id: "children", h: "Children",
        body: (<P>The site is a general developer resource and is not directed at children under 13. If you believe a child's data reached us through some unexpected path, contact us and we will remove it.</P>),
      },
      {
        id: "changes", h: "Changes to this policy",
        body: (<>
          <P>This page is rewritten and re-dated whenever the data flow changes, not after. Signing out clears the session cookie; if a database is ever attached, deleting your account will also delete its row - ask through the links at the bottom of this page or an issue on the project's GitHub, and the same route works today for anything that is already stored.</P>
        </>),
      },
    ],
  },
  terms: {
    title: "Terms of service",
    kicker: "The simple deal",
    updated: "Last updated: 3 October 2026",
    intro:
      "These terms cover your use of cyrus.ai and its content. Plain summary: the site is free to use, the catalog data belongs to its original sources under their own licenses, and we provide it as-is without warranties.",
    secs: [
      {
        id: "acceptance", h: "Accepting these terms",
        body: (<P>By browsing cyrus.ai you agree to these terms. If you do not agree, please stop using the site - no account or sign-in is required to view the catalog, so there is nothing to cancel.</P>),
      },
      {
        id: "the-catalog", h: "The catalog and its data",
        body: (<>
          <P>cyrus.ai lists public repositories, open-source program records and organization profiles assembled from public sources. Star counts, issue counts and metadata are GitHub API snapshots refreshed periodically, and each page states the date it was crawled; always check the upstream source for live numbers.</P>
          <UL items={[
            <>Every listed repository remains under its own open-source license. Listing here does not change those terms - read the license at the source before using the code.</>,
            <>Repository descriptions may be quoted from GitHub exactly as their authors wrote them.</>,
            <>Program listings are informational summaries; the organizer's official site is always authoritative for rules, eligibility and deadlines.</>,
            <>Program and organization names, logos and marks belong to their respective owners and are used for identification only (see the <Link to="/affiliations" className="text-accent font-semibold hover:underline">affiliations page</Link>).</>,
          ]} />
        </>),
      },
      {
        id: "acceptable-use", h: "Acceptable use",
        body: (<>
          <P>Use the site to discover and evaluate open-source work. You agree not to:</P>
          <UL items={[
            <>Scrape or bulk-redistribute the catalog in ways that misrepresent its source or date.</>,
            <>Use the sign-up forms to impersonate others or submit content you have no rights to.</>,
            <>Attempt to disrupt, reverse-engineer for rehosting, or abuse the site or its upstream services.</>,
          ]} />
        </>),
      },
      {
        id: "your-saves", h: "Your saves and session",
        body: (<P>Saved projects, followed organizations and preferences are stored only in your browser (see the <Link to="/privacy" className="text-accent font-semibold hover:underline">privacy policy</Link>). You can remove any of them with the controls on the dashboard; clearing browser data removes the rest. We cannot recover them for you, and you are responsible for the content of your local session.</P>),
      },
      {
        id: "no-warranty", h: "No warranty",
        body: (<P>The site and its data are provided "as is" and "as available", without warranties of any kind, express or implied, including accuracy of listings, fitness for a particular purpose, and uninterrupted availability. Catalog entries are curated snapshots, not verified endorsements of the software or events they describe.</P>),
      },
      {
        id: "liability", h: "Limitation of liability",
        body: (<P>To the maximum extent permitted by law, the people behind cyrus.ai are not liable for damages arising from use of the site or reliance on its listings - including anything you install, deploy, or plan a season around because of. Decisions about third-party code and events stay with you.</P>),
      },
      {
        id: "changes-terms", h: "Changes and governing law",
        body: (<P>We will update this page for material changes; the "last updated" date at the top is the effective version. Continued use after an update means acceptance. These terms are governed by the laws of India, with the courts of Hyderabad, Telangana having jurisdiction. Questions: raise them through the project's GitHub.</P>),
      },
    ],
  },
  cookies: {
    title: "Cookie policy",
    kicker: "One cookie, and only if you sign in",
    updated: "Last updated: 24 October 2026",
    intro:
      "cyrus.ai sets exactly one cookie, and only when you sign in: cyrus.session, the signed record that you are logged in. There are no analytics cookies, no advertising cookies, no consent banner - browsing the catalog drops nothing on your device.",
    secs: [
      {
        id: "local-storage", h: "What we use instead: localStorage",
        body: (<>
          <P>Apart from the session cookie, everything is persisted with the browser's <C>localStorage</C> API, under keys prefixed <C>agenthub.*</C>. The difference matters: those values are sent to no server automatically, cannot be read cross-domain, and are deleted the moment you clear site data.</P>
          <UL items={[
            <>Saved projects and followed organizations.</>,
            <>A local copy of your display name and sign-in provider, so the dashboard opens for you offline.</>,
            <>Theme and dashboard notification preferences.</>,
          ]} />
        </>),
      },
      {
        id: "third-party-storage", h: "Third-party storage",
        body: (<P>The Google redirect lets accounts.google.com use its own cookies and storage while you are on Google's page; that is governed by Google's privacy policy, not ours, and the only things we keep afterwards are your name, email, avatar URL and account id in the session we sign. Email sign-in loads nothing third-party unless a Cloudflare verification widget is configured on the deployment, and it is not configured today.</P>),
      },
      {
        id: "manage-data", h: "Managing or deleting your data",
        body: (<P>Everything local is one action away: open your browser's site settings for this domain and clear storage, or use the remove buttons on the dashboard for individual saves. The session cookie is one action away too - press sign out. Nothing else of yours sits on a server.</P>),
      },
      {
        id: "future", h: "If this ever changes",
        body: (<P>If a future version introduces a cookie that is not the session, or any tracking technology, this page is rewritten first and a real consent mechanism goes live with it. Today: one cookie, only on sign-in, nothing that follows you anywhere else.</P>),
      },
    ],
  },
  affiliations: {
    title: "Affiliations & endorsements",
    kicker: "Who we are - and who we are not",
    updated: "Last updated: 3 October 2026",
    intro:
      "cyrus.ai is an independent catalog built by a developer in Hyderabad. It lists many well-known companies, foundations and programs. This page makes the relationship - or the lack of one - completely clear.",
    secs: [
      {
        id: "independent", h: "We are independent",
        body: (<>
          <P>cyrus.ai is <b className="text-ink">not</b> owned, operated, sponsored, endorsed, or otherwise affiliated with any of the organizations, companies, or programs listed on the site, except where explicitly stated. Nothing here is official documentation from GitHub, Google, or any program organizer.</P>
        </>),
      },
      {
        id: "trademarks", h: "Names, logos and trademarks",
        body: (<>
          <P>Company and project names, logos and marks appear for identification and commentary only - the standard nominative use of a directory. All trademarks belong to their respective owners. Organization avatars are fetched from GitHub as public identifiers of those organizations.</P>
          <UL items={[
                        <>Repository and program listings quote names exactly as their owners publish them.</>,
          ]} />
        </>),
      },
      {
        id: "endorsement", h: "Listings are not endorsements",
        body: (<P>Inclusion means we found an entry interesting or popular in the open-source ecosystem - it is not a recommendation, a vetting, or a guarantee. A repository listed here may be unmaintained, and a program's terms may change after our snapshot. Always verify on the official source before you install code or apply to a season.</P>),
      },
      {
        id: "commercial", h: "No paid placements, no affiliate links",
        body: (<>
          <P>As of the date above:</P>
          <UL items={[
            <>No listing on cyrus.ai has been sold, sponsored, or paid for. Rankings are computed from public signals like GitHub stars.</>,
            <>There are no affiliate or referral links anywhere on the site. Outbound links go directly to the source.</>,
            <>If commercial placements are ever introduced, they will be visibly labelled and this page will say so before any such link goes live.</>,
          ]} />
        </>),
      },
      {
        id: "takedowns", h: "Are we describing your project wrong?",
        body: (<P>If you maintain a listed project, program or event and something here is inaccurate, out of date, or you would prefer not to appear in the catalog, contact us through the project's GitHub and we will fix or remove it. Accuracy beats coverage.</P>),
      },
    ],
  },
};

const W = "max-w-[1240px] mx-auto px-6";

export default function Legal({ kind }: { kind: LegalKind }) {
  const doc = DOCS[kind];
  return (
    <div className={W}>
      <article className="max-w-[820px] mx-auto pt-14 pb-8">
        <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim mb-4">Legal</p>
        <h1 className="font-display font-extrabold text-[clamp(30px,4.4vw,44px)] tracking-[-.02em] leading-[1.08]">
          {doc.title}.
        </h1>
        <p className="text-cocoa text-[16px] leading-[1.7] mt-4">
          <b className="text-ink font-semibold">{doc.kicker}</b> - {doc.intro}
        </p>
        <p className="font-mono text-[11px] text-dim mt-4">{doc.updated}</p>

        {/* contents rail */}
        <nav aria-label="Sections" className="mt-8 bg-card border border-line rounded-[18px] p-5 shadow-soft">
          <p className="font-mono text-[10px] tracking-[.14em] uppercase text-dim mb-3">In this document</p>
          <ol className="flex flex-wrap gap-x-5 gap-y-2 list-none m-0 p-0">
            {doc.secs.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-[13.5px] font-semibold text-cocoa hover:text-accent transition-colors">
                  <span className="font-mono text-[10.5px] text-dim mr-1.5">{String(i + 1).padStart(2, "0")}</span>{s.h}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.secs.map((s) => (
          <section key={s.id} id={s.id} className="mt-10 pt-9 border-t border-liness first-of-type:border-t-0 scroll-mt-24">
            <h2 className="panel-h-lg tracking-[-.02em] mb-4">{s.h}</h2>
            <div className="grid gap-4">{s.body}</div>
          </section>
        ))}

        <div className="mt-12 bg-card border border-line rounded-[20px] p-6 shadow-soft flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <h3 className="panel-h mb-1.5">Other documents</h3>
            <p className="text-cocoa text-[13.5px]">The full legal set for cyrus.ai, all written for what the site actually does.</p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {(Object.keys(DOCS) as LegalKind[]).filter((k) => k !== kind).map((k) => (
              <Link key={k} to={`/${k}`}
                className="inline-flex items-center gap-1.5 bg-paper border border-line rounded-full px-4 py-2 text-[13px] font-semibold text-ink hover:border-accent hover:-translate-y-px transition-all">
                {DOCS[k].title}<span aria-hidden className="text-dim"></span>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
