"use client";
import { useState } from "react";

export interface AccordionItemData { id: string; title: string; content: React.ReactNode; }

export default function Accordion({ items, allowMultiple = false }: { items: AccordionItemData[]; allowMultiple?: boolean }) {
  const [openIds, setOpenIds] = useState<string[]>([]);
  const toggle = (id: string) => {
    setOpenIds((prev) => allowMultiple ? (prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) : (prev.includes(id) ? [] : [id]));
  };
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-card overflow-hidden">
      {items.map((item) => (
        <div key={item.id}>
          <button onClick={() => toggle(item.id)} className="flex w-full items-center justify-between p-4 font-semibold text-ink hover:text-coffee">
            <span>{item.title}</span>
            <span className={`text-cocoa transition-transform ${openIds.includes(item.id) ? "rotate-180" : ""}`}>▼</span>
          </button>
          {openIds.includes(item.id) && <div className="px-4 pb-4 text-sm text-cocoa leading-relaxed">{item.content}</div>}
        </div>
      ))}
    </div>
  );
}
