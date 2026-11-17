export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  recoveryTimeoutMs?: number;
  successThreshold?: number;
}

export class CircuitBreakerOpenError extends Error {
  constructor(public readonly nextRetryTime: number) {
    super(`Circuit breaker is OPEN. Fast failing request until ${new Date(nextRetryTime).toISOString()}`);
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = 0;

  private readonly failureThreshold: number;
  private readonly recoveryTimeoutMs: number;
  private readonly successThreshold: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.recoveryTimeoutMs = options.recoveryTimeoutMs ?? 30000;
    this.successThreshold = options.successThreshold ?? 2;
  }

  getState(): CircuitState {
    if (this.state === "OPEN" && Date.now() >= this.nextAttempt) {
      this.state = "HALF_OPEN";
      this.successCount = 0;
    }
    return this.state;
  }

  async execute<T>(action: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      throw new CircuitBreakerOpenError(this.nextAttempt);
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.reset();
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    if (this.state === "HALF_OPEN") {
      this.trip();
    } else {
      this.failureCount++;
      if (this.failureCount >= this.failureThreshold) {
        this.trip();
      }
    }
  }

  private trip(): void {
    this.state = "OPEN";
    this.nextAttempt = Date.now() + this.recoveryTimeoutMs;
  }

  reset(): void {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = 0;
  }
}
