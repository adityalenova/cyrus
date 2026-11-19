// src/app/api/auth/webauthn/register/route.ts
import { generateRegistrationOptions } from "@simplewebauthn/server";
import { json } from "@/lib/server/response";
import { getUserById } from "@/lib/server/auth"; // placeholder for user fetch

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts a WebAuthn registration ceremony.
 * Expected body: { userId: string }
 */
export async function POST(req: Request) {
  const { userId } = await req.json();
  if (!userId) return json({ error: "userId required" }, { status: 400 });

  const user = await getUserById(userId);
  if (!user) return json({ error: "User not found" }, { status: 404 });

  const opts = generateRegistrationOptions({
    rpName: "cyrus.ai",
    rpID: process.env.NEXT_PUBLIC_DOMAIN ?? "cyrus.ai",
    userID: user.id,
    userName: user.email ?? user.id,
    timeout: 60000,
    attestationType: "none",
    excludeCredentials: user.webauthnCredentials?.map((cred: any) => ({
      id: Buffer.from(cred.credential_id, "base64url"),
      type: "public-key",
      transports: cred.transports,
    })) ?? [],
  });

  // In a real app store opts.challenge server‑side.
  return json({ options: opts });
}
