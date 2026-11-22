/**
 * Asana Two-Way Project Sync for Cyrus
 * Synchronizes mentee action items, sprint goals, and tracked issues with Asana workspaces.
 */

export interface AsanaConfig {
  accessToken: string;
  workspaceGid: string;
  defaultProjectGid?: string;
}

export interface AsanaTaskPayload {
  name: string;
  notes?: string;
  dueOn?: string;
  completed?: boolean;
}

export class AsanaSyncService {
  private config: AsanaConfig;

  constructor(config: AsanaConfig) {
    this.config = config;
  }

  async createTask(task: AsanaTaskPayload, projectGid?: string): Promise<{ gid: string; name: string }> {
    const targetProject = projectGid || this.config.defaultProjectGid;
    const res = await fetch("https://app.asana.com/api/1.0/tasks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          workspace: this.config.workspaceGid,
          name: task.name,
          notes: task.notes || "",
          due_on: task.dueOn,
          projects: targetProject ? [targetProject] : undefined,
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create Asana task: ${res.statusText}`);
    }

    const payload = await res.json();
    return { gid: payload.data.gid, name: payload.data.name };
  }

  async syncMenteeSprintMilestones(menteeLogin: string, milestones: { title: string; due: string }[]) {
    const results = [];
    for (const m of milestones) {
      const task = await this.createTask({
        name: `[${menteeLogin}] ${m.title}`,
        notes: `Cyrus Mentorship Sprint Milestone. Tracked automatically via Cyrus Open Source Platform.`,
        dueOn: m.due,
      });
      results.push(task);
    }
    return results;
  }
}
