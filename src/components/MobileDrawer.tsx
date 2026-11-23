"use client";
/* ══ MobileDrawer.tsx — accessible mobile navigation drawer ═════════ */
import { useEffect, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";

interface NavItem {
  href: string;
  label: string;
  icon?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/programs", label: "Programs" },
  { href: "/organizations", label: "Organizations" },
  { href: "/projects", label: "Projects" },
  { href: "/issues", label: "Issues" },
  { href: "/skills", label: "Skills" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/about", label: "About" },
];

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MobileDrawer({ isOpen, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mobile Navigation">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        className="fixed top-0 right-0 h-full w-[280px] bg-card border-l border-line p-6 flex flex-col justify-between shadow-2xl z-10"
      >
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-line">
            <span className="font-display font-bold text-lg text-ink">Navigation</span>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-cocoa hover:text-ink hover:bg-line/40 transition-colors"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          <nav className="flex flex-col space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                    active ? "bg-coffee text-foam" : "text-cocoa hover:bg-line/30 hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-line text-xs text-cocoa/60 text-center">
          cyrus.ai · Open Source Programs Platform
        </div>
      </div>
    </div>
  );
}
