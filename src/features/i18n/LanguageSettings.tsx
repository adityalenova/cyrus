"use client"
/* ══ LanguageSettings.tsx — the one fully translated surface ════════════
   Issue #188. Every visible string on this screen comes from the catalog
   in src/features/i18n/messages.ts, which is what makes the claim on the
   page ("this page is fully translated") true. Code tokens - the lang tag,
   the direction, the storage key - stay untranslated on purpose: they are
   identifiers, not prose.                                              ═ */
import { useState } from "react";
import { Card } from "@/lib/dash/shell";
import { btn } from "@/components/ui";
import { I18nProvider, useI18n } from "./provider";
import {
  DEFAULT_LOCALE, LOCALE_IDS, LOCALES, dirOf, htmlLang,
  type Locale,
} from "./model";

const W = "max-w-[1240px] mx-auto px-6";

function LanguagePanel() {
  const { locale, setLocale, reset, tr } = useI18n();
  const [notice, setNotice] = useState<"saved" | "reset" | null>(null);
  const active = LOCALES[locale];

  const choose = (id: Locale) => {
    setLocale(id);
    setNotice("saved");
  };
  const backToEnglish = () => {
    reset();
    setNotice("reset");
  };

  return (
    <div className={`${W} pt-14 pb-16`}>
      <p className="eyebrow mb-4">{tr("page.eyebrow")}</p>
      <h1 className="font-display font-extrabold tracking-[-.03em] text-[clamp(30px,4.4vw,50px)] leading-[1.06]">
        {tr("page.title")}
      </h1>
      <p className="text-cocoa text-[15.5px] leading-[1.65] mt-3 max-w-[620px]">{tr("page.lede")}</p>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] gap-6 mt-9 items-start">
        <Card className="reveal" style={{ animationDelay: "40ms" }}>
          <div className="flex items-baseline gap-3 flex-wrap mb-1">
            <h2 className="panel-h-lg" id="language-label">{tr("switcher.label")}</h2>
            <p className="ml-auto font-mono text-[10.5px] uppercase tracking-[.13em] text-dim">
              <code>lang=&quot;{htmlLang(locale)}&quot;</code>{" · "}
              <code>dir=&quot;{dirOf(locale)}&quot;</code>
            </p>
          </div>
          <p className="card-desc mb-4">{tr("switcher.hint")}</p>

          <div role="group" aria-labelledby="language-label" className="grid gap-2 sm:grid-cols-2">
            {LOCALE_IDS.map((id) => {
              const on = id === locale;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => choose(id)}
                  aria-pressed={on}
                  className={`flex items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left transition-colors cursor-pointer ${
                    on ? "border-accent bg-peach text-ink" : "border-line bg-cream text-cocoa hover:text-ink hover:border-accent/60"
                  }`}
                >
                  <span className="min-w-0">
                    <span lang={LOCALES[id].tag} className="block font-display font-bold text-[15px] tracking-[-.01em]">
                      {LOCALES[id].native}
                    </span>
                    <span lang="en" className="block text-[12px] text-dim">{LOCALES[id].english}</span>
                  </span>
                  <span aria-hidden className={`ml-auto font-mono text-[12px] ${on ? "text-accent" : "text-rule"}`}>
                    {on ? "●" : "○"}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-wrap mt-4 pt-4 border-t border-dashed border-line">
            <button type="button" className={btn("outline", "sm")} onClick={backToEnglish} disabled={locale === DEFAULT_LOCALE}>
              {tr("actions.reset")}
            </button>
            <p className="font-mono text-[10px] uppercase tracking-[.13em] text-dim">
              {tr("a11y.current", { locale: `${active.native} (${active.english})` })}
            </p>
          </div>

          {notice && (
            <p role="status" aria-live="polite" className="mt-3 font-mono text-[11px] text-accent">
              {notice === "saved"
                ? tr("status.saved", { locale: `${active.native} (${active.english})` })
                : tr("status.reset")}
            </p>
          )}
        </Card>

        <aside className="grid gap-6">
          <Card className="reveal" style={{ animationDelay: "120ms" }}>
            <p className="font-mono text-[10.5px] uppercase tracking-[.14em] text-dim mb-2">{tr("preview.label")}</p>
            <p className="font-display font-bold text-[18px] tracking-[-.012em] leading-snug">
              {tr("preview.greeting", { name: "Sam" })}
            </p>
            <p className="text-cocoa text-[13.5px] mt-1.5 leading-[1.6]">
              {tr("preview.summary", { count: 12, repos: 34 })}
            </p>
            <p className="card-desc mt-3 pt-3 border-t border-dashed border-line">
              {tr("preview.note", { locale: `${active.native} (${active.english})` })}
            </p>
          </Card>

          <Card className="reveal" style={{ animationDelay: "200ms" }}>
            <h2 className="panel-h-lg mb-1.5">{tr("scope.title")}</h2>
            <p className="card-desc">{tr("scope.body")}</p>
          </Card>

          <Card className="reveal" style={{ animationDelay: "260ms" }}>
            <h2 className="panel-h-lg mb-1.5">{tr("storage.title")}</h2>
            <p className="card-desc">{tr("storage.body")}</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}

export default function LanguageSettings() {
  return (
    <I18nProvider>
      <LanguagePanel />
    </I18nProvider>
  );
}
