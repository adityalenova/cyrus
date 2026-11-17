/* ══ LanguageBar.tsx — GitHub-style repository language breakdown bar ═ */
export interface LanguageItem {
  name: string;
  percentage: number;
  color: string;
}

interface LanguageBarProps {
  languages: LanguageItem[];
  className?: string;
}

export default function LanguageBar({ languages, className = "" }: LanguageBarProps) {
  if (!languages || languages.length === 0) return null;

  return (
    <div className={`space-y-2.5 ${className}`}>
      {/* Horizontal Stacked Bar */}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-line/40">
        {languages.map((lang) => (
          <div
            key={lang.name}
            style={{ width: `${lang.percentage}%`, backgroundColor: lang.color }}
            title={`${lang.name}: ${lang.percentage}%`}
          />
        ))}
      </div>

      {/* Legend Dots */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-cocoa">
        {languages.map((lang) => (
          <div key={lang.name} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: lang.color }}
            />
            <span className="font-medium text-ink">{lang.name}</span>
            <span className="text-cocoa/60">{lang.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
