"use client"
/* ══ Onboarding.tsx — five steps from a stranger to a shortlist ═══════
   The wizard is a shortcut to /projects, not a sign-up wall: every step can
   be skipped, the URL carries the whole draft so Back and a pasted link both
   land in the same place, and the only thing written to this browser is the
   profile someone chose to save at the end.

   Nothing here guesses at data it does not have. The language and domain
   pickers are built from the project archive itself, so an option is only
   offered when picking it returns something, and the count next to each chip
   is the archive's own, not a marketing number.                      ═ */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link, useSearchParams } from "@/lib/router";
import { PROGRAMS } from "@/data/orgs";
import { useProjectArchives } from "@/lib/programProjects";
import { useStored, fmtCompact } from "@/lib/util";
import { useStore } from "@/lib/store";
import { providerReady } from "@/lib/api";
import { btn, Chip, OrgImg, Word } from "@/components/ui";
import {
  LAST_STEP, STEPS, advance, back, canAdvance, coverage, domainOptions,
  draftFromParams, draftToParams, goTo, isReadyToSave, jump, missingFor, percent,
  recommend, techOptions, toggle,
} from "@/lib/onboarding";
import type { Draft, Option } from "@/lib/onboarding";

const W = "max-w-[1240px] mx-auto px-6";
const fin = "w-full bg-paper border border-line rounded-xl px-3.5 py-2.5 text-[14px] outline-none transition-all focus:border-accent focus:shadow-[0_0_0_3px_rgba(34,197,94,.12)]";
const lbl = "block font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-2.5";

/* a selectable chip: the same shape the filter rails use, but a button that
   says what it is for the screen reader as well as the eye */
