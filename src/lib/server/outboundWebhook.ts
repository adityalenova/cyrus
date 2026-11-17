import { createHmac } from "node:crypto";

export interface OutboundWebhookDelivery {
  success: boolean;
  attempts: number;
  statusCode?: number;
  error?: string;
}

export async function dispatchOutboundWebhook(
  targetUrl: string,
  secret: string,
  event: string,
  payload: Record<string, unknown>,
  maxRetries = 3
): Promise<OutboundWebhookDelivery> {
  const body = JSON.stringify({
    event,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  const signature = createHmac("sha256", secret).update(body).digest("hex");

  let attempts = 0;
  while (attempts < maxRetries) {
    attempts++;
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Cyrus-Signature": `sha256=${signature}`,
          "X-Cyrus-Event": event,
        },
        body,
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return { success: true, attempts, statusCode: response.status };
      }

      if (response.status < 500) {
        // Client error (4xx) - do not retry
        return { success: false, attempts, statusCode: response.status, error: `HTTP ${response.status}` };
      }
    } catch (err) {
      if (attempts >= maxRetries) {
        return { success: false, attempts, error: err instanceof Error ? err.message : "Network error" };
      }
    }

    await new Promise((r) => setTimeout(r, Math.pow(2, attempts) * 500));
  }

  return { success: false, attempts, error: "Exceeded max retries" };
}
