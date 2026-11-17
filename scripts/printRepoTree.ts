/* ══ printRepoTree.ts — generates clean ASCII structure overview ════ */
import fs from "fs";
import path from "path";

export function printTree(dir: string, depth = 2, current = 0): string {
  if (current >= depth) return "";
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let out = "";
  for (const e of entries) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    out += `${'  '.repeat(current)}├── ${e.name}\n`;
    if (e.isDirectory()) {
      out += printTree(path.join(dir, e.name), depth, current + 1);
    }
  }
  return out;
}
