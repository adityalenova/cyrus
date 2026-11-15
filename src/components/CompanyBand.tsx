"use client"
/* ══ CompanyBand.tsx — the companies band that sits just above the
   footer on every page: a dark coffee panel carrying the real org
   logos whose public GitHub data powers the index.

   The twelve names come from the directory itself, biggest first, so a logo
   here is never a link to a page that does not exist. The hand-picked list
   this replaces named Google, Microsoft, OpenAI, Anthropic, Vercel and others
   that no program's record mentions; those profiles are gone from the site and
   so are their tiles.                                            ══ */
import { Link } from "@/lib/router";
import { btn, OrgImg } from "./ui";
import { avatarOf } from "../lib/util";
import { ORGS } from "../data/orgs";

const COMPANIES = ORGS.slice(0, 12);

export default function CompanyBand() {
  return (
    <section aria-label="Companies behind the index" className="max-w-[1240px] mx-auto px-6 mt-[96px]">
      <div className="on-dark relative overflow-hidden rounded-[30px] bg-coffee border border-bean text-foam px-8 py-14 max-[700px]:px-5 text-center shadow-lift">
        <span aria-hidden className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,rgba(244,238,227,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(244,238,227,.05)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(820px_420px_at_50%_38%,#000_40%,transparent)]" />
        <span aria-hidden className="absolute inset-0 pointer-events-none bg-[radial-gradient(640px_300px_at_50%_-10%,rgba(255,255,255,.06),transparent_70%),radial-gradient(520px_280px_at_92%_110%,rgba(255,255,255,.045),transparent_70%)]" />
        <div className="relative">
          <span className="inline-flex items-center gap-2.5 font-mono text-[10.5px] font-bold tracking-[.18em] uppercase text-foam/90 bg-white/8 border border-white/15 rounded-full px-4 py-2">
            <span className="text-honey leading-none">✦</span>The companies behind the index
          </span>
          <h2 className="font-display font-extrabold text-white text-[clamp(26px,3.6vw,42px)] leading-[1.12] tracking-[-.025em] mt-6 max-w-[720px] mx-auto">
            The data comes from teams that <span className="text-ember">ship at scale.</span>
          </h2>
          <p className="text-steam mt-4 mx-auto max-w-[560px] text-[15px] leading-[1.65]">
            Every org profile, star count and program record on cyrus is pulled from the public
            GitHub footprint of organizations like these - then re-verified on a schedule.
          </p>
          <div className="grid grid-cols-6 max-[1020px]:grid-cols-4 max-[640px]:grid-cols-2 gap-3 mt-10 max-w-[920px] mx-auto">
            {COMPANIES.map((o) => (
              <Link key={o.login} to={`/organizations/${o.login}`}
                className="flex items-center gap-2.5 bg-cream border border-line rounded-[14px] px-3 py-3 min-w-0 text-left shadow-soft hover:-translate-y-0.5 hover:border-ember hover:shadow-lift transition-all">
                <OrgImg src={avatarOf(o.login, 64)} name={o.login} className="w-[26px] h-[26px] rounded-[8px] object-cover bg-sand shrink-0" />
                <span className="text-[12.5px] font-bold text-ink truncate">{o.name}</span>
              </Link>
            ))}
          </div>
          <div className="flex justify-center mt-10">
            <Link to="/organizations" className={btn("primary", "lg")}>Browse all organizations</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
