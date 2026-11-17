/* ══ src/types/telemetry.ts — Client telemetry event schema ═════════ */
export interface ClientTelemetryEvent {
  eventType: "pageview" | "search_query" | "issue_click" | "program_filter";
  timestamp: number;
  path: string;
  properties?: Record<string, string | number | boolean>;
}
