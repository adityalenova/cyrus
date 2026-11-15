"use client"
/* ══ drafts.tsx — Draft studio ═════════════════════════════════════
   The four files a repository is judged on, written from what you type
   and nothing else. Pre-fill from a repository you follow so the name
   and stack are already right, then draft README, CONTRIBUTING, LICENSE
   and CODE_OF_CONDUCT with a live preview, copy and download.

   It never invents a fact. Anything you leave blank stays visibly blank
   in the document as a [prompt], so a half-written README cannot slip
   out into the world looking finished.                            ══ */
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { REPOS } from "../../data/repos";
import { repoById } from "../util";
import { docsFor, emptyDoc, LICENSES, missingFields, type DocInput, type LicenseId } from "../docgen";
import { btn } from "../../components/ui";
import { Card, DashHead, Ic } from "./shell";
import { ArtSheets } from "./art";
import { DP } from "./shared";
import type { Dash } from "./useDash";

const lab = "block font-mono text-[9px] uppercase tracking-[.14em] text-dim mb-1.5";
const inp = "w-full bg-cream border border-line rounded-[10px] px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-accent/60 transition-colors placeholder:text-dim";
const area = inp + " min-h-[74px] leading-[1.6] font-mono text-[12.5px]";

/* ── a small, safe markdown renderer ────────────────────────────
   Only the subset docgen emits: headings, fenced code, lists, quotes,
   rules, paragraphs and inline code / bold / links. Built as React
   nodes, so nothing the user types can become markup.             ═ */
