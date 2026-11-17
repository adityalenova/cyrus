/* ══ verifyDocLinks.ts — verify relative markdown file links ═══════ */
import fs from "fs";
import path from "path";

export function verifyLinksInFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return [`File not found: ${filePath}`];
  const content = fs.readFileSync(filePath, "utf-8");
  const linkRegex = /\[[^\]]+\]\(([^\)]+)\)/g;
  const broken: string[] = [];
  let match;
  while ((match = linkRegex.exec(content)) !== null) {
    const target = match[1];
    if (target.startsWith("http") || target.startsWith("#")) continue;
    const resolved = path.resolve(path.dirname(filePath), target.split("#")[0]);
    if (!fs.existsSync(resolved)) broken.push(target);
  }
  return broken;
}
