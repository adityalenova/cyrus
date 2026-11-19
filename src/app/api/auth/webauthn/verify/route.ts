// src/app/api/auth/webauthn/verify/route.ts
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { json } from "@/lib/server/response";
import { getUserById } from "@/lib/server/auth"; // placeholder for user fetch

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Completes a WebAuthn assertion (login) ceremony.
 * Expected body: { userId: string, credential: object }
 */
export async function POST(req: Request) {
  const { userId, credential } = await req.json();
  if (!userId || !credential) return json({ error: "userId and credential required" }, { status: 400 });

  const user = await getUserById(userId);
  if (!user) return json({ error: "User not found" }, { status: 404 });

  try {
    const verification = await verifyAuthenticationResponse({
      credential,
      expectedChallenge: "",
      expectedOrigin: process.env.NEXT_PUBLIC_ORIGIN ?? "https://cyrus.ai",
      expectedRPID: process.env.NEXT_PUBLIC_DOMAIN ?? "cyrus.ai",
    });
    if (verification.verified) {
      return json({ ok: true, verification });
    }
    return json({ error: "Verification failed" }, { status: 401 });
  } catch (e) {
    return json({ error: (e as Error).message }, { status: 500 });
  }
}
