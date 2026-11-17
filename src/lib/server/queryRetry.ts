export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  factor?: number;
  retryableErrors?: string[];
}

const DEFAULT_RETRYABLE_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EPIPE",
  "40001", // serialization_failure
  "40P01", // deadlock_detected
  "57P01", // admin_shutdown
]);

export function isRetryableError(error: unknown, customCodes?: string[]): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string };
  if (err.code && (DEFAULT_RETRYABLE_CODES.has(err.code) || customCodes?.includes(err.code))) {
    return true;
  }
  if (err.message && /connection terminated|timeout|deadlock/i.test(err.message)) {
    return true;
  }
  return false;
}

export async function withQueryRetry<T>(
  queryFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 100;
  const maxDelayMs = options.maxDelayMs ?? 3000;
  const factor = options.factor ?? 2;

  let attempt = 0;

  while (true) {
    try {
      return await queryFn();
    } catch (err) {
      attempt++;
      if (attempt > maxRetries || !isRetryableError(err, options.retryableErrors)) {
        throw err;
      }

      // Calculate exponential backoff with full jitter
      const exponentialDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt - 1));
      const jitteredDelay = Math.floor(Math.random() * exponentialDelay);

      await new Promise((resolve) => setTimeout(resolve, jitteredDelay));
    }
  }
}
