"use client"
/* ══ Footer.tsx — dark graphite footer ══════════════════════ */
import { Link } from "@/lib/router";
import { Logo, Brand } from "./ui";

/* One block per column. No program links and no about links here - the
   nav above already carries both, and the user asked for them out. */
const COLS: [string, [string, string][]][] = [
  ["Explore", [["Issue finder", "/issues"], ["Organizations", "/organizations"], ["Skills", "/skills"], ["Projects", "/projects"], ["Sponsors", "/sponsors"]]],
  ["Platform", [["Features", "/platform/features"], ["Trust centre", "/platform/trust"], ["How it works", "/platform/how"]]],
  ["Your space", [["Overview", "/dashboard"], ["My Issues", "/dashboard/issues"], ["My Repositories", "/dashboard/repos"], ["Settings", "/dashboard/settings"]]],
  ["Legal", [["Privacy policy", "/privacy"], ["Terms of service", "/terms"], ["Cookie policy", "/cookies"], ["Affiliations", "/affiliations"]]],
];

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
const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.96 6.82H1.6l7.73-8.84L1.25 2.25H8.1l4.71 6.23 5.43-6.23Zm-1.16 17.6h1.83L7.08 4.13H5.12l11.96 15.72Z" />
  </svg>
);
/* Discord's own mark - the padded game-controller silhouette the brand publishes,
   on the same 24 grid GitHub and X use here, so all five tiles sit at one
   optical weight. */
const DcIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.076 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);
/* Reddit's Snoo - the brand's own silhouette (antenna, ears, eyes, smile), not
   a hand-drawn stand-in. Kept as a single filled path on the same 512 grid the
   mark is published on, so at 15px it carries the same optical weight as the
   GitHub, LinkedIn and X marks beside it instead of a hairline outline. */
