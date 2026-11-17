import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";

export const CSRF_COOKIE_NAME = "__Host-cyrus-csrf";
export const CSRF_HEADER_NAME = "x-csrf-token";

export function generateCsrfToken(secret: string): { token: string; signedValue: string } {
  const token = randomBytes(24).toString("hex");
  const signature = createHmac("sha256", secret).update(token).digest("hex");
  const signedValue = `${token}.${signature}`;
  return { token, signedValue };
}

export function verifyCsrfToken(cookieValue: string | null, headerToken: string | null, secret: string): boolean {
  if (!cookieValue || !headerToken) return false;

  const [cookieToken, signature] = cookieValue.split(".");
  if (!cookieToken || !signature) return false;

  if (cookieToken !== headerToken) return false;

  const expectedSignature = createHmac("sha256", secret).update(cookieToken).digest("hex");
  const sigA = Buffer.from(signature, "utf-8");
  const sigB = Buffer.from(expectedSignature, "utf-8");

  if (sigA.length !== sigB.length) return false;

  return timingSafeEqual(sigA, sigB);
}
