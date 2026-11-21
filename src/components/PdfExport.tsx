"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { ReportRequest } from "@/lib/reports";
import { btn } from "@/components/ui";

export default function PdfExport({ request, label = "Export PDF", disabled = false }: {
  request: ReportRequest; label?: string; disabled?: boolean;
}) {
  const id = useId();
  const [size, setSize] = useState<"A4" | "LETTER">("A4");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef<AbortController | null>(null);
  const selection = JSON.stringify(request);
  useEffect(() => () => pending.current?.abort(), [selection]);
  async function download() {
    if (busy || disabled) return;
    setBusy(true); setMessage("Preparing PDF...");
    const controller = new AbortController(); pending.current = controller;
    const timer = setTimeout(() => controller.abort(), 35_000);
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, size }), signal: controller.signal });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(typeof body?.error === "string" ? body.error : "Could not prepare the PDF. Try again.");
      }
      if (!response.headers.get("Content-Type")?.includes("application/pdf")) throw new Error("The response was not a PDF. Try again.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = `cyrus-${request.kind}-${size}.pdf`;
      try {
        if (!controller.signal.aborted) { document.body.append(link); link.click(); }
      } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      if (controller.signal.aborted) return;
      setMessage("PDF download requested.");
    } catch (cause) { setMessage(controller.signal.aborted ? "Export canceled or timed out. Try again." : cause instanceof Error ? cause.message : "Could not prepare the PDF. Try again."); }
    finally { clearTimeout(timer); pending.current = null; setBusy(false); }
  }
  return <div className="flex flex-col gap-1.5 min-w-0 max-w-full">
    <div className="flex flex-wrap gap-2 items-center">
      <label htmlFor={id} className="sr-only">PDF paper size for {label}</label>
      <select id={id} value={size} disabled={busy} onChange={(e) => setSize(e.target.value as "A4" | "LETTER")}
        className="bg-card text-ink border border-line rounded-xl px-2 py-2 text-[12px] focus-visible:outline-2 focus-visible:outline-accent">
        <option value="A4">A4</option><option value="LETTER">Letter</option>
      </select>
      <button type="button" onClick={download} disabled={busy || disabled} aria-busy={busy}
        className={btn("outline", "sm") + " disabled:opacity-50 disabled:cursor-not-allowed"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 3v12m-5-5 5 5 5-5M4 16v4h16v-4" /></svg>
        {busy ? "Preparing PDF..." : label}
      </button>
    </div>
    <p role="status" aria-live="polite" className="text-[12px] text-cocoa max-w-[380px]">{message}</p>
    {request.kind === "activity" && <p className="text-[11px] text-dim max-w-[340px]">Recent public events only. A linked GitHub account is required.</p>}
  </div>;
}

export function ProjectPdfBatch({ projects }: { projects: { repo: string }[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const ids = selected.filter((id) => projects.some((p) => p.repo === id));
  return <details className="bg-card border border-line rounded-xl p-4 mt-4">
    <summary className="cursor-pointer font-semibold text-[13px]">Export followed project reports</summary>
    <p className="card-desc my-3">Select up to 10 catalog projects. Each gets its own page.</p>
    <fieldset className="grid gap-2 max-h-[220px] overflow-y-auto mb-4">
      <legend className="sr-only">Projects to include in the PDF</legend>
      {projects.map((p) => <label key={p.repo} className="flex gap-2 items-center text-[12px] break-all">
        <input type="checkbox" checked={ids.includes(p.repo)} disabled={!ids.includes(p.repo) && ids.length >= 10}
          onChange={(e) => setSelected(e.target.checked ? [...ids, p.repo] : ids.filter((id) => id !== p.repo))} />{p.repo}
      </label>)}
    </fieldset>
    <PdfExport request={{ kind: "projects", ids }} disabled={ids.length === 0} label="Export selected projects" />
  </details>;
}
