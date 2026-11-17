export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "api_key",
  "accesstoken",
  "refreshtoken",
  "privatekey",
]);

function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5) return "[MaxDepthReached]";
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else if (typeof val === "object" && val !== null) {
      result[key] = redact(val, depth + 1);
    } else {
      result[key] = val;
    }
  }
  return result;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class StructuredLogger {
  private correlationId?: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId;
  }

  private emit(level: LogLevel, message: string, context?: Record<string, unknown>, err?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(this.correlationId ? { correlationId: this.correlationId } : {}),
      ...(context ? { context: redact(context) as Record<string, unknown> } : {}),
      ...(err ? { error: { name: err.name, message: err.message, stack: err.stack } } : {}),
    };

    const out = JSON.stringify(entry);
    if (level === "ERROR") {
      console.error(out);
    } else if (level === "WARN") {
      console.warn(out);
    } else {
      console.log(out);
    }
  }

  debug(msg: string, ctx?: Record<string, unknown>): void {
    this.emit("DEBUG", msg, ctx);
  }

  info(msg: string, ctx?: Record<string, unknown>): void {
    this.emit("INFO", msg, ctx);
  }

  warn(msg: string, ctx?: Record<string, unknown>): void {
    this.emit("WARN", msg, ctx);
  }

  error(msg: string, err?: Error, ctx?: Record<string, unknown>): void {
    this.emit("ERROR", msg, ctx, err);
  }
}

export const logger = new StructuredLogger();