const RdIcon = () => (
  <svg width="15" height="15" viewBox="0 0 512 512" fill="currentColor" aria-hidden>
    <path d="M373 138.6c-25.2 0-46.3-17.5-51.9-41l0 0c-30.6 4.3-54.2 30.7-54.2 62.4l0 0.2c47.4 1.8 90.6 15.1 124.9 36.3c12.6-9.7 28.4-15.5 45.5-15.5c41.3 0 74.7 33.4 74.7 74.7c0 29.8-17.4 55.5-42.7 67.5c-2.4 86.8-97 156.6-213.2 156.6S45.5 410.1 43 323.4C17.6 311.5 0 285.7 0 255.7c0-41.3 33.4-74.7 74.7-74.7c17.2 0 33 5.8 45.7 15.6c34-21.1 76.8-34.4 123.7-36.4l0-0.3c0-44.3 33.7-80.9 76.8-85.5C325.8 50.2 347.2 32 373 32c29.4 0 53.3 23.9 53.3 53.3s-23.9 53.3-53.3 53.3zM157.5 255.3c-20.9 0-38.9 20.8-40.2 47.9s17.1 38.1 38 38.1s36.6-9.8 37.8-36.9s-14.7-49.1-35.7-49.1zM395 303.1c-1.2-27.1-19.2-47.9-40.2-47.9s-36.9 22-35.7 49.1c1.2 27.1 16.9 36.9 37.8 36.9s39.3-11 38-38.1zm-60.1 70.8c1.5-3.6-1-7.7-4.9-8.1c-23-2.3-47.9-3.6-73.8-3.6s-50.8 1.3-73.8 3.6c-3.9 0.4-6.4 4.5-4.9 8.1c12.9 30.8 43.3 52.4 78.7 52.4s65.8-21.6 78.7-52.4z" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="on-dark mt-[110px] bg-coffee text-steam">
      <div className="footer-arc" aria-hidden="true" />
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="grid grid-cols-[1.6fr_repeat(4,1fr)] max-[1020px]:grid-cols-2 gap-10 pt-16 pb-11">
          <div>
            <Link to="/" className="flex items-center gap-2.5 text-foam"><Logo size={34} /><Brand /></Link>
            <p className="text-[13.5px] leading-[1.7] mt-3.5 max-w-[300px]">
              Open-source programs, the issues that are actually open in them, and the repository context you need before you touch one.
            </p>
            {/* logo only, per the brief: the marks are the label */}
            <div className="flex items-center gap-2.5 mt-4">
              <a className="w-[32px] h-[32px] grid place-items-center rounded-[10px] border border-bean bg-bean/60 text-steam transition-colors duration-200 hover:text-foam hover:border-roast"
                href="https://github.com/adityalenova" target="_blank" rel="noopener" aria-label="cyrus.ai on GitHub">
                <GhIcon />
              </a>
              {/* The community server. This invite was regenerated with "Expire
                  after: Never" and no use limit, and it lands newcomers in
                  #rules, so the link below is safe to hard-code. */}
              <a className="w-[32px] h-[32px] grid place-items-center rounded-[10px] border border-bean bg-bean/60 text-steam transition-colors duration-200 hover:text-foam hover:border-roast"
                href="https://discord.gg/8S6z2Thczd" target="_blank" rel="noopener" aria-label="cyrus.ai community Discord server">
                <DcIcon />
              </a>
              <a className="w-[32px] h-[32px] grid place-items-center rounded-[10px] border border-bean bg-bean/60 text-steam transition-colors duration-200 hover:text-foam hover:border-roast"
                href="https://www.linkedin.com/in/iadityaoffl" target="_blank" rel="noopener" aria-label="cyrus.ai on LinkedIn">
                <InIcon />
              </a>
              <a className="w-[32px] h-[32px] grid place-items-center rounded-[10px] border border-bean bg-bean/60 text-steam transition-colors duration-200 hover:text-foam hover:border-roast"
                href="https://x.com/iaditya_offical" target="_blank" rel="noopener" aria-label="Aditya Duggirala on X">
                <XIcon />
              </a>
              <a className="w-[32px] h-[32px] grid place-items-center rounded-[10px] border border-bean bg-bean/60 text-steam transition-colors duration-200 hover:text-foam hover:border-roast"
                href="https://www.reddit.com/r/Cyrusagent/" target="_blank" rel="noopener" aria-label="The cyrus.ai community on Reddit">
                <RdIcon />
              </a>
            </div>
            {/* Product Hunt. The embed is asked for in its dark theme, because
                the light one arrives as a 250×54 white slab and a white slab
                is the loudest object in a graphite footer. The frame is a 1px
                grey hairline off --color-roast, the same grey the icon tiles
                above already reach for on hover, over a 2.5% white wash - the
                badge should look like it is sitting on the footer, not like
                it was stapled to it. Padding is 5px, which makes our 15px
                corner exactly concentric with the plate's own 10px one
                (10 + 5 = 15). Capped at 200px, and it shrinks again inside
                the two-column mobile footer instead of pushing it sideways. */}
            <a className="mt-3.5 inline-flex items-center rounded-[15px] border border-roast/80 bg-white/[0.025] p-[5px] leading-none transition-colors duration-200 hover:border-steam/40 hover:bg-white/[0.05]"
              href={"https://www.producthunt.com/products/cyrus-ai?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-cyrus-ai"}
              target="_blank" rel="noopener noreferrer">
              <img className="block h-auto w-[200px] max-w-full" width={250} height={54}
                alt="cyrus.ai - The developer-program platform | Product Hunt"
                src={"https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1299626&theme=dark&t=1793457900516"} />
            </a>
          </div>
          {COLS.map(([title, links]) => (
            <div key={title}>
              {/* an h2, not an h4: these four labels are the outline of the
                  footer, and a heading that jumps two levels below the last
                  one on the page is a ladder a screen-reader user cannot
                  climb. The class, not the tag, is what makes them small. */}
              <h2 className="text-[11px] uppercase tracking-[.12em] text-dimdk mb-4 font-mono font-medium">{title}</h2>
              <ul className="grid gap-2.5 list-none">
                {links.map(([l, to]) => <li key={l}><Link className="text-[13.5px] hover:text-white" to={to}>{l}</Link></li>)}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </footer>
  );
}
