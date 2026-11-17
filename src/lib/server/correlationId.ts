import { randomUUID } from "node:crypto";

export const CORRELATION_HEADER = "x-correlation-id";
export const REQUEST_ID_HEADER = "x-request-id";

export interface CorrelationContext {
  correlationId: string;
  requestId: string;
  startTime: number;
}

export function getOrCreateCorrelationId(headers: Headers): CorrelationContext {
  const incomingCorrelation =
    headers.get(CORRELATION_HEADER) ||
    headers.get("x-request-id") ||
    headers.get("traceparent");

  const correlationId = incomingCorrelation ? incomingCorrelation.trim() : randomUUID();
  const requestId = randomUUID();

  return {
    correlationId,
    requestId,
    startTime: Date.now(),
  };
}

export function applyCorrelationHeaders(
  headers: Headers,
  context: CorrelationContext
): Headers {
  headers.set(CORRELATION_HEADER, context.correlationId);
  headers.set(REQUEST_ID_HEADER, context.requestId);
  return headers;
}

export function withCorrelationResponse(
  response: Response,
  context: CorrelationContext
): Response {
  const newHeaders = new Headers(response.headers);
  applyCorrelationHeaders(newHeaders, context);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
