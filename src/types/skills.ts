/* ══ src/types/skills.ts — AI Agent Skill and MCP server types ═════ */
export interface AgentSkillEntry {
  id: string;
  name: string;
  description: string;
  category: "devtools" | "research" | "automation" | "database";
  repositoryUrl: string;
  verified: boolean;
  starsCount: number;
  toolsCount: number;
}
