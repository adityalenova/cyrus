export default function CountBadge({ count }: { count: number }) {
  const str = count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count);
  return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-line/60 text-cocoa">{str}</span>;
}
