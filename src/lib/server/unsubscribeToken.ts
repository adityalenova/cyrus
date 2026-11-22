/* == server/unsubscribeToken.ts - the link in the footer of every email =====
   An unsubscribe link has to work for someone who is not signed in, on a
   phone, from a mail client. So it carries its own proof: the user id and an
   HMAC of it under SESSION_SECRET. Anyone can read the id out of the link, but
   nobody can mint a link for another id without the secret, and the only thing
   a valid link can do is switch that one person's email off.

   There is no expiry on purpose. A person unsubscribing from an old email
   must not be told the link has lapsed; it can only ever reduce what is sent. == */
import { createHmac, timingSafeEqual } from "node:crypto";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** same rule the session cookie uses: no secret, or a short one, means no tokens */
function secret(): string | null {
  const s = process.env.SESSION_SECRET;
  return s && s.length >= 16 ? s : null;
}

const mac = (id: string, key: string) => createHmac("sha256", key).update(`unsubscribe:${id}`).digest("base64url");

export function signUnsubscribeToken(userId: string): string | null {
  const key = secret();
  if (!key || !UUID.test(userId)) return null;
  const id = Buffer.from(userId, "utf8").toString("base64url");
  return `${id}.${mac(id, key)}`;
}

/** the user id a token vouches for, or null for anything else */
export function verifyUnsubscribeToken(token: unknown): string | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length > 200) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [id, sig] = parts;
  const want = Buffer.from(mac(id, key));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const userId = Buffer.from(id, "base64url").toString("utf8");
  return UUID.test(userId) ? userId : null;
}
