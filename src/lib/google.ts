/* ══ google.ts — Google sign-in via a full-page OAuth redirect ═
   No Google Identity Services script and no popups: clicking "Google" sends
   the whole tab to accounts.google.com (the complete sign-in page) and
   Google returns to the site root with the ID token in the URL fragment,
   which readGoogleRedirectCredential() picks up at next load.

   Put your OAuth client id in .env as VITE_GOOGLE_CLIENT_ID.
   Console setup (Google Cloud → APIs & Services → Credentials → the Web client):
     • Authorized JavaScript origins: http://localhost:5330 (and prod origin)
     • Authorized redirect URIs:      http://localhost:5330/ (and prod origin/)
   The implicit id_token flow needs only the (public) client id - never a secret. */

export const GOOGLE_CLIENT_ID: string | undefined =
  (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string | undefined)?.trim() || undefined;

/** true when a real Google sign-in is configured; otherwise the UI keeps its demo flow */
export const googleConfigured = () => !!GOOGLE_CLIENT_ID;

export type GoogleProfile = { name: string; email: string; picture: string; sub: string; idToken?: string };

const NONCE_KEY = "cyrus.google.nonce";
const RETURN_KEY = "cyrus.google.return";

/** where to drop someone once the redirect has finished: the page they were
   on when they clicked, because Google always returns to the site root */
export function takeGoogleReturn(): string {
  try {
    const v = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);
    return v && v.startsWith("/") && !v.startsWith("//") ? v : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

const rand = (bytes: number) => {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** decode a JWT payload (base64url → object); signature is NOT verified client-side */
function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const payload = jwt.split(".")[1];
  if (!payload) throw new Error("Malformed Google credential.");
  const json = decodeURIComponent(
    atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join(""),
  );
  return JSON.parse(json);
}

/** navigate this tab to Google's full sign-in page; the page leaves, so any
   promise awaiting this simply stops existing - the result arrives on the
   next load via readGoogleRedirectCredential() */
export function startGoogleSignIn(): void {
  if (!GOOGLE_CLIENT_ID) throw new Error("Google client id is not configured.");
  const nonce = rand(16);
  try {
    sessionStorage.setItem(NONCE_KEY, nonce);
    sessionStorage.setItem(RETURN_KEY, window.location.pathname + window.location.search);
  } catch { /* private mode - proceed anyway */ }
  const p = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: window.location.origin + "/",
    response_type: "id_token",
    scope: "openid email profile",
    nonce,
    prompt: "select_account",
  });
  window.location.assign("https://accounts.google.com/o/oauth2/v2/auth?" + p.toString());
}

/** legacy GIS popup shape kept so existing call sites compile: it just starts
   the redirect and never resolves (the browser is navigating away) */
export async function promptGoogle(): Promise<GoogleProfile> {
  startGoogleSignIn();
  return new Promise<GoogleProfile>(() => {});
}

/** on page load after the redirect: decode the id_token from the URL fragment
   (or the older ?credential= form), verify the nonce, and clean the URL so
   the router never sees it. Returns null when cancelled/not configured. */
export function readGoogleRedirectCredential(): GoogleProfile | null {
  try {
    const frag = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const idToken = frag.get("id_token") || query.get("credential");
    const err = frag.get("error") || query.get("error");
    if (!idToken && !err) return null;

    // strip Google's params from the address bar before anything else reads it
    frag.delete("id_token"); frag.delete("error"); frag.delete("state"); frag.delete("login_hint");
    const cleanHash = frag.toString() ? `#${frag}` : "";
    query.delete("credential"); query.delete("error");
    const cleanQuery = query.toString();
    window.history.replaceState({}, "", window.location.pathname + (cleanQuery ? `?${cleanQuery}` : "") + cleanHash);
    if (!idToken) return null; // chooser was cancelled - stay signed out

    let saved: string | null = null;
    try { saved = sessionStorage.getItem(NONCE_KEY); sessionStorage.removeItem(NONCE_KEY); } catch { /* ignore */ }
    const payload = decodeJwtPayload(idToken) as Record<string, string>;
    if (saved && payload.nonce && payload.nonce !== saved) throw new Error("Google nonce mismatch - please try again.");
    return {
      name: payload.name ?? payload.email ?? "you",
      email: payload.email ?? "",
      picture: payload.picture ?? "",
      sub: payload.sub ?? "",
      idToken, // raw token for the optional server-side session
    };
  } catch {
    return null;
  }
}
