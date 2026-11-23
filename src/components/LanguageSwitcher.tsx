"use client";
/* ══ LanguageSwitcher.tsx — pick the site language from the header ══════
   A button that opens a short list of languages, each in its own name. Picking
   one goes to the same page in that language (query and hash kept) and the
   proxy stores the choice in a cookie, so the next visit opens in it. ══ */
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LOCALES, LOCALE_NAME, type Locale } from "@/i18n/locales";
import { usePathname, useRouter } from "@/i18n/navigation";

export default function LanguageSwitcher({ inline = false }: { inline?: boolean }) {
  const t = useTranslations("language");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("click", close);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("click", close); document.removeEventListener("keydown", key); };
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    if (next === locale) return;
    const { search, hash } = window.location;
    router.replace(`${pathname}${search}${hash}`, { locale: next });
  };

  /* inside the phone menu there is room for every language at once */
  if (inline) {
    return (
      <div role="group" aria-label={t("label")} className="flex flex-wrap gap-1.5">
        {LOCALES.map((l) => (
          <button key={l} type="button" lang={l} aria-pressed={l === locale} onClick={() => choose(l)}
            className={`px-3 py-1.5 rounded-full border text-[12.5px] font-semibold cursor-pointer transition-colors ${l === locale ? "bg-coffee text-foam border-coffee" : "border-line text-cocoa hover:bg-card"}`}>
            {LOCALE_NAME[l]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative" ref={box}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={t("label")} title={t("label")}
        onClick={() => setOpen((v) => !v)}
        className="h-[36px] px-2.5 rounded-full border border-line bg-card/60 text-ink text-[12px] font-semibold uppercase tracking-wide flex items-center gap-1.5 cursor-pointer hover:bg-peach transition-colors shrink-0">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
        </svg>
        <span>{locale}</span>
      </button>
      {open && (
        <ul role="listbox" aria-label={t("label")}
          className="absolute right-0 top-[42px] min-w-[170px] bg-card border border-line rounded-[16px] shadow-lift p-1.5 z-[75]">
          {LOCALES.map((l) => (
            <li key={l} role="option" aria-selected={l === locale}>
              <button type="button" lang={l} onClick={() => choose(l)}
                className={`w-full text-left px-3 py-2 rounded-[10px] text-[13.5px] cursor-pointer hover:bg-peach ${l === locale ? "font-bold text-rust" : "font-medium text-cocoa"}`}>
                {LOCALE_NAME[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
