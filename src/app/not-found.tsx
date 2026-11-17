import Link from "next/link";

/* ══ not-found.tsx — custom warm 404 with helpful navigational cues ══ */
export default function NotFound() {
  const suggestions = [
    { label: "Programs Catalog", href: "/programs", desc: "Browse 13 open source programs & archives" },
    { label: "Issue Finder", href: "/issues", desc: "Filter 40k+ open issues ready for PRs" },
    { label: "Organizations", href: "/organizations", desc: "360+ verified open source organizations" },
    { label: "AI Agent Skills", href: "/skills", desc: "Directory of AI tools, MCPs, and AGENTS.md" },
  ];

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-xl text-center space-y-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-honey/10 text-honey text-xs font-semibold uppercase tracking-wider">
          404 · Page Not Found
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight font-display">
          Looks like this route went off course.
        </h1>

        <p className="text-cocoa text-base leading-relaxed">
          The page or contribution artifact you requested doesn&apos;t exist or has moved. Here are a few places to get back on track:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {suggestions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="p-4 rounded-xl border border-line bg-card hover:border-coffee/40 transition-colors group"
            >
              <div className="font-semibold text-ink text-sm group-hover:text-coffee transition-colors">
                {item.label} →
              </div>
              <div className="text-xs text-cocoa/70 mt-1">{item.desc}</div>
            </Link>
          ))}
        </div>

        <div className="pt-4 flex justify-center gap-4">
          <Link
            href="/"
            className="px-6 py-2.5 rounded-full bg-coffee text-foam font-semibold text-sm hover:opacity-95 transition-opacity"
          >
            Back to Home
          </Link>
          <Link
            href="/issues"
            className="px-6 py-2.5 rounded-full border border-line bg-card text-ink font-semibold text-sm hover:bg-line/20 transition-colors"
          >
            Explore Issues
          </Link>
        </div>
      </div>
    </div>
  );
}
