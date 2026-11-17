"use client";
/* ══ SearchBar.tsx — debounced search with keyboard navigation ══════ */
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounce } from "@/hooks/useDebounce";

interface SearchResult {
  title: string;
  type: "hackathon" | "program" | "organization" | "project";
  url: string;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  results?: SearchResult[];
  className?: string;
}

const TYPE_ICONS: Record<SearchResult["type"], string> = {
  hackathon: "🏆",
  program: "📋",
  organization: "🏢",
  project: "📦",
};

export default function SearchBar({
  placeholder = "Search hackathons, programs, organizations...",
  onSearch,
  results = [],
  className = "",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      onSearch?.(debouncedQuery);
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [debouncedQuery, onSearch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && results[activeIndex]) {
            window.location.href = results[activeIndex].url;
          }
          break;
        case "Escape":
          setIsOpen(false);
          setActiveIndex(-1);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, results, activeIndex]
  );

  // Store recent searches
  const saveRecentSearch = (q: string) => {
    const recent = JSON.parse(localStorage.getItem("cyrus-recent-searches") || "[]");
    const updated = [q, ...recent.filter((s: string) => s !== q)].slice(0, 5);
    localStorage.setItem("cyrus-recent-searches", JSON.stringify(updated));
  };

  return (
    <div className={`relative w-full max-w-xl ${className}`}>
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cocoa/50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card border border-line text-ink text-sm placeholder:text-cocoa/40 focus:outline-none focus:ring-2 focus:ring-coffee/30 transition-shadow"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="search-results"
          aria-activedescendant={activeIndex >= 0 ? `search-result-${activeIndex}` : undefined}
        />
      </div>

      {isOpen && results.length > 0 && (
        <ul
          ref={listRef}
          id="search-results"
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-card border border-line rounded-xl shadow-lg overflow-hidden"
        >
          {results.map((result, idx) => (
            <li
              key={`${result.type}-${result.title}`}
              id={`search-result-${idx}`}
              role="option"
              aria-selected={idx === activeIndex}
              className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition-colors ${
                idx === activeIndex ? "bg-coffee/10 text-coffee" : "text-ink hover:bg-card"
              }`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => {
                saveRecentSearch(query);
                window.location.href = result.url;
              }}
            >
              <span>{TYPE_ICONS[result.type]}</span>
              <div>
                <div className="font-medium">{result.title}</div>
                <div className="text-xs text-cocoa/60 capitalize">{result.type}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
