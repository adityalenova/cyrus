"use client";

import { useState, useEffect, useMemo } from "react";
import { Link } from "@/lib/router";

interface ProposalData {
  title: string;
  targetProgram: string;
  targetOrg: string;
  abstract: string;
  problemStatement: string;
  technicalApproach: string;
  deliverables: string;
  timeline: string;
  priorExperience: string;
  postProgramPlan: string;
}

const DEFAULT_PROPOSAL: ProposalData = {
  title: "Distributed Query Optimization for Real-Time Streaming Workflows",
  targetProgram: "Google Summer of Code (GSoC)",
  targetOrg: "Apache Software Foundation",
  abstract: "This project introduces cost-based query optimization for stream-table joins, reducing memory pressure by 40% and cutting tail latency under high-throughput events.",
  problemStatement: "Currently, stream-table joins trigger full partition rescans when sliding windows expire, leading to OOM errors in memory-constrained worker nodes.",
  technicalApproach: "Implement an adaptive bucket index utilizing roaring bitmaps. Cache hot partition metadata in a memory-mapped ring buffer with SIMD vectorized filtering.",
  deliverables: "- Phase 1: Roaring bitmap partition index and unit tests\n- Midterm: Integration with existing SQL planner and benchmarks\n- Phase 2: Vectorized filter execution engine and documentation\n- Final: Production telemetry dashboards and end-to-end integration tests",
  timeline: "- Week 1-2: Community bonding, codebase deep-dive, RFC refinement\n- Week 3-5: Implement roaring bitmap index with 95%+ test coverage\n- Week 6: Midterm evaluation milestone and benchmarking report\n- Week 7-9: Vectorized execution engine and memory-mapped ring buffer\n- Week 10-11: Stress testing with 10M+ streaming event bursts\n- Week 12: Final evaluation, documentation polish, upstream merge",
  priorExperience: "- Merged PR #142: Fixed race condition in partition coordinator\n- Active reviewer on 4 issues in the core repository\n- Maintained personal open-source rust-parquet reader with 300+ stars",
  postProgramPlan: "Continue active participation as a long-term module maintainer and mentor incoming contributors for future GSoC seasons.",
};

const PROGRAMS = [
  "Google Summer of Code (GSoC)",
  "LFX Mentorship (Linux Foundation)",
  "Outreachy",
  "Summer of Bitcoin",
  "MLH Fellowship",
  "Google Season of Docs",
];

const ANNOTATED_EXAMPLES = [
  {
    org: "Apache Software Foundation (GSoC)",
    program: "GSoC 2025 Accepted",
    title: "Zero-Allocation JSON Parsing Pipeline for Stream Analytics",
    score: "98% Readiness",
    strengths: [
      "Explicit weekly timeline with tangible deliverables",
      "Includes links to 3 merged pre-proposal PRs",
      "Detailed failure mitigation strategy",
    ],
    summary: "Clear architectural diagrams, precise benchmark targets, and verified mentor communication logged prior to application window.",
  },
  {
    org: "Cloud Native Computing Foundation (CNCF - LFX)",
    program: "LFX Mentorship Fall",
    title: "eBPF-Based Network Packet Observability Exporter",
    score: "95% Readiness",
    strengths: [
      "Demonstrates concrete domain knowledge of Linux kernel internals",
      "Risk assessment covers kernel version compatibility",
      "Clear post-mentorship maintenance commitment",
    ],
    summary: "High-scoring proposal focused on kernel tracepoints with comprehensive evaluation criteria and test harness specification.",
  },
  {
    org: "Summer of Bitcoin",
    program: "SoB 2025 Accepted",
    title: "Stratum V2 Protocol Implementation in Rust",
    score: "96% Readiness",
    strengths: [
      "Clear cryptographic primitives specification",
      "Prior pull request references in Bitcoin Core repository",
      "Well-defined milestone deliverable breakdown",
    ],
    summary: "Meticulous cryptographic verification protocol proposal with rigorous fuzzing plan.",
  },
];

