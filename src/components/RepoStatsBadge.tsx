export default function RepoStatsBadge({ stars = 0, forks = 0 }: { stars?: number; forks?: number }) {
  return (
    <div className="inline-flex items-center gap-3 px-3 py-1 rounded-xl border border-line bg-card text-xs text-cocoa">
      <span>★ {stars}</span>
      <span>⑂ {forks}</span>
    </div>
  );
}