function Pill({ opt, on, onClick, note }: { opt: Option; on: boolean; onClick: () => void; note?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      data-pill={opt.id}
      className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-all ${
        on
          ? "border-accent bg-accent text-accentfg"
          : "border-line bg-card text-cocoa hover:border-accent hover:text-ink"
      }`}
    >
      {opt.id}
      {typeof opt.count === "number" && opt.count > 0 && (
        <span className={`font-mono text-[10.5px] ${on ? "text-accentfg/70" : "text-dim"}`}>{fmtCompact(opt.count)}</span>
      )}
      {note && <span className="font-mono text-[10px] uppercase tracking-[.1em] opacity-70">{note}</span>}
    </button>
  );
}

function Group({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="border-0 p-0 m-0">
      <legend className={lbl}>{legend}</legend>
      {hint && <p className="card-desc -mt-1 mb-3">{hint}</p>}
      {children}
    </fieldset>
  );
}

export default function Onboarding() {
  const [params, setParams] = useSearchParams();
  const draft = useMemo(() => draftFromParams(params), [params]);
  const write = (next: Draft) => setParams(draftToParams(next));

  const { ready, rows } = useProjectArchives(PROGRAMS);
  const { user, serverUser, toast, setAuthOpen } = useStore();
  const reduce = useReducedMotion();

  /* the saved profile, kept apart from the working draft so that editing a
     pick never rewrites what someone already chose to keep */
  const [saved, setSaved, savedReady] = useStored<Draft | null>("agenthub.onboarding", null);
  const [githubOn, setGithubOn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    providerReady("github").then((ok) => { if (live) setGithubOn(ok); });
    return () => { live = false; };
  }, []);

  const techs = useMemo(() => techOptions(rows, 18), [rows]);
  const domains = useMemo(() => domainOptions(rows), [rows]);
  const picks = useMemo(() => recommend(rows, draft, 12), [rows, draft]);
  const reach = useMemo(() => coverage(rows, draft), [rows, draft]);

  const step = draft.step;
  const current = STEPS[step];
  const blockers = missingFor(step, draft);
  const open = step === 0 && !draft.name && !draft.techs.length && !draft.sectors.length && !draft.programs.length;
  const connected = serverUser?.provider === "github";

  const motionProps = reduce
    ? {}
    : { initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 }, transition: { duration: 0.22, ease: "easeOut" as const } };

  const fillFromAccount = () =>
    write({ ...draft, name: user?.name ?? serverUser?.name ?? "", avatar: user?.picture ?? serverUser?.picture ?? "" });

  const save = () => {
    setSaved({ ...draft, step: 0 });
    try {
      localStorage.setItem("cyrus.onboarding.completed", "true");
    } catch {}
    toast(`Profile saved for ${draft.name.trim()} - ${reach} projects within reach.`);
    write(goTo(draft, LAST_STEP));
  };

  return (
    <div className={`${W} pt-14 pb-4`}>
      <p className="font-mono text-[10.5px] tracking-[.14em] uppercase text-dim">
        <Link to="/" className="hover:text-accent">Platform</Link> <span className="text-accent">›</span>{" "}
        <span className="text-cocoa">Onboarding</span>
      </p>
      <h1 className="font-display font-extrabold tracking-[-.02em] leading-[1.08] mt-3.5 mb-3 text-[clamp(33px,4.2vw,52px)]">
        Set up <Word>your board</Word>
      </h1>
      <p className="text-ink font-medium max-w-[720px] text-[16.5px] leading-[1.6]">
        Five short steps: who you are, what you build, which programs you are aiming at, and what the
        archive has for you. Every step can be skipped, and the address bar is the only thing remembering you.
      </p>

      {savedReady && saved && saved.name && (
        <div className="mt-6 flex flex-wrap items-center gap-3 bg-clay border border-line rounded-[18px] px-5 py-3.5">
          <p className="text-cocoa text-[13.5px] flex-1 min-w-[240px]">
            A saved profile is already in this browser: <span className="text-ink font-semibold">{saved.name}</span>,{" "}
            {saved.techs.length} languages, {saved.sectors.length} domains, {saved.programs.length} programs.
          </p>
          <button className={btn("outline", "sm")} onClick={() => write({ ...saved, step })}>Load it</button>
        </div>
      )}

      {/* progress: the bar says how far, the row says where */}
      <div className="mt-8">
        <div className="flex items-center justify-between gap-4 mb-3">
          <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim">
            Step {step + 1} of {STEPS.length} · {current.label}
          </p>
          <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-accent">{percent(step)}%</p>
        </div>
        <div className="h-1.5 rounded-full bg-clay overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${percent(step)}%` }}
          />
        </div>
        <ol className="flex flex-wrap gap-2 mt-3.5 list-none p-0 m-0">
          {STEPS.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => write(jump(draft, i))}
                aria-current={i === step ? "step" : undefined}
                className={`px-3 py-1.5 rounded-full text-[12.5px] font-medium border transition-all ${
                  i === step
                    ? "border-accent text-accent bg-peach"
                    : i < step
                      ? "border-line text-ink bg-card hover:border-accent"
                      : "border-transparent text-dim hover:text-cocoa"
                }`}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      {/* the card that holds one step */}
      <div className="mt-7 bg-card border border-line rounded-[22px] shadow-soft px-8 py-7 max-[700px]:px-5 min-h-[320px]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={step} {...motionProps}>
            <p className="card-desc mb-6">{current.hint}</p>

            {step === 0 && (
              <div className="grid gap-5">
                <div className="grid md:grid-cols-2 gap-5">
                  <div>
                    <label className={lbl} htmlFor="ob-name">Your name</label>
                    <input id="ob-name" className={fin} value={draft.name} placeholder="Ada Lovelace"
                      onChange={(e) => write({ ...draft, name: e.target.value })} />
                  </div>
                  <div>
                    <label className={lbl} htmlFor="ob-avatar">Avatar URL</label>
                    <input id="ob-avatar" className={fin} value={draft.avatar} placeholder="https://…/me.png"
                      onChange={(e) => write({ ...draft, avatar: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className={lbl} htmlFor="ob-bio">What you want to work on</label>
                  <textarea id="ob-bio" rows={3} className={`${fin} resize-y`} value={draft.bio}
                    placeholder="Compilers, developer tooling, anything with a good test suite."
                    onChange={(e) => write({ ...draft, bio: e.target.value })} />
                </div>
                {(user || serverUser) && (
                  <button className={btn("ghost", "sm") + " justify-self-start"} onClick={fillFromAccount}>
                    Use my {serverUser?.provider ?? user?.provider} account details
                  </button>
                )}
              </div>
            )}

            {step === 1 && (
              !ready ? <p className="card-desc">Reading the project archive…</p> : (
                <div className="grid gap-7">
                  <Group legend="Languages & frameworks" hint="Spelled the way the archive spells them, ranked by how many projects use them.">
                    <div className="flex flex-wrap gap-2">
                      {techs.map((o) => (
                        <Pill key={o.id} opt={o} on={draft.techs.includes(o.id)}
                          onClick={() => write({ ...draft, techs: toggle(draft.techs, o.id) })} />
                      ))}
                    </div>
                  </Group>
                  <Group legend="Domains" hint="Only the areas this archive can actually fill are listed.">
                    <div className="flex flex-wrap gap-2">
                      {domains.map((o) => (
                        <Pill key={o.id} opt={o} on={draft.sectors.includes(o.id)}
                          onClick={() => write({ ...draft, sectors: toggle(draft.sectors, o.id) })} />
                      ))}
                    </div>
                  </Group>
                </div>
              )
            )}

            {step === 2 && (
              <Group legend="Programs you are aiming at" hint="Optional - skip it to keep every program in the results.">
                <div className="flex flex-wrap gap-2">
                  {PROGRAMS.map((p) => (
                    <Pill key={p.id} opt={{ id: p.name, count: 0 }} on={draft.programs.includes(p.id)}
                      note={draft.programs.includes(p.id) ? "on" : undefined}
                      onClick={() => write({ ...draft, programs: toggle(draft.programs, p.id) })} />
                  ))}
                </div>
                <p className="card-desc mt-4">
                  {draft.programs.length
                    ? `${draft.programs.length} selected. Matching is by the program a project was accepted under.`
                    : "Nothing selected yet - the shortlist below will search every archived program."}
                </p>
              </Group>
            )}

            {step === 3 && (
              !ready ? <p className="card-desc">Reading the project archive…</p>
                : open || !draft.techs.length && !draft.sectors.length && !draft.programs.length ? (
                  <div className="text-center py-10">
                    <p className="card-title-xl mb-2">Nothing to rank yet</p>
                    <p className="card-desc max-w-[420px] mx-auto">
                      Pick at least one language, domain or program and the archive gets filtered down here.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-4" aria-live="polite">
                      {fmtCompact(reach)} archived projects within reach · showing {picks.length}
                    </p>
                    <ul data-picks className="grid md:grid-cols-2 gap-3.5 list-none p-0 m-0">
                      {picks.map((m) => (
                        <li key={m.row.key} data-card className="border border-line rounded-[16px] p-4 bg-paper">
                          <div className="flex items-start gap-3">
                            <OrgImg src={m.row.orgUrl} name={m.row.org} className="w-9 h-9 rounded-lg shrink-0" />
                            <div className="min-w-0">
                              <p className="card-title truncate">{m.row.title}</p>
                              <p className="text-cocoa text-[12.5px] truncate">{m.row.org} · {m.row.year || "undated"}</p>
                            </div>
                            <span className="ml-auto font-mono text-[11px] text-accent shrink-0">{m.score}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            <Chip tone="cat">{m.row.program}</Chip>
                            {m.row.lang && <Chip tone="lang">{m.row.lang}</Chip>}
                            {m.row.stars > 0 && <Chip tone="stars">★ {fmtCompact(m.row.stars)}</Chip>}
                            {m.reasons.slice(0, 3).map((r) => <Chip key={r} tone="green">{r}</Chip>)}
                          </div>
                          <a href={m.row.url} target="_blank" rel="noreferrer" className={btn("outline", "sm") + " mt-3.5"}>
                            Open repository
                          </a>
                        </li>
                      ))}
                    </ul>
                    <p className="card-desc mt-5">
                      The shortlist is a read of the archive as it was published.{" "}
                      <Link to="/projects" className="text-accent hover:underline">Browse all projects</Link>{" "}
                      when you want the filters.
                    </p>
                  </div>
                )
            )}

            {step === 4 && (
              <div className="grid gap-6">
                <div className="bg-clay border border-line rounded-[18px] px-5 py-4">
                  <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-2">GitHub</p>
                  {connected ? (
                    <p className="text-ink text-[14px]">
                      Connected as <span className="font-semibold">@{serverUser?.login ?? serverUser?.name}</span>.
                      Your saved repositories sync across devices.
                    </p>
                  ) : (
                    <>
                      <p className="card-desc mb-3">
                        {githubOn === false
                          ? "This deployment has no GitHub app configured, so connecting is unavailable. Everything else in this wizard still works, and your profile stays in this browser."
                          : "Connecting is optional. It syncs the projects you follow across devices instead of keeping them in one browser."}
                      </p>
                      <button className={btn("dark", "md")} onClick={() => setAuthOpen(true)} disabled={githubOn === false}>
                        {githubOn === false ? "GitHub sign-in unavailable" : "Connect GitHub"}
                      </button>
                    </>
                  )}
                </div>

                <div>
                  <p className="font-mono text-[10.5px] tracking-[.12em] uppercase text-dim mb-2">Your profile</p>
                  <p className="text-ink text-[15px] leading-[1.7]">
                    {draft.name.trim() || "Unnamed"} · {draft.techs.length
                      ? `${draft.techs.length} ${draft.techs.length === 1 ? "language" : "languages"}` : "no languages"}
                    {draft.sectors.length ? ` · ${draft.sectors.length} ${draft.sectors.length === 1 ? "domain" : "domains"}` : ""}
                    {draft.programs.length ? ` · ${draft.programs.length} programs` : ""}
                    {` · ${fmtCompact(reach)} matching projects`}
                  </p>
                </div>

                {saved && !open && (
                  <div className="space-y-3 pt-2">
                    <p className="card-desc">
                      {saved.name === draft.name ? "This profile is saved and synchronized with your Cyrus workspace." : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <Link to="/dashboard" className={btn("primary", "md")}>
                        Go to My Dashboard →
                      </Link>
                      <Link to="/projects" className={btn("outline", "md")}>
                        Explore Matching Projects ({fmtCompact(reach)}) →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* the controls stay put while the card changes size */}
      <div className="flex flex-wrap items-center gap-3 mt-6">
        <button className={btn("ghost", "md")} onClick={() => write(back(draft))} disabled={step === 0}>Back</button>
        {step < LAST_STEP && step > 0 && (
          <button className={btn("outline", "md")} onClick={() => write(goTo(draft, Math.min(step + 1, LAST_STEP)))}>
            Skip this step
          </button>
        )}
        {step < LAST_STEP ? (
          <button className={btn("primary", "md")} onClick={() => write(advance(draft))}
            disabled={!canAdvance(step, draft)}>
            Continue
          </button>
        ) : (
          <button className={btn("primary", "md")} onClick={save} disabled={!isReadyToSave(draft)}>
            Save this profile
          </button>
        )}
        {blockers.length > 0 && (
          <p className="text-cocoa text-[13px]">Needs {blockers.join(" and ")}.</p>
        )}
        {step === LAST_STEP && !isReadyToSave(draft) && (
          <p className="text-cocoa text-[13px]">A name and one interest are enough to save.</p>
        )}
      </div>
    </div>
  );
}