export default function ProposalStudio() {
  const [activeTab, setActiveTab] = useState<"builder" | "rubric" | "examples" | "preview">("builder");
  const [data, setData] = useState<ProposalData>(DEFAULT_PROPOSAL);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("cyrus.proposal_studio.draft");
      if (saved) {
        setData(JSON.parse(saved));
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleChange = (field: keyof ProposalData, value: string) => {
    const updated = { ...data, [field]: value };
    setData(updated);
    try {
      localStorage.setItem("cyrus.proposal_studio.draft", JSON.stringify(updated));
    } catch {
      // Ignore
    }
  };

  const handleReset = () => {
    if (confirm("Reset proposal form to sample template?")) {
      setData(DEFAULT_PROPOSAL);
      localStorage.removeItem("cyrus.proposal_studio.draft");
    }
  };

  // Readiness Score Calculation
  const scoreBreakdown = useMemo(() => {
    let titleScore = data.title.trim().length >= 15 ? 15 : 5;
    let abstractScore = data.abstract.trim().length >= 80 ? 15 : 5;
    let problemScore = data.problemStatement.trim().length >= 100 ? 15 : 5;
    let technicalScore = data.technicalApproach.trim().length >= 150 ? 20 : 8;
    let deliverablesScore = data.deliverables.includes("Phase") || data.deliverables.includes("Midterm") ? 15 : 7;
    let timelineScore = data.timeline.includes("Week") ? 10 : 4;
    let priorScore = data.priorExperience.includes("PR") || data.priorExperience.includes("issue") ? 10 : 3;

    const total = titleScore + abstractScore + problemScore + technicalScore + deliverablesScore + timelineScore + priorScore;
    return {
      total: Math.min(100, total),
      titleScore,
      abstractScore,
      problemScore,
      technicalScore,
      deliverablesScore,
      timelineScore,
      priorScore,
    };
  }, [data]);

  const markdownOutput = useMemo(() => {
    return `# Proposal: ${data.title}

**Target Program:** ${data.targetProgram}  
**Organization:** ${data.targetOrg}  
**Generated via:** [Cyrus Proposal Studio](https://cyrus.ai/proposal-studio)

---

## 1. Abstract
${data.abstract}

---

## 2. Problem Statement & Background
${data.problemStatement}

---

## 3. Technical Approach & Architecture
${data.technicalApproach}

---

## 4. Deliverables & Milestones
${data.deliverables}

---

## 5. Weekly Timeline
${data.timeline}

---

## 6. Prior Open Source Experience & Merged PRs
${data.priorExperience}

---

## 7. Post-Program Commitment
${data.postProgramPlan}
`;
  }, [data]);

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(markdownOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdownOutput], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "proposal"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-hairline mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/50 mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Interactive Workspace
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-ink">Proposal Studio</h1>
            <p className="text-sm text-dim mt-1 max-w-2xl">
              A structured workspace for open-source program applicants — build rock-solid proposals with live readiness scoring, benchmarked against successful GSoC & LFX applications.
            </p>
          </div>

          {/* Quick Score Badge & Actions */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-xl border border-hairline bg-surface/50 text-right">
              <div className="text-[11px] font-mono uppercase tracking-wider text-dim">Readiness Score</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {scoreBreakdown.total}%
              </div>
            </div>
            <button
              onClick={handleCopyMarkdown}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              {copied ? "✓ Copied!" : "Copy Markdown"}
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="px-4 py-2.5 border border-hairline hover:bg-surface/80 rounded-xl text-xs font-semibold text-ink transition-all cursor-pointer"
            >
              Export .md
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-hairline mb-8 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab("builder")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "builder"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-dim hover:text-ink hover:bg-surface/50"
            }`}
          >
            Structured Builder
          </button>
          <button
            onClick={() => setActiveTab("rubric")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === "rubric"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-dim hover:text-ink hover:bg-surface/50"
            }`}
          >
            Readiness Rubric
            <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 font-bold">
              {scoreBreakdown.total}%
            </span>
          </button>
          <button
            onClick={() => setActiveTab("examples")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "examples"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-dim hover:text-ink hover:bg-surface/50"
            }`}
          >
            Annotated Examples
          </button>
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "preview"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-dim hover:text-ink hover:bg-surface/50"
            }`}
          >
            Live Preview
          </button>

          <button
            onClick={handleReset}
            className="ml-auto text-xs text-dim hover:text-red-500 cursor-pointer px-3 py-1.5 transition-colors"
          >
            Reset Form
          </button>
        </div>

        {/* Tab 1: Builder */}
        {activeTab === "builder" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Program & Org */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                    Target Program
                  </label>
                  <select
                    value={data.targetProgram}
                    onChange={(e) => handleChange("targetProgram", e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm focus:outline-none focus:border-emerald-500"
                  >
                    {PROGRAMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                    Target Organization
                  </label>
                  <input
                    type="text"
                    value={data.targetOrg}
                    onChange={(e) => handleChange("targetOrg", e.target.value)}
                    placeholder="e.g. Apache Software Foundation, Linux Foundation"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  value={data.title}
                  onChange={(e) => handleChange("title", e.target.value)}
                  placeholder="Clear, descriptive title of your proposal"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm font-semibold focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Abstract */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  1. Executive Abstract
                </label>
                <textarea
                  rows={3}
                  value={data.abstract}
                  onChange={(e) => handleChange("abstract", e.target.value)}
                  placeholder="1-2 paragraphs summarizing the goal, methodology, and expected impact."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Problem Statement */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  2. Problem Statement & Background
                </label>
                <textarea
                  rows={4}
                  value={data.problemStatement}
                  onChange={(e) => handleChange("problemStatement", e.target.value)}
                  placeholder="What is currently broken or missing? Why does this matter to the project?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Technical Approach */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  3. Technical Approach & Architecture
                </label>
                <textarea
                  rows={5}
                  value={data.technicalApproach}
                  onChange={(e) => handleChange("technicalApproach", e.target.value)}
                  placeholder="Detail algorithms, data structures, dependencies, API designs, and architectural trade-offs."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm font-mono text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Deliverables */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  4. Deliverables & Milestones
                </label>
                <textarea
                  rows={4}
                  value={data.deliverables}
                  onChange={(e) => handleChange("deliverables", e.target.value)}
                  placeholder="Break down tangible deliverables across Phase 1, Midterm, Phase 2, and Final Evaluation."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm font-mono text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Timeline */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  5. Weekly Timeline (Weeks 1 - 12)
                </label>
                <textarea
                  rows={6}
                  value={data.timeline}
                  onChange={(e) => handleChange("timeline", e.target.value)}
                  placeholder="Provide week-by-week goals with planned buffer weeks for unexpected bugs."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm font-mono text-xs leading-relaxed focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Prior Experience */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  6. Prior Open Source Experience & Merged PRs
                </label>
                <textarea
                  rows={3}
                  value={data.priorExperience}
                  onChange={(e) => handleChange("priorExperience", e.target.value)}
                  placeholder="List links to merged pull requests, closed issues, and previous contributions."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Post Program */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-dim mb-2">
                  7. Post-Program Continuation Plan
                </label>
                <textarea
                  rows={2}
                  value={data.postProgramPlan}
                  onChange={(e) => handleChange("postProgramPlan", e.target.value)}
                  placeholder="How will you continue contributing after the program ends?"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-hairline bg-surface text-ink text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Sidebar Guide */}
            <div className="space-y-6">
              <div className="p-5 rounded-2xl border border-hairline bg-surface/50 space-y-4">
                <h3 className="font-bold text-ink text-sm flex items-center gap-2">
                  <span className="text-emerald-500">⚡</span> Proposal Quality Rubric
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-dim">Title & Overview</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {scoreBreakdown.titleScore + scoreBreakdown.abstractScore} / 30
                    </span>
                  </div>
                  <div className="w-full bg-hairline rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${((scoreBreakdown.titleScore + scoreBreakdown.abstractScore) / 30) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-dim">Technical Depth</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {scoreBreakdown.problemScore + scoreBreakdown.technicalScore} / 35
                    </span>
                  </div>
                  <div className="w-full bg-hairline rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${((scoreBreakdown.problemScore + scoreBreakdown.technicalScore) / 35) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-dim">Milestones & Timeline</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {scoreBreakdown.deliverablesScore + scoreBreakdown.timelineScore} / 25
                    </span>
                  </div>
                  <div className="w-full bg-hairline rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${((scoreBreakdown.deliverablesScore + scoreBreakdown.timelineScore) / 25) * 100}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-dim">Prior Contributions</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {scoreBreakdown.priorScore} / 10
                    </span>
                  </div>
                  <div className="w-full bg-hairline rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${(scoreBreakdown.priorScore / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-hairline bg-surface/50 space-y-3">
                <h3 className="font-bold text-ink text-sm">💡 Pro Applicant Tips</h3>
                <ul className="text-xs text-dim space-y-2 list-disc pl-4">
                  <li>Always link at least 1-2 merged PRs or active bug reports to prove repo familiarity.</li>
                  <li>Include a 1-week buffer around midterm and final evaluation weeks for testing.</li>
                  <li>Mention your timezone and weekly hour commitment (typically 30h/wk for medium, 40h/wk for large).</li>
                  <li>Discuss your draft in the organization’s public Slack/Discord/Discussions before submitting.</li>
                </ul>
              </div>

              <div className="p-5 rounded-2xl border border-emerald-300/80 dark:border-emerald-800/50 bg-emerald-500/10 dark:bg-emerald-950/20 text-xs space-y-2">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">
                  Ready to connect with a mentor?
                </div>
                <p className="text-dim">
                  Match with experienced open-source maintainers who can review your proposal draft.
                </p>
                <Link
                  to="/mentorship"
                  className="inline-block mt-2 font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  Browse verified mentors in directory →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Rubric */}
        {activeTab === "rubric" && (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl border border-hairline bg-surface/50">
              <h2 className="text-xl font-bold text-ink mb-2">Official Reviewer Evaluation Rubric</h2>
              <p className="text-sm text-dim max-w-2xl">
                Mentors evaluate proposals across six core dimensions. Below is your current proposal readiness score.
              </p>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 rounded-xl border border-hairline bg-surface space-y-2">
                  <div className="text-xs font-mono uppercase text-dim">1. Problem Definition</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {scoreBreakdown.problemScore} / 15
                  </div>
                  <p className="text-xs text-dim">
                    Does the applicant articulate the root problem and explain why existing approaches fall short?
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-hairline bg-surface space-y-2">
                  <div className="text-xs font-mono uppercase text-dim">2. Technical Feasibility</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {scoreBreakdown.technicalScore} / 20
                  </div>
                  <p className="text-xs text-dim">
                    Is the architectural plan sound? Are appropriate data structures, APIs, and dependencies specified?
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-hairline bg-surface space-y-2">
                  <div className="text-xs font-mono uppercase text-dim">3. Deliverables Precision</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {scoreBreakdown.deliverablesScore} / 15
                  </div>
                  <p className="text-xs text-dim">
                    Are deliverables partitioned into concrete testable milestones for both midterm and final evaluations?
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-hairline bg-surface space-y-2">
                  <div className="text-xs font-mono uppercase text-dim">4. Timeline & Risk Mitigation</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {scoreBreakdown.timelineScore} / 10
                  </div>
                  <p className="text-xs text-dim">
                    Does the applicant allocate buffer time for code reviews and integration testing?
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-hairline bg-surface space-y-2">
                  <div className="text-xs font-mono uppercase text-dim">5. Community Engagement</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {scoreBreakdown.priorScore} / 10
                  </div>
                  <p className="text-xs text-dim">
                    Has the candidate introduced themselves, opened starter PRs, or engaged in issue discussions?
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-hairline bg-surface space-y-2">
                  <div className="text-xs font-mono uppercase text-dim">6. Clarity & Presentation</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {scoreBreakdown.titleScore + scoreBreakdown.abstractScore} / 30
                  </div>
                  <p className="text-xs text-dim">
                    Is the document well-formatted, free of grammatical ambiguity, and structured logically?
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Examples */}
        {activeTab === "examples" && (
          <div className="space-y-6">
            <div className="border-b border-hairline pb-4">
              <h2 className="text-xl font-bold text-ink">Accepted Proposal Gallery</h2>
              <p className="text-sm text-dim">
                Real proposals accepted into major open-source developer programs with mentor annotations.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {ANNOTATED_EXAMPLES.map((ex, idx) => (
                <div key={idx} className="p-5 rounded-2xl border border-hairline bg-surface/50 space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="px-2.5 py-1 rounded-full font-mono bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold">
                      {ex.program}
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{ex.score}</span>
                  </div>

                  <div>
                    <h3 className="font-bold text-ink text-sm">{ex.title}</h3>
                    <p className="text-xs text-dim mt-1">{ex.org}</p>
                  </div>

                  <p className="text-xs text-ink/80 leading-relaxed">{ex.summary}</p>

                  <div className="space-y-1.5 pt-2 border-t border-hairline">
                    <div className="text-[11px] font-mono text-dim uppercase">Key Strengths</div>
                    {ex.strengths.map((str, sIdx) => (
                      <div key={sIdx} className="text-xs text-dim flex items-center gap-1.5">
                        <span className="text-emerald-500 font-bold">✓</span>
                        {str}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Preview */}
        {activeTab === "preview" && (
          <div className="p-6 rounded-2xl border border-hairline bg-surface/50 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">Markdown Output Preview</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleCopyMarkdown}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  {copied ? "Copied" : "Copy to Clipboard"}
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  className="px-3.5 py-1.5 border border-hairline hover:bg-surface text-ink rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Download .md
                </button>
              </div>
            </div>
            <pre className="p-4 rounded-xl bg-page border border-hairline text-ink font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[600px] overflow-y-auto">
              {markdownOutput}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
