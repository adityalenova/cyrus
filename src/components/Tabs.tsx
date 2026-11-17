"use client";
import { useState } from "react";

export interface TabItem { id: string; label: string; content: React.ReactNode; }

export default function Tabs({ tabs }: { tabs: TabItem[] }) {
  const [active, setActive] = useState(tabs[0]?.id || "");
  const current = tabs.find(t => t.id === active);
  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2 border-b border-line pb-1">
        {tabs.map(t => (
          <button key={t.id} role="tab" aria-selected={t.id === active} onClick={() => setActive(t.id)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-[5px] ${t.id === active ? "border-coffee text-coffee" : "border-transparent text-cocoa"}`}>
            {t.label}
          </button>
        ))}
      </div>
      {current && <div role="tabpanel">{current.content}</div>}
    </div>
  );
}
