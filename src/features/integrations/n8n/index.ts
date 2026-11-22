/**
 * n8n Workflow Integration for Cyrus
 * Provides webhook triggers, automated action nodes, and workflow dispatchers.
 */

export interface N8nWebhookEvent {
  event: "issue.claimed" | "pr.merged" | "streak.milestone" | "proposal.submitted";
  timestamp: string;
  contributor: {
    login: string;
    email?: string;
    streakDays?: number;
  };
  payload: Record<string, unknown>;
}

export interface N8nWorkflowConfig {
  webhookUrl: string;
  authToken?: string;
  enabledEvents: string[];
}

export class N8nWorkflowEngine {
  private config: N8nWorkflowConfig;

  constructor(config: N8nWorkflowConfig) {
    this.config = config;
  }

  async dispatch(event: N8nWebhookEvent): Promise<{ success: boolean; status: number }> {
    if (!this.config.enabledEvents.includes(event.event)) {
      return { success: true, status: 200 };
    }

    try {
      const res = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.authToken ? { Authorization: `Bearer ${this.config.authToken}` } : {}),
        },
        body: JSON.stringify(event),
      });

      return { success: res.ok, status: res.status };
    } catch (err) {
      console.error("[n8n-connector] Webhook dispatch error:", err);
      return { success: false, status: 500 };
    }
  }

  static getSampleWorkflowTemplate() {
    return {
      name: "Cyrus Contributor Journey Automation",
      nodes: [
        {
          name: "Cyrus Webhook Trigger",
          type: "n8n-nodes-base.webhook",
          parameters: { path: "cyrus-events", responseMode: "onReceived" },
        },
        {
          name: "Filter Streak Milestones",
          type: "n8n-nodes-base.if",
          parameters: { conditions: { string: [{ value1: "={{$json.event}}", value2: "streak.milestone" }] } },
        },
        {
          name: "Notify Discord / Slack",
          type: "n8n-nodes-base.slack",
          parameters: { channel: "#general-hall-of-fame" },
        },
      ],
    };
  }
}
