export default function DifficultyBadge({ level, className = "" }: { level: string; className?: string }) {
  const isL3 = level.includes("3") || level.toLowerCase().includes("adv");
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${isL3 ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isL3 ? "bg-rose-500" : "bg-amber-500"}`} />
      <span>{level}</span>
    </span>
  );
}
