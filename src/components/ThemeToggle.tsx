"use client";
/* ══ ThemeToggle.tsx — system-aware dark mode toggle ═══════════════════ */
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.setAttribute("data-theme", resolved);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("cyrus-theme") as Theme | null;
    const initial = stored || "system";
    setTheme(initial);
    applyTheme(initial);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if ((localStorage.getItem("cyrus-theme") || "system") === "system") {
        applyTheme("system");
      }
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const cycle = () => {
    const order: Theme[] = ["light", "dark", "system"];
    const next = order[(order.indexOf(theme) + 1) % order.length];
    setTheme(next);
    localStorage.setItem("cyrus-theme", next);
    applyTheme(next);
  };

  if (!mounted) return <div className="w-8 h-8" />;

  const icons: Record<Theme, string> = { light: "☀️", dark: "🌙", system: "💻" };

  return (
    <button
      onClick={cycle}
      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-card transition-colors"
      aria-label={`Current theme: ${theme}. Click to change.`}
      title={`Theme: ${theme}`}
    >
      <span className="text-sm">{icons[theme]}</span>
    </button>
  );
}
