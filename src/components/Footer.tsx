"use client"
/* ══ Footer.tsx — dark coffee footer ════════════════════════ */
import { Link } from "@/lib/router";
import { Logo, Brand } from "./ui";
import { STATS, fmt, statsLine } from "@/lib/siteStats";

const YEAR = new Date().getFullYear();

const COLS: [string, [string, string][]][] = [
  ["Explore", [["Organizations", "/organizations"], ["Agent skills", "/projects"], ["Artifacts", "/tools"], ["Hackathons", "/hackathons"], ["Resources", "/resources"]]],
  ["Programs", [["Nexus Spring of Code", "/programs/nsoc"], ["Google Summer of Code", "/programs/gsoc"], ["Hacktoberfest", "/programs/oct"], ["Outreachy", "/programs/outreachy"], ["LFX Mentorship", "/programs/lfx"], ["All programs", "/opensource"]]],
  ["Platform", [["Features", "/platform/features"], ["Co-pilot", "/platform/nova"], ["Trust centre", "/platform/trust"], ["How it works", "/platform/how"]]],
  ["Your space", [["Dashboard", "/dashboard"], ["Saved projects", "/dashboard"], ["Activity", "/dashboard"]]],
  ["About", [["About us", "/about"], ["Data & methodology", "/about#data"], ["FAQ", "/about#faq"]]],
  ["Legal", [["Privacy policy", "/privacy"], ["Terms of service", "/terms"], ["Cookie policy", "/cookies"], ["Affiliations", "/affiliations"]]],
];

const HeartIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="#e0644a" aria-hidden className="inline-block align-[-2px]">
    <path d="M12 21c-4.8-3.6-9.3-7.5-9.3-12A5.2 5.2 0 0 1 12 6.1 5.2 5.2 0 0 1 21.3 9c0 4.5-4.5 8.4-9.3 12Z" />
  </svg>
);
const GhIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.575.106.785-.25.785-.556v-2.064c-3.2.7-3.876-1.36-3.876-1.36-.524-1.344-1.28-1.702-1.28-1.702-1.046-.717.08-.702.08-.702 1.155.08 1.763 1.19 1.763 1.19 1.03 1.76 2.7 1.25 3.354.956.104-.743.4-1.25.727-1.537-2.552-.29-5.236-1.28-5.236-5.68 0-1.255.447-2.28 1.185-3.084-.119-.29-.513-1.46.11-3.043 0 0 .966-.31 3.166 1.18a11 11 0 0 1 5.76 0c2.2-1.49 3.165-1.18 3.165-1.18.624 1.583.23 2.753.115 3.043.74.804 1.185 1.83 1.185 3.084 0 4.41-2.69 5.386-5.253 5.67.414.357.782 1.06.782 2.14v3.17c0 .31.2.67.79.557A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
  </svg>
);
const InIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.7h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.5c0-1.31-.02-3-1.83-3-1.83 0-2.11 1.43-2.11 2.9V21h-4V9Z" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="mt-[110px] bg-coffee text-steam">
      <div className="footer-arc" aria-hidden="true" />
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="grid grid-cols-[1.4fr_repeat(6,1fr)] max-[1020px]:grid-cols-2 gap-10 pt-16 pb-11">
          <div>
            <Link to="/" className="flex items-center gap-2.5 text-foam"><Logo /><Brand /></Link>
            <p className="text-[13.5px] leading-[1.7] mt-3.5 max-w-[300px]">
              The catalog of open-source programs, company hackathons and the skills, rules, configs and MCP servers that power AI coding agents - with a prep plan for every deadline.
            </p>
            <p className="font-mono text-[11px] leading-[1.7] mt-3.5 max-w-[300px] text-dimdk">
              {statsLine()} · {fmt(STATS.orgs)} organization profiles · {STATS.programs} tracked programs
            </p>
          </div>
          {COLS.map(([title, links]) => (
            <div key={title}>
              <h4 className="text-[11px] uppercase tracking-[.12em] text-dimdk mb-4 font-mono font-medium">{title}</h4>
              <ul className="grid gap-2.5 list-none">
                {links.map(([l, to]) => <li key={l}><Link className="text-[13.5px] hover:text-white" to={to}>{l}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-bean py-5.5 flex justify-between items-center gap-3 flex-wrap text-dimdk text-[12.5px]">
          <span className="flex items-center gap-1.5">Made with <HeartIcon /> by <b className="text-steam font-semibold">Aditya</b> · © {YEAR} cyrus.ai</span>
          <div className="flex items-center gap-4">
            <a className="text-steam hover:text-white flex items-center gap-1.5" href="https://github.com/adityalenova" target="_blank" rel="noopener"><GhIcon /> GitHub</a>
            <a className="text-steam hover:text-white flex items-center gap-1.5" href="https://www.linkedin.com/in/iadityaoffl" target="_blank" rel="noopener"><InIcon /> LinkedIn</a>
            <a className="text-steam hover:text-white" href="https://github.com" target="_blank" rel="noopener">Powered by open source</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
