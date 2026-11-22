/**
 * Atlassian (Jira & Confluence) Integration for Cyrus
 * Connects Cyrus proposal drafts directly to Confluence spaces and syncs GitHub issues with Jira sprint boards.
 */

export interface AtlassianConfig {
  siteUrl: string; // e.g. https://your-domain.atlassian.net
  userEmail: string;
  apiToken: string;
}

export interface ConfluencePagePayload {
  spaceKey: string;
  title: string;
  markdownContent: string;
}

export class AtlassianService {
  private config: AtlassianConfig;

  constructor(config: AtlassianConfig) {
    this.config = config;
  }

  private getAuthHeader(): string {
    const token = Buffer.from(`${this.config.userEmail}:${this.config.apiToken}`).toString("base64");
    return `Basic ${token}`;
  }

  async exportProposalToConfluence(page: ConfluencePagePayload): Promise<{ id: string; url: string }> {
    const endpoint = `${this.config.siteUrl}/wiki/rest/api/content`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "page",
        title: page.title,
        space: { key: page.spaceKey },
        body: {
          storage: {
            value: `<p>${page.markdownContent.replace(/\n/g, "<br/>")}</p>`,
            representation: "storage",
          },
        },
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to create Confluence page: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      id: data.id,
      url: `${this.config.siteUrl}/wiki${data._links.webui}`,
    };
  }

  async linkJiraIssue(projectKey: string, summary: string, githubIssueUrl: string): Promise<{ key: string }> {
    const endpoint = `${this.config.siteUrl}/rest/api/3/issue`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          summary: summary,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: `Tracked on GitHub: ${githubIssueUrl}` }],
              },
            ],
          },
          issuetype: { name: "Task" },
        },
      }),
    });

    const data = await res.json();
    return { key: data.key };
  }
}
