/* ══ pr-template-generator/model.ts — PR template generation engine ══ */

export type ChangeType = "bugfix" | "feature" | "refactor" | "docs" | "chore" | "perf";

export interface TemplateSection {
  heading: string;
  content: string;
  required: boolean;
}

export interface PRTemplate {
  changeType: ChangeType;
  title: string;
  sections: TemplateSection[];
  markdown: string;
}

export const CHANGE_LABELS: Record<ChangeType, string> = {
  bugfix: "Bug Fix", feature: "New Feature", refactor: "Refactor",
  docs: "Documentation", chore: "Chore", perf: "Performance",
};

export const CHANGE_EMOJI: Record<ChangeType, string> = {
  bugfix: "🐛", feature: "✨", refactor: "♻️",
  docs: "📝", chore: "🔧", perf: "⚡",
};

export function baseSections(type: ChangeType): TemplateSection[] {
  const sections: TemplateSection[] = [
    { heading: "Summary", content: "Brief description of the change.", required: true },
    { heading: "Motivation", content: "Why this change is needed.", required: true },
  ];
  if (type === "bugfix") {
    sections.push({ heading: "Root Cause", content: "What caused the bug.", required: true });
    sections.push({ heading: "Fix", content: "How the fix works.", required: true });
  }
  if (type === "feature") {
    sections.push({ heading: "Design", content: "High-level design of the feature.", required: false });
  }
  sections.push({ heading: "Testing", content: "How this was tested.", required: true });
  sections.push({ heading: "Related Issues", content: "Closes #", required: false });
  if (type === "refactor" || type === "feature") {
    sections.push({ heading: "Breaking Changes", content: "None", required: false });
  }
  sections.push({ heading: "Checklist", content: "- [ ] Tests pass\n- [ ] Lint clean\n- [ ] Docs updated", required: true });
  return sections;
}

export function toMarkdown(template: PRTemplate): string {
  const lines: string[] = [];
  lines.push("## " + CHANGE_EMOJI[template.changeType] + " " + CHANGE_LABELS[template.changeType]);
  lines.push("");
  for (const s of template.sections) {
    lines.push("### " + s.heading + (s.required ? " *" : ""));
    lines.push(s.content);
    lines.push("");
  }
  return lines.join("\n");
}

export function generateTemplate(type: ChangeType, title: string): PRTemplate {
  const sections = baseSections(type);
  const template = { changeType: type, title, sections, markdown: "" };
  template.markdown = toMarkdown(template);
  return template;
}
