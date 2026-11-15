/* ══ github.ts — real "Sign in with GitHub" for this static SPA ═
   GitHub OAuth with PKCE (S256), popup flow:
     1. We open github.com/login/oauth/authorize with a code_challenge.
     2. The user approves; GitHub redirects the popup to
        /github-callback.html, which postMessages the code back here.
     3. We exchange the code for a token, then read the profile from
        api.github.com/user.

   Setup (never paste the client secret into chat - keep it out of this
   repo entirely):
     VITE_GITHUB_CLIENT_ID     OAuth app client id (public, safe in .env)
     VITE_GITHUB_EXCHANGE_URL  OPTIONAL relay URL that performs the code ->
        token exchange. Browsers cannot call github.com/login/oauth/access_
        token directly (no CORS headers), so for a fully static site the
        relay is required; scripts/github-exchange.worker.mjs is a ready
        Cloudflare Worker for it (it holds the client secret server-side).
        Without a relay we attempt the direct exchange and, if the browser
        blocks it, show a message pointing at the relay setup.
     OAuth app callback URL: http://localhost:5330/github-callback.html
        (plus your production origin when you host the site).

   No client id configured = the UI keeps its demo prompt fallback.   ═ */
import { api, providerReady } from "./api";

export const GITHUB_CLIENT_ID: string | undefined =
  (process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID as string | undefined)?.trim() || undefined;
const GITHUB_EXCHANGE_URL: string | undefined =
  (process.env.NEXT_PUBLIC_GITHUB_EXCHANGE_URL as string | undefined)?.trim() || undefined;

export const githubConfigured = () => !!GITHUB_CLIENT_ID;

/** true when a click on "GitHub" can end in a session: this deploy has the
   server leg (the OAuth secret lives there), or a static relay is configured.
   A client id alone is not enough - a browser cannot finish the exchange. */
export async function githubCanFinish(): Promise<boolean> {
  if (!GITHUB_CLIENT_ID) return false;
  return Boolean(GITHUB_EXCHANGE_URL) || (await providerReady("github"));
}

export type GithubProfile = { login: string; name: string; email: string; avatar: string };

const STATE_KEY = "cyrus.gh.state";
const VERIFIER_KEY = "cyrus.gh.verifier";

const rand = (n: number) => {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
};
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha256 = async (s: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));

/** open the GitHub authorize popup and resolve with the signed-in profile */
export async function promptGitHub(): Promise<GithubProfile> {
  if (!GITHUB_CLIENT_ID) throw new Error("GitHub client id is not configured.");
  const verifier = b64url(rand(48));                      // 64-char base64url verifier
  const challenge = b64url(await sha256(verifier));
  const state = b64url(rand(16));
  sessionStorage.setItem(STATE_KEY, state);
  sessionStorage.setItem(VERIFIER_KEY, verifier);

  const redirect = `${location.origin}/github-callback.html`;
  const url =
    "https://github.com/login/oauth/authorize?client_id=" + encodeURIComponent(GITHUB_CLIENT_ID) +
    `&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent("read:user user:email")}` +
    `&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;
  const win = window.open(url, "cyrus-github-oauth", "width=540,height=720");
  if (!win) throw new Error("The GitHub popup was blocked - allow popups for this site and try again.");

  const code = await new Promise<string>((resolve, reject) => {
    const timer = setInterval(() => { if (win.closed) { cleanup(); reject(new Error("GitHub sign-in was cancelled.")); } }, 500);
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; code?: string; state?: string; error?: string };
      if (d?.source !== "cyrus-github-oauth") return;
      if (d.state !== sessionStorage.getItem(STATE_KEY)) return;
      cleanup();
      if (d.error) reject(new Error(`GitHub returned: ${d.error}`));
      else if (d.code) resolve(d.code);
    };
    const cleanup = () => { clearInterval(timer); window.removeEventListener("message", onMsg); };
    window.addEventListener("message", onMsg);
  });

  /* server-side exchange when this deploy holds the client secret - the
     token never touches the browser and a real session cookie is issued */
  if (await providerReady("github")) {
    const srv = await api.authGithub(code, verifier);
    if (srv?.user) {
      return {
        login: srv.user.login ?? "you",
        name: srv.user.name,
        email: srv.user.email ?? "",
        avatar: srv.user.picture ?? "",
      };
    }
    throw new Error("GitHub sign-in didn't complete on the server - try again.");
  }

  /* no server leg: only a relay can trade the code, because GitHub does not
   answer a browser's CORS preflight on the token endpoint */
  if (!GITHUB_EXCHANGE_URL) {
    throw new Error(
      "This deploy has the GitHub app id but no secret to exchange the code with - " +
      "set GITHUB_CLIENT_SECRET on the server, or sign in with email.",
    );
  }
  const token = await exchange(code, verifier);
  const r = await fetch("https://api.github.com/user", { headers: { accept: "application/json", authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`GitHub rejected the token (HTTP ${r.status}) - try again.`);
  const u = await r.json();
  return {
    login: u.login ?? "you",
    name: u.name || u.login || "you",
    email: u.email ?? "",
    avatar: u.avatar_url ?? "",
  };
}

/* code -> access token. Direct call first honors a future GitHub CORS
   change; with a relay configured (recommended) it goes there instead. */
async function exchange(code: string, verifier: string): Promise<string> {
  const payload = { client_id: GITHUB_CLIENT_ID, code, code_verifier: verifier, grant_type: "authorization_code" };
  const endpoints = GITHUB_EXCHANGE_URL
    ? [GITHUB_EXCHANGE_URL]
    : ["https://github.com/login/oauth/access_token"];
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      const token = j?.access_token;
      if (r.ok && token) return token as string;
      const desc = typeof j?.error_description === "string" ? j.error_description : `HTTP ${r.status}`;
      if (GITHUB_EXCHANGE_URL) throw new Error(`Token exchange failed: ${desc}`);
    } catch (e) {
      if (GITHUB_EXCHANGE_URL) throw e as Error;
    }
  }
  throw new Error("GitHub blocks browser token exchange (CORS). Set VITE_GITHUB_EXCHANGE_URL to the relay - see scripts/github-exchange.worker.mjs.");
}
