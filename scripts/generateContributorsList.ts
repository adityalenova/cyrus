/* ══ generateContributorsList.ts — parses git log for contributors ══ */
import { execSync } from "child_process";

export function getGitContributors(): string[] {
  try {
    const stdout = execSync("git log --format='%aN <%aE>' | sort -u", { encoding: "utf-8" });
    return stdout.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}
