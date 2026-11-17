export interface SecurityHeaderOptions {
  nonce?: string;
  isProduction?: boolean;
}

export function buildSecurityHeaders(options: SecurityHeaderOptions = {}): Record<string, string> {
  const nonce = options.nonce ? `'nonce-${options.nonce}'` : "";

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-eval' ${nonce}`.trim(),
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.github.com https://huggingface.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  const headers: Record<string, string> = {
    "Content-Security-Policy": cspDirectives.join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };

  if (options.isProduction !== false) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
  }

  return headers;
}
