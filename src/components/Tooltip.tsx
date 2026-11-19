"use client";
import { useState, type ReactNode } from "react";

export default function Tooltip({ content, children }: { content: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      {children}
      {open && <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-stone-900 text-stone-100 text-xs rounded shadow-md whitespace-nowrap">{content}</div>}
    </div>
  );
}
