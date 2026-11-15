"use client"
/* ══ Palette.tsx — ⌘K search across repos + orgs ════════════ */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@/lib/router";
import { useStore } from "../lib/store";
import { REPOS } from "../data/repos";
import { ORGS } from "../data/orgs";
import { byStars, fmtCompact, CAT_META, avatarOf } from "../lib/util";
import { OrgImg } from "./ui";
import { SearchIcon } from "./Nav";

type Hit = { kind: "org"; id: string; title: string; sub: string; desc: string; stars: number; avatar: string }
  | { kind: "repo"; id: string; title: string; sub: string; desc: string; stars: number; avatar: string };

export default function Palette() {
  const { paletteOpen, setPaletteOpen } = useStore();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nav = useNavigate();

  const hits: Hit[] = useMemo(() => {
    if (!paletteOpen) return [];
    const s = q.trim().toLowerCase();
    const orgs: Hit[] = (s ? ORGS.filter((o) => (o.login + " " + o.name + " " + o.tagline + " " + o.tags.join(" ")).toLowerCase().includes(s)) : [])
      .slice(0, 3).map((o) => ({ kind: "org", id: o.login, title: o.name, sub: `Organization · ${o.repos} repos`, desc: o.tagline, stars: o.stars, avatar: avatarOf(o.login, 64) }));
    const repos: Hit[] = (s ? REPOS.filter((r) => (r.repo + " " + r.desc + " " + r.tags.join(" ") + " " + r.lang).toLowerCase().includes(s)) : REPOS.slice())
      .sort(byStars).slice(0, s ? 9 : 8)
      .map((r) => ({ kind: "repo", id: r.repo, title: r.repo.split("/")[1], sub: `${r.repo.split("/")[0]} · ${CAT_META[r.cat]?.label ?? r.cat}`, desc: r.desc, stars: r.stars, avatar: avatarOf(r.repo.split("/")[0], 64) }));
    return [...orgs, ...repos].slice(0, 12);
  }, [q, paletteOpen]);

  useEffect(() => { setSel(0); if (paletteOpen) { setQ(""); setTimeout(() => inputRef.current?.focus(), 30); } }, [paletteOpen]);

  if (!paletteOpen) return null;

  const open = (h: Hit) => { setPaletteOpen(false); nav(h.kind === "org" ? `/organizations/${encodeURIComponent(h.id)}` : `/repo/${encodeURIComponent(h.id)}`); };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 backdrop-blur-[8px] pt-[12vh] px-5" onClick={(e) => e.target === e.currentTarget && setPaletteOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="Search" className="reveal w-[min(640px,100%)] bg-card border border-line rounded-[20px] shadow-[0_50px_120px_-24px_rgba(36,27,19,.5)] overflow-hidden">
        <div className="flex items-center gap-3 px-[18px] py-4 border-b border-liness text-dim">
          <SearchIcon size={16} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
              if (e.key === "Enter" && hits[sel]) open(hits[sel]);
            }}
            placeholder="Search repos & orgs - try “mcp”, “skills”, “Google”"
            className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[16px] text-ink" autoComplete="off" spellCheck={false} />
          <kbd className="font-mono text-[10px] border border-line rounded-[5px] px-1.5 py-px text-dim bg-paper">esc</kbd>
        </div>
        <ul className="max-h-[52vh] overflow-y-auto p-2 list-none">
          {hits.map((h, i) => (
            <li key={h.kind + h.id}>
              <button onClick={() => open(h)} onMouseEnter={() => setSel(i)}
                className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl text-left cursor-pointer ${i === sel ? "bg-peach" : ""}`}>
                <span className="w-[34px] h-[34px] rounded-[10px] grid place-items-center overflow-hidden bg-white border border-line shrink-0">
                  <OrgImg src={h.avatar} name={h.id} className="w-[22px] h-[22px] object-contain" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="font-bold text-[13.5px] flex gap-2 items-baseline">{h.title}
                    <small className="text-dim font-medium text-[11px]">{h.sub}</small></span>
                  <span className="block text-[12px] text-cocoa truncate">{h.desc}</span>
                </span>
                <span className="font-mono text-[11.5px] font-bold text-honey shrink-0">★ {fmtCompact(h.stars)}</span>
              </button>
            </li>
          ))}
          {!hits.length && <li className="px-3 py-2.5 text-dim text-[13px]">No matches for “{q}”. Try “mcp”, “skills”, or “Google”.</li>}
        </ul>
        <p className="flex gap-2.5 items-center px-[18px] py-3 border-t border-liness text-[11.5px] text-dim">
          <kbd className="font-mono text-[10px] border border-line rounded-[5px] px-1.5 py-px bg-paper">↑↓</kbd> navigate · <kbd className="font-mono text-[10px] border border-line rounded-[5px] px-1.5 py-px bg-paper">enter</kbd> open page
        </p>
      </div>
    </div>
  );
}
