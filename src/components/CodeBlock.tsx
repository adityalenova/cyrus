"use client";
import { useState } from "react";

export default function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-xl border border-line bg-card overflow-hidden font-mono text-xs">
      <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-line/20 text-cocoa/70">
        <span className="uppercase">{language}</span>
        <button onClick={handleCopy} className="text-cocoa hover:text-ink font-semibold">{copied ? "Copied! ✓" : "Copy"}</button>
      </div>
      <pre className="p-4 overflow-x-auto text-ink leading-relaxed"><code>{code}</code></pre>
    </div>
  );
}
