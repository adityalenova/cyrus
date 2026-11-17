export type ShutdownHook = () => Promise<void> | void;

export class GracefulShutdownCoordinator {
  private hooks: Array<{ name: string; fn: ShutdownHook }> = [];
  private isShuttingDown = false;

  registerHook(name: string, fn: ShutdownHook): void {
    this.hooks.push({ name, fn });
  }

  async triggerShutdown(signal: string, timeoutMs = 10000): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    console.info(`[Shutdown] Received ${signal}. Draining services...`);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Shutdown timeout exceeded")), timeoutMs)
    );

    const cleanupPromise = (async () => {
      for (const { name, fn } of this.hooks) {
        try {
          console.info(`[Shutdown] Executing cleanup hook: ${name}`);
          await fn();
        } catch (err) {
          console.error(`[Shutdown] Error in hook "${name}":`, err);
        }
      }
    })();

    try {
      await Promise.race([cleanupPromise, timeoutPromise]);
      console.info("[Shutdown] All hooks completed successfully.");
    } catch (err) {
      console.error("[Shutdown] Forcing exit due to timeout:", err);
    }
  }
}

export const shutdownCoordinator = new GracefulShutdownCoordinator();
