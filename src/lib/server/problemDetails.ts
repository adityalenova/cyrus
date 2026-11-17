/**
 * RFC 7807 Problem Details for HTTP APIs (application/problem+json)
 * Provides standardized machine-readable details for HTTP errors.
 */

export interface InvalidParamDetail {
  name: string;
  reason: string;
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  invalidParams?: InvalidParamDetail[];
  [key: string]: unknown;
}

const DEFAULT_TYPE_PREFIX = 'https://cyrus.ai/errors';

export function createProblemDetails(
  status: number,
  title: string,
  options?: {
    detail?: string;
    instance?: string;
    typeSlug?: string;
    invalidParams?: InvalidParamDetail[];
    extensions?: Record<string, unknown>;
  }
): ProblemDetails {
  const type = options?.typeSlug
    ? `${DEFAULT_TYPE_PREFIX}/${options.typeSlug}`
    : `${DEFAULT_TYPE_PREFIX}/http-${status}`;

  const problem: ProblemDetails = {
    type,
    title,
    status,
    ...(options?.detail ? { detail: options.detail } : {}),
    ...(options?.instance ? { instance: options.instance } : {}),
    ...(options?.invalidParams && options.invalidParams.length > 0
      ? { invalidParams: options.invalidParams }
      : {}),
    ...(options?.extensions || {}),
  };

  return problem;
}

export function toProblemResponse(problem: ProblemDetails): Response {
  return new Response(JSON.stringify(problem, null, 2), {
    status: problem.status,
    headers: {
      'Content-Type': 'application/problem+json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export const ProblemFactory = {
  badRequest(detail?: string, invalidParams?: InvalidParamDetail[]): ProblemDetails {
    return createProblemDetails(400, 'Bad Request', {
      detail: detail || 'The request could not be understood or was missing required parameters.',
      typeSlug: 'bad-request',
      invalidParams,
    });
  },

  unauthorized(detail?: string): ProblemDetails {
    return createProblemDetails(401, 'Unauthorized', {
      detail: detail || 'Authentication credentials were missing or invalid.',
      typeSlug: 'unauthorized',
    });
  },

  forbidden(detail?: string): ProblemDetails {
    return createProblemDetails(403, 'Forbidden', {
      detail: detail || 'You do not have permission to access this resource.',
      typeSlug: 'forbidden',
    });
  },

  notFound(detail?: string, instance?: string): ProblemDetails {
    return createProblemDetails(404, 'Not Found', {
      detail: detail || 'The requested resource was not found.',
      typeSlug: 'not-found',
      instance,
    });
  },

  conflict(detail?: string): ProblemDetails {
    return createProblemDetails(409, 'Conflict', {
      detail: detail || 'The resource already exists or conflicts with current state.',
      typeSlug: 'conflict',
    });
  },

  unprocessableEntity(detail: string, invalidParams?: InvalidParamDetail[]): ProblemDetails {
    return createProblemDetails(422, 'Unprocessable Entity', {
      detail,
      typeSlug: 'unprocessable-entity',
      invalidParams,
    });
  },

  tooManyRequests(detail?: string, retryAfterSeconds?: number): ProblemDetails {
    return createProblemDetails(429, 'Too Many Requests', {
      detail: detail || 'Rate limit exceeded. Please retry later.',
      typeSlug: 'rate-limit-exceeded',
      extensions: retryAfterSeconds ? { retryAfter: retryAfterSeconds } : {},
    });
  },

  internalServerError(detail?: string): ProblemDetails {
    return createProblemDetails(500, 'Internal Server Error', {
      detail: detail || 'An unexpected server error occurred.',
      typeSlug: 'internal-server-error',
    });
  },
};
