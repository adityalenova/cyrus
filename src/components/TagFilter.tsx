"use client";
/* ══ TagFilter.tsx — multi-select tag filter with badge counters ═════ */
import { useState } from "react";

export interface TagItem {
  id: string;
  name: string;
  count?: number;
}

interface TagFilterProps {
  tags: TagItem[];
  selectedTags: string[];
  onChange: (selected: string[]) => void;
  className?: string;
}

export default function TagFilter({
  tags,
  selectedTags,
  onChange,
  className = "",
}: TagFilterProps) {
  const [search, setSearch] = useState("");

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleTag = (id: string) => {
    if (selectedTags.includes(id)) {
      onChange(selectedTags.filter((t) => t !== id));
    } else {
      onChange([...selectedTags, id]);
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {tags.length > 8 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter tags..."
          className="w-full px-3 py-1.5 text-xs rounded-lg bg-card border border-line text-ink placeholder:text-cocoa/40 focus:outline-none focus:ring-1 focus:ring-coffee/40"
        />
      )}

      <div className="flex flex-wrap gap-1.5">
        {filteredTags.map((t) => {
          const isSelected = selectedTags.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => toggleTag(t.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                isSelected
                  ? "bg-coffee text-foam shadow-sm"
                  : "bg-card border border-line text-cocoa hover:text-ink hover:border-coffee/40"
              }`}
            >
              <span>{t.name}</span>
              {typeof t.count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? "bg-white/20 text-foam" : "bg-line/40 text-cocoa"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedTags.length > 0 && (
        <button
          onClick={() => onChange([])}
          className="text-xs text-cocoa hover:text-ink underline transition-colors"
        >
          Clear all tags ({selectedTags.length})
        </button>
      )}
    </div>
  );
}
