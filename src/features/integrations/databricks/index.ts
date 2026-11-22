/**
 * Databricks Lakehouse Connector for Cyrus
 * Streams contributor activities, repository performance, and mentor metrics into Delta tables.
 */

export interface DatabricksConfig {
  host: string;
  httpPath: string;
  token: string;
  catalog: string;
  schema: string;
}

export interface ContributorMetricRecord {
  contributorId: string;
  username: string;
  repositoriesCount: number;
  totalPrsMerged: number;
  longestStreakDays: number;
  acceptanceRatePct: number;
  evaluatedAt: string;
}

export class DatabricksLakehouseConnector {
  private config: DatabricksConfig;

  constructor(config: DatabricksConfig) {
    this.config = config;
  }

  async executeQuery(sql: string): Promise<unknown[]> {
    const endpoint = `https://${this.config.host}/api/2.0/sql/statements`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        warehouse_id: this.config.httpPath.split("/").pop(),
        statement: sql,
        catalog: this.config.catalog,
        schema: this.config.schema,
      }),
    });

    if (!response.ok) {
      throw new Error(`Databricks query failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.result?.data_array ?? [];
  }

  getSchemaDefinition(): string {
    return `
      CREATE TABLE IF NOT EXISTS ${this.config.catalog}.${this.config.schema}.contributor_metrics (
        contributor_id STRING,
        username STRING,
        repositories_count INT,
        total_prs_merged INT,
        longest_streak_days INT,
        acceptance_rate_pct DOUBLE,
        evaluated_at TIMESTAMP
      ) USING DELTA
      PARTITIONED BY (longest_streak_days);
    `;
  }
}