function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)]+\))/g;
  let last = 0; let m: RegExpExecArray | null; let n = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("`")) out.push(<code key={`${key}-${n++}`} className="font-mono text-[12px] bg-clay rounded-[5px] px-1 py-px">{t.slice(1, -1)}</code>);
    else if (t.startsWith("**")) out.push(<b key={`${key}-${n++}`} className="font-semibold text-ink">{t.slice(2, -2)}</b>);
    else {
      const mm = /\[([^\]]+)\]\(([^)]+)\)/.exec(t);
      out.push(<a key={`${key}-${n++}`} href={mm?.[2]} target="_blank" rel="noopener" className="text-accent hover:text-rust underline decoration-accent/40">{mm?.[1]}</a>);
    }
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const k = `b${i}`;
    if (!l.trim()) continue;
    if (l.startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) buf.push(lines[i]), i++;
      blocks.push(
        <pre key={k} className="bg-coffee text-foam rounded-[10px] p-3.5 text-[12px] leading-[1.7] overflow-x-auto font-mono my-3">{buf.join("\n")}</pre>,
      );
      continue;
    }
    if (/^#{1,3} /.test(l)) {
      const lvl = l.match(/^#+/)![0].length;
      const t = l.replace(/^#+ /, "");
      const cls = lvl === 1 ? "font-display font-extrabold text-[21px] tracking-[-.02em] mt-5 mb-2"
        : lvl === 2 ? "font-display font-bold text-[15.5px] mt-5 mb-2 pb-1.5 border-b border-liness"
          : "font-semibold text-[13.5px] mt-4 mb-1.5";
      blocks.push(<div key={k} className={cls}>{inline(t, k)}</div>);
      continue;
    }
    if (/^> /.test(l)) {
      blocks.push(<blockquote key={k} className="border-l-[3px] border-accent/50 pl-3.5 py-1 my-3 text-[13px] italic text-cocoa">{inline(l.slice(2), k)}</blockquote>);
      continue;
    }
    if (/^(-|\d+\.) /.test(l)) {
      const items: string[] = [];
      while (i < lines.length && /^(-|\d+\.) /.test(lines[i])) items.push(lines[i].replace(/^(-|\d+\.) /, "")), i++;
      i--;
      blocks.push(
        <ul key={k} className="list-disc pl-5 my-2 grid gap-1 text-[13px] leading-[1.65] text-cocoa">
          {items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}
        </ul>,
      );
      continue;
    }
    if (/^={3,}$/.test(l) || /^-{3,}$/.test(l)) { blocks.push(<hr key={k} className="border-line my-4" />); continue; }
    /* a paragraph may run over several lines */
    const para: string[] = [l];
    while (i + 1 < lines.length && lines[i + 1].trim() && !/^(#|```|> |-|\d+\. |=)/.test(lines[i + 1])) para.push(lines[++i]);
    blocks.push(<p key={k} className="text-[13px] leading-[1.75] text-cocoa my-2">{inline(para.join(" "), k)}</p>);
  }
  return <div className="max-w-[70ch]">{blocks}</div>;
}

/* ── one labelled field ───────────────────────────────────────── */
function F({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0"><span className={lab}>{label}</span>{children}</label>;
}

export function DraftsSection({ d }: { d: Dash }) {
  const [i, setI] = useState<DocInput>(() => emptyDoc(new Date().getFullYear()));
  const [tab, setTab] = useState("readme");
  const [raw, setRaw] = useState(false);

  const set = <K extends keyof DocInput>(k: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setI((p) => ({ ...p, [k]: e.target.value }) as DocInput);

  const docs = useMemo(() => docsFor(i), [i]);
  const gaps = useMemo(() => missingFields(i), [i]);
  const doc = docs.find((x) => x.key === tab) ?? docs[0];

  /* prefill from a repository already on the board, then from the catalog */
  const prefill = (id: string) => {
    const r = repoById(id);
    if (!r) return;
    const lic = (LICENSES.find((l) => l.label.toLowerCase().includes(r.license.toLowerCase()))?.id ?? "mit") as LicenseId;
    setI((p) => ({
      ...p,
      name: r.repo.split("/")[1], repo: r.repo, blurb: r.desc.slice(0, 140),
      stack: [r.lang, ...r.tags.slice(0, 3)].filter(Boolean).join(", "),
      license: lic,
    }));
    d.toast(`Filled from ${r.repo} - the rest is yours to write.`);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(doc.text); d.toast(`${doc.file} copied as markdown.`); }
    catch { d.toast("Your browser blocked the clipboard; select the text and copy it manually."); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([doc.text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = doc.file;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    d.toast(`${doc.file} saved - drop it at the top of your repository.`);
  };
  const downloadAll = () => { docs.forEach((x, n) => setTimeout(() => {
    const url = URL.createObjectURL(new Blob([x.text], { type: "text/markdown;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = x.file;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, n * 250)); d.toast("Four files saving. README, CONTRIBUTING, LICENSE and CODE_OF_CONDUCT.") };

  const followed = d.saved.filter((id) => repoById(id));

  return (
    <>
      <Card>
        <DashHead title="Draft studio" sub="README, CONTRIBUTING, LICENSE and CODE_OF_CONDUCT, built from what you tell it. Start from a repository you follow or type it in."
          action={!i.name && !i.repo ? <div className="w-[168px] text-dim max-[820px]:hidden"><ArtSheets /></div> : undefined} />
        {followed.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-5" role="group" aria-label="Fill the form from a repository you follow">
            <span className="font-mono text-[9px] uppercase tracking-[.14em] text-dim self-center mr-1.5">Fill from</span>
            {followed.slice(0, 8).map((id) => (
              <button key={id} type="button" onClick={() => prefill(id)}
                className="font-mono text-[10px] rounded-full px-2.5 py-[6px] border border-line bg-cream text-cocoa hover:border-accent/50 hover:text-accent transition-colors cursor-pointer truncate max-w-[220px]">
                {id}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="grid md:grid-cols-2 gap-4">
          <F label="Project name"><input className={inp} value={i.name} onChange={set("name")} placeholder="quietlog" /></F>
          <F label="Repository (owner/name)"><input className={inp} value={i.repo} onChange={set("repo")} placeholder="you/quietlog" /></F>
          <F label="One line under the title"><input className={inp} value={i.blurb} onChange={set("blurb")} placeholder="What it does, for whom." /></F>
          <F label="Built with (comma separated)"><input className={inp} value={i.stack} onChange={set("stack")} placeholder="TypeScript, Node, SQLite" /></F>
        </div>
        <div className="mt-4">
          <F label="What it does - honest sentences, not the ambition">
            <textarea className={area} value={i.what} onChange={set("what")} placeholder="It reads a folder of logs and prints the five lines that changed most this week." />
          </F>
        </div>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <F label="Install command"><input className={inp} value={i.install} onChange={set("install")} placeholder="npm i quietlog" /></F>
          <F label="Smallest example"><input className={inp} value={i.use} onChange={set("use")} placeholder="npx quietlog ./logs" /></F>
          <F label="Test command"><input className={inp} value={i.test} onChange={set("test")} placeholder="npm test" /></F>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <F label="License">
            <select className={inp + " cursor-pointer"} value={i.license} onChange={set("license")}>
              {LICENSES.map((l) => <option key={l.id} value={l.id}>{l.label} · {l.kind}</option>)}
            </select>
          </F>
          <F label="Copyright holder"><input className={inp} value={i.holder} onChange={set("holder")} placeholder="Your name or the org" /></F>
          <F label="Year"><input className={inp} type="number" value={i.year} onChange={(e) => setI((p) => ({ ...p, year: Number(e.target.value) || p.year }))} /></F>
          <F label="Contact for maintainers"><input className={inp} value={i.contact} onChange={set("contact")} placeholder="you@example.com" /></F>
          <F label="Newcomer label"><input className={inp} value={i.goodFirst} onChange={set("goodFirst")} placeholder="good first issue" /></F>
          <F label="Stability line (optional)"><input className={inp} value={i.stability} onChange={set("stability")} placeholder="Experimental - the format may still change." /></F>
          <F label="Forge host">
            <select className={inp + " cursor-pointer"} value={i.forge} onChange={set("forge")}>
              <option value="github.com">github.com</option>
              <option value="gitlab.com">gitlab.com</option>
              <option value="codeberg.org">codeberg.org</option>
            </select>
          </F>
          <div className="flex items-end">
            <button type="button" onClick={() => { setI(emptyDoc(new Date().getFullYear())); d.toast("Cleared. Nothing is stored - the studio never keeps your text."); }}
              className={btn("ghost", "sm", "w-full")}>Clear the form</button>
          </div>
        </div>
        <p className="font-mono text-[10.5px] text-dim mt-4 leading-[1.7]">
          {LICENSES.find((l) => l.id === i.license)?.note}
          {" "}Nothing here is sent anywhere: the studio builds the text in your browser and keeps no copy.
        </p>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center gap-2 flex-wrap px-4 py-3 border-b border-line bg-sand">
          {docs.map((x) => (
            <button key={x.key} type="button" onClick={() => setTab(x.key)} aria-pressed={tab === x.key}
              className={`font-mono text-[10.5px] font-bold uppercase tracking-[.1em] px-3 py-1.5 rounded-full border transition-colors cursor-pointer ${
                tab === x.key ? "bg-coffee text-foam border-coffee" : "bg-card text-cocoa border-line hover:border-accent/50"}`}>
              {x.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setRaw(!raw)} aria-pressed={raw}
              className={`font-mono text-[10px] uppercase tracking-[.1em] px-2.5 py-1.5 rounded-full border transition-colors cursor-pointer ${raw ? "border-accent/50 bg-peach text-accent" : "border-line bg-card text-cocoa"}`}>
              {raw ? "Raw markdown" : "Preview"}
            </button>
            <button type="button" onClick={copy} className={btn("outline", "sm")}><Ic d={DP.check} size={13} /> Copy</button>
            <button type="button" onClick={download} className={btn("primary", "sm")}><Ic d={DP.download} size={13} /> {doc.file}</button>
            <button type="button" onClick={downloadAll} className={btn("ghost", "sm")}>All four</button>
          </span>
        </div>

        <p className="px-4 pt-3 font-mono text-[9.5px] uppercase tracking-[.12em] text-dim">{doc.blurb}</p>

        {gaps.length > 0 && (
          <div className="mx-4 mt-3 rounded-[10px] border border-honey/40 bg-honey/8 px-3.5 py-2.5">
            <b className="block font-mono text-[9.5px] uppercase tracking-[.14em] text-honey mb-1">Still blank</b>
            <p className="text-[12.5px] text-cocoa leading-[1.65]">
              {gaps.join(" · ")}. The document keeps a [prompt] where each of these belongs instead of guessing.
            </p>
          </div>
        )}

        <div className="p-4 md:p-6 max-h-[560px] overflow-y-auto panel-scroll">
          {raw
            ? <pre className="font-mono text-[12px] leading-[1.75] text-cocoa whitespace-pre-wrap">{doc.text}</pre>
            : <Markdown text={doc.text} />}
        </div>
      </Card>

      <Card>
        <h2 className="panel-h text-[15.5px] mb-2">Where each file goes</h2>
        <ul className="grid gap-2.5 list-none text-[13px] leading-[1.6] text-cocoa">
          {[
            ["README.md", "root of the repository. GitHub renders it on the landing page - the first thing a potential contributor reads, and the reason most leave."],
            ["CONTRIBUTING.md", "root, or docs/. GitHub links it from the opening screen of every new issue and pull request."],
            ["LICENSE", "root, with no extension. GitHub reads it and puts the license in the sidebar; without one the default is all rights reserved."],
            ["CODE_OF_CONDUCT.md", "root or docs/. GitHub surfaces it on the community health page of the repository."],
          ].map(([f, where]) => (
            <li key={f} className="flex gap-2.5 items-start">
              <code className="font-mono text-[11.5px] text-accent shrink-0 mt-[2px]">{f}</code>
              <span className="min-w-0">- {where}</span>
            </li>
          ))}
        </ul>
        <p className="font-mono text-[9.5px] uppercase tracking-[.1em] text-dim leading-[1.8] mt-4">
          {REPOS.length > 0 ? `Pre-fill reads the ${REPOS.length.toLocaleString("en-US")}-repository catalog the site ships with.` : "Pre-fill reads the repository catalog."}
          {" "}Licenses: MIT, BSD-3, Unlicense print in full. Apache, GPL and MPL print the standard notice and link the canonical text - a generator that halves a license is worse than none.
        </p>
      </Card>
    </>
  );
}
