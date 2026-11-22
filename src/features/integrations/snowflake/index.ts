/**
 * Snowflake Data Warehouse Connector for Cyrus
 * Syncs program benchmarks, stipend data, and contributor engagement to Snowflake schemas.
 */

export interface SnowflakeConfig {
  account: string;
  warehouse: string;
  database: string;
  schema: string;
  token: string;
}

export interface ProgramAnalyticsPayload {
  programId: string;
  programName: string;
  cohortYear: number;
  totalSlots: number;
  stipendUsd: number;
  acceptanceRate: number;
}

export class SnowflakeConnector {
  private config: SnowflakeConfig;

  constructor(config: SnowflakeConfig) {
    this.config = config;
  }

  async exportProgramAnalytics(records: ProgramAnalyticsPayload[]): Promise<{ inserted: number }> {
    const endpoint = `https://${this.config.account}.snowflakecomputing.com/api/v2/statements`;
    
    const insertSql = `
      INSERT INTO ${this.config.database}.${this.config.schema}.PROGRAM_ANALYTICS 
      (PROGRAM_ID, PROGRAM_NAME, COHORT_YEAR, TOTAL_SLOTS, STIPEND_USD, ACCEPTANCE_RATE, INGESTED_AT)
      SELECT :1, :2, :3, :4, :5, :6, CURRENT_TIMESTAMP();
    `;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        statement: insertSql,
        warehouse: this.config.warehouse,
        database: this.config.database,
        schema: this.config.schema,
        bindings: records.map((r, i) => ({
          [`${i + 1}`]: { type: "TEXT", value: r.programId },
        })),
      }),
    });

    return { inserted: res.ok ? records.length : 0 };
  }

  getStarSchemaDDL(): string {
    return `
      CREATE TABLE IF NOT EXISTS DIM_CONTRIBUTOR (
        CONTRIBUTOR_KEY NUMBER AUTOINCREMENT,
        GITHUB_LOGIN VARCHAR(100),
        STREAK_TIER VARCHAR(50),
        COUNTRY_CODE VARCHAR(10)
      );

      CREATE TABLE IF NOT EXISTS FACT_PROGRAM_CONTRIBUTIONS (
        EVENT_ID VARCHAR(64) PRIMARY KEY,
        CONTRIBUTOR_KEY NUMBER,
        PROGRAM_NAME VARCHAR(100),
        PR_COUNT NUMBER,
        MERGED_FLAG BOOLEAN,
        STIPEND_AWARDED_USD NUMBER(10,2)
      );
    `;
  }
}
