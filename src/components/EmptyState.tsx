export default function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl border border-dashed border-line bg-card/50 space-y-2">
      <div className="text-2xl">🔍</div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="text-xs text-cocoa max-w-sm">{description}</p>
    </div>
  );
}
