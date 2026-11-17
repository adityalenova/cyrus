"use client";
/* ══ KeyboardShortcutsModal.tsx — global hotkeys modal triggered by ? ═ */
import { useEffect, useState } from "react";

interface Shortcut {
  keys: string[];
  description: string;
  category: "Navigation" | "Search" | "Actions";
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["/"], description: "Focus search bar", category: "Search" },
  { keys: ["g", "p"], description: "Go to Programs", category: "Navigation" },
  { keys: ["g", "i"], description: "Go to Issues", category: "Navigation" },
  { keys: ["g", "o"], description: "Go to Organizations", category: "Navigation" },
  { keys: ["t"], description: "Cycle theme (light/dark)", category: "Actions" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "Actions" },
  { keys: ["Esc"], description: "Close modal / drawer", category: "Actions" },
];

export default function KeyboardShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard Shortcuts"
    >
      <div className="w-full max-w-md bg-card border border-line rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-line">
          <h2 className="text-lg font-bold text-ink">Keyboard Shortcuts</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-cocoa hover:text-ink text-sm font-semibold"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {SHORTCUTS.map((s, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-cocoa">{s.description}</span>
              <div className="flex gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-0.5 rounded bg-line/60 border border-line text-xs font-mono font-semibold text-ink shadow-xs"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="text-xs text-cocoa/60 text-center pt-2 border-t border-line">
          Press <kbd className="px-1.5 py-0.5 bg-line/40 rounded text-[11px]">Esc</kbd> to dismiss
        </div>
      </div>
    </div>
  );
}
