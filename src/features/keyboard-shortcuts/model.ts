/* ══ keyboard-shortcuts/model.ts — shortcut registry + conflict detection ══ */

export interface Shortcut {
  id: string;
  keys: string;
  label: string;
  section: "navigation" | "actions" | "search" | "editor";
  enabled: boolean;
}

export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { id: "search",        keys: "meta+k",       label: "Open search",        section: "search",     enabled: true },
  { id: "sidebar",       keys: "meta+b",       label: "Toggle sidebar",     section: "navigation", enabled: true },
  { id: "dashboard",     keys: "meta+shift+d",  label: "Go to dashboard",    section: "navigation", enabled: true },
  { id: "issues",        keys: "meta+shift+i",  label: "Go to issues",       section: "navigation", enabled: true },
  { id: "repos",         keys: "meta+shift+r",  label: "Go to repositories", section: "navigation", enabled: true },
  { id: "settings",      keys: "meta+,",        label: "Open settings",      section: "navigation", enabled: true },
  { id: "cheatsheet",    keys: "meta+/",        label: "Show shortcuts",     section: "actions",    enabled: true },
  { id: "theme-toggle",  keys: "meta+shift+t",  label: "Toggle theme",       section: "actions",    enabled: true },
  { id: "close-modal",   keys: "escape",        label: "Close overlay",      section: "actions",    enabled: true },
  { id: "next-section",  keys: "alt+ArrowDown", label: "Next section",       section: "navigation", enabled: true },
  { id: "prev-section",  keys: "alt+ArrowUp",   label: "Previous section",   section: "navigation", enabled: true },
  { id: "quick-add",     keys: "meta+shift+a",  label: "Quick add issue",    section: "actions",    enabled: true },
];

export function parseKeys(keys: string): string[] {
  return keys.split("+").map((k) => k.trim().toLowerCase());
}

export function normalizeKey(raw: string): string {
  const parts = parseKeys(raw).sort();
  return parts.join("+");
}

export function detectConflicts(shortcuts: Shortcut[]): [string, string][] {
  const conflicts: [string, string][] = [];
  for (let i = 0; i < shortcuts.length; i++) {
    for (let j = i + 1; j < shortcuts.length; j++) {
      if (normalizeKey(shortcuts[i].keys) === normalizeKey(shortcuts[j].keys)) {
        conflicts.push([shortcuts[i].id, shortcuts[j].id]);
      }
    }
  }
  return conflicts;
}

export function findById(id: string, shortcuts: Shortcut[]): Shortcut | undefined {
  return shortcuts.find((s) => s.id === id);
}

export function toggleShortcut(id: string, shortcuts: Shortcut[]): Shortcut[] {
  return shortcuts.map((s) => s.id === id ? { ...s, enabled: !s.enabled } : s);
}

export function rebind(id: string, newKeys: string, shortcuts: Shortcut[]): Shortcut[] {
  return shortcuts.map((s) => s.id === id ? { ...s, keys: newKeys } : s);
}

export function groupBySection(shortcuts: Shortcut[]): Record<string, Shortcut[]> {
  const groups: Record<string, Shortcut[]> = {};
  for (const s of shortcuts) {
    (groups[s.section] ??= []).push(s);
  }
  return groups;
}

export function matchEvent(e: { key: string; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }, keys: string): boolean {
  const parts = parseKeys(keys);
  const needMeta = parts.includes("meta") || parts.includes("cmd");
  const needShift = parts.includes("shift");
  const needAlt = parts.includes("alt");
  const baseKey = parts.filter((p) => !["meta", "cmd", "shift", "alt", "ctrl"].includes(p))[0] || "";
  return (
    e.metaKey === needMeta &&
    e.shiftKey === needShift &&
    e.altKey === needAlt &&
    e.key.toLowerCase() === baseKey.toLowerCase()
  );
}
