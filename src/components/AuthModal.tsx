"use client"
/* ══ AuthModal.tsx — full-screen split sign-in sheet ═
   left: the graphite plate - dashed grid, crosshairs, the mark in a lit tile
   (see AuthCanvas.tsx) · right:
   LOGIN/SIGN UP tabs, email + 6-digit verification code (server-issued), OAuth row */
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "@/lib/router";
import { useStore } from "../lib/store";
import { googleConfigured, promptGoogle } from "../lib/google";
import { githubCanFinish, promptGitHub } from "../lib/github";
import { api } from "../lib/api";
import { mountTurnstile, turnstileConfigured } from "../lib/turnstile";
import type { TurnstileHandle } from "../lib/turnstile";
import { Word } from "./ui";
import AuthCanvas from "./AuthCanvas";

const GH_ICON = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.42 7.86 10.95.58.1.79-.25.79-.55v-2.1c-3.2.7-3.87-1.36-3.87-1.36-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.35.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.26 5.66.41.36.78 1.06.78 2.14v3.17c0 .31.2.66.8.55A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" /></svg>;
const G_ICON = <svg width="17" height="17" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.5 12.26c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z" /><path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.93l-3.87-3c-1.08.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z" /><path fill="#FBBC05" d="M5.27 14.26A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.55.38-2.26V6.65H1.29a12 12 0 0 0 0 10.7l3.98-3.09Z" /><path fill="#EA4335" d="M12 4.77c1.76 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.65l3.98 3.09C6.22 6.88 8.87 4.77 12 4.77Z" /></svg>;
const ARROW = <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5m0 0 6-6m-6 6 6 6" /></svg>;

export default function AuthModal() {
  const { authOpen, setAuthOpen, signIn, toast, refreshSession } = useStore();
  const nav = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [step, setStep] = useState<"form" | "code">("form");
  const [code, setCode] = useState("");
  const [busyMail, setBusyMail] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [busyGoogle, setBusyGoogle] = useState(false);
  const [busyGithub, setBusyGithub] = useState(false);

  /* ── Cloudflare Turnstile: the sheet owns the slot, the widget owns the token.
     Tokens are single-use, so every attempt - pass or fail - burns one and the
     handle resets the widget for the next. Without a site key configured none of
     this exists: no script, no slot, no gate. ── */
  const tsOn = turnstileConfigured();
  const tsSlot = useRef<HTMLDivElement>(null);
  const tsHandle = useRef<TurnstileHandle | null>(null);
  const [tsToken, setTsToken] = useState("");

  /* signed code envelope handed back by /start when the deploy has no database:
     it has to travel with the verify call or the code cannot be checked. */
  const mailCh = useRef("");

  useEffect(() => {
    if (!authOpen || !tsOn) return;
    const el = tsSlot.current;
    if (!el) return;
    let live = true;
    void mountTurnstile(el, (t) => { if (live) setTsToken(t); }).then((h) => {
      if (!live) { h?.remove(); return; }
      tsHandle.current = h;
    });
    return () => {
      live = false;
      tsHandle.current?.remove();
      tsHandle.current = null;
      setTsToken("");
    };
  }, [authOpen, tsOn]);

  const tsGuard = (): boolean => {
    if (!tsOn || tsToken) return true;
    toast("Tick the verification box, then we send the code.");
    return false;
  };
  const tsBurn = () => { tsHandle.current?.reset(); };

  /* the Google redirect is completed in StoreProvider, above every gate -
     this sheet only ever starts a sign-in from here. */

  /* resend cooldown ticker for the email code step */
  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  /* closing the sheet always returns the email form to step one (hook order: above the guard) */
  useEffect(() => {
    if (authOpen) return;
    setStep("form"); setCode(""); setResendIn(0); setBusyMail(false);
    mailCh.current = "";
  }, [authOpen]);

  if (!authOpen) return null;

  const done = (who: string, provider: string, msg: string, extras?: { email?: string; picture?: string }) => {
    signIn({ name: who, provider, ...extras });
    setAuthOpen(false);
    toast(msg);
    /* if a server session cookie exists (real GitHub/Google exchange), merge it now */
    void refreshSession();
    setTimeout(() => nav("/dashboard"), 450);
  };

  const isEmail = (m: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m);

  /* step 1: ask the server for a code. Nobody gets signed in from here - the
     6 digits have to come back from the mailbox first. */
  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!isEmail(mail)) { toast("That email doesn't look right."); return; }
    if (!tsGuard()) return;
    setBusyMail(true);
    const token = tsToken; tsBurn();
    try {
      const r = await api.emailStart(mail, token || undefined);
      if (!r) { toast("Sign-in isn't reachable right now - try again in a moment."); return; }
      if (r.ok) {
        mailCh.current = r.challenge || "";
        setStep("code"); setCode(""); setResendIn(30);
        toast(r.demo && r.code
          ? `Demo mode (no mail key configured) - your code is ${r.code}`
          : `We sent a 6-digit code to ${mail}. It expires in 10 minutes.`);
        return;
      }
      toast(r.reason === "too_soon" ? "A code was just sent - give it half a minute, then try again."
        : r.reason === "invalid_email" ? "That email doesn't look right."
        : r.reason === "captcha_required" ? "Tick the verification box first, then send again."
        : r.reason === "captcha_failed" ? "Cloudflare did not recognise that check - tick it again and resend."
        : "Couldn't send the code right now - sign in with Google, or try again shortly.");
    } finally {
      setBusyMail(false);
    }
  };

  /* step 2: trade the entered code for a session */
  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const mail = email.trim().toLowerCase();
    if (!/^\d{6}$/.test(code)) { toast("Enter the 6-digit code from the email."); return; }
    setBusyMail(true);
    try {
      const r = await api.emailVerify(mail, code, tab === "signup" ? name.trim() || undefined : undefined, mailCh.current || undefined);
      if (r?.ok && r.user) {
        const first = r.user.name.split(" ")[0];
        done(r.user.name, "Email", tab === "signup" ? `Account created - welcome, ${first}!` : `Welcome back, ${first}!`, { email: mail });
        return;
      }
      if (r?.challenge) mailCh.current = r.challenge;
      toast(!r ? "Sign-in didn't complete - try again."
        : r.reason === "expired" ? "That code expired - send yourself a new one."
        : r.reason === "locked" || r.reason === "no_code" ? "That code is no longer active - send a new one."
        : "That code doesn't match - check the email and try again.");
    } finally {
      setBusyMail(false);
    }
  };

  const resend = async () => {
    if (resendIn > 0 || busyMail) return;
    if (!tsGuard()) return;
    setBusyMail(true);
    const token = tsToken; tsBurn();
    try {
      const r = await api.emailStart(email.trim().toLowerCase(), token || undefined);
      if (r?.ok) {
        mailCh.current = r.challenge || "";
        setResendIn(30);
        toast(r.demo && r.code ? `Demo mode - your new code is ${r.code}` : "A fresh code is on its way.");
      } else {
        toast(r?.reason === "too_soon" ? "Almost - give it a few more seconds."
          : r?.reason === "captcha_required" || r?.reason === "captcha_failed" ? "Tick the verification box again, then resend."
          : "Couldn't resend right now - try again.");
      }
    } finally {
      setBusyMail(false);
    }
  };

  /* a provider button that cannot end in a session says so instead of
     inventing an identity: GitHub needs the app id *and* somewhere to trade
     the code (this server, or a relay), and the email code is the path that
     works on every deploy. */
  const notWired = (p: string) =>
    toast(`${p} sign-in is not connected on this deploy - use the email code below.`);

  const signInGoogle = async () => {
    if (!googleConfigured()) { notWired("Google"); return; }
    setBusyGoogle(true);
    try {
      await promptGoogle();          // the tab leaves; the redirect completes the sign-in
      toast("Opening Google…");
    } catch (e) {
      const m = (e as Error).message ?? "";
      toast(m.includes("popup") ? m : m || "Google sign-in didn't complete - try again.");
    } finally {
      setBusyGoogle(false);
    }
  };

  const signInGitHub = async () => {
    if (!(await githubCanFinish())) { notWired("GitHub"); return; }
    setBusyGithub(true);
    try {
      const g = await promptGitHub();
      done(g.name, "GitHub", `Signed in as ${g.login} with GitHub. Opening your dashboard…`, { email: g.email, picture: g.avatar });
    } catch (e) {
      const m = (e as Error).message ?? "";
      toast(m || "GitHub sign-in didn't complete - try again.");
    } finally {
      setBusyGithub(false);
    }
  };

  const label = "block font-mono text-[11px] tracking-[.12em] uppercase text-cocoa mb-2";
  /* the sheet is the box, so everything inside it sits one step darker than the
     box itself (bg-paper) rather than blending into it */
  const fin = "w-full bg-paper border border-line rounded-[14px] px-4 py-3.5 text-[15px] outline-none transition-all placeholder:text-dim focus:border-accent focus:shadow-[0_0_0_3px_rgba(34, 197, 94,.14)]";

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" style={{ background: "var(--color-paper)" }}
      role="dialog" aria-modal="true" aria-label="Sign in">
      {/* pinned to the top-left corner of the screen, over the brand wall */}
      <button onClick={() => setAuthOpen(false)}
        className="fixed top-6 left-6 z-[110] max-[900px]:top-4 max-[900px]:left-4 inline-flex items-center gap-2.5 bg-card border border-line rounded-full pl-4 pr-5 py-2.5 font-mono text-[12px] font-bold tracking-[.06em] text-ink shadow-soft hover:border-accent hover:text-rust transition-all cursor-pointer">
        {ARROW} Back to Home
      </button>
      <div className="min-h-full grid grid-cols-2 max-[900px]:grid-cols-1">
        {/* ── left: the graphite plate — a dashed hairline grid with a crosshair
            every four cells, and the mark in a dark tile with a bloom behind it
            (AuthCanvas.tsx owns all of it, and its numbers come from the
            reference) ── */}
        <AuthCanvas />

        {/* ── right: the form column - the single "Back to Home" button lives
            at the screen's top-left corner above (see fixed button), so this
            column carries no duplicate of it. The form itself is boxed: one
            bordered card on the paper wall, so it reads as a sheet rather
            than as text floating on the page. ── */}
        <div className="relative flex flex-col items-center justify-center px-6 py-14 max-[900px]:py-10">
          <div className="w-full max-w-[470px] bg-card border border-line rounded-[28px] px-8 py-9 shadow-[0_30px_70px_-34px_rgba(0,0,0,.6)] max-[560px]:px-5 max-[560px]:py-7">
            <h1 className="font-display font-extrabold tracking-[-.02em] text-[clamp(30px,3.4vw,40px)] text-center leading-tight mt-4">
              {tab === "login" ? <>Welcome <Word>back</Word></> : <>Create your <Word>shortlist</Word></>}
            </h1>
            <p className="text-center text-cocoa text-[15px] leading-[1.6] mt-3 mb-8">
              {tab === "login"
                ? "Log in to pick up the issues you are already working on."
                : "One account for issues, programs, repos and your board."}
            </p>

            {/* tabs */}
            <div className="bg-clay border border-line rounded-[14px] p-1.5 grid grid-cols-2 mb-8">
              {(["login", "signup"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`rounded-[10px] py-2.5 font-mono text-[12px] font-bold tracking-[.12em] uppercase transition-all cursor-pointer ${tab === t ? "bg-card text-rust shadow-soft" : "text-dim hover:text-cocoa"}`}>
                  {t === "login" ? "Login" : "Sign up"}
                </button>
              ))}
            </div>

            {/* Cloudflare Turnstile - only present when a site key is configured */}
            {tsOn && <div ref={tsSlot} className="mb-7 min-h-[68px]" aria-live="polite" />}

            {step === "form" ? (
              <form onSubmit={sendCode} className="grid gap-5">
                {tab === "signup" && (
                  <div>
                    <span className={label}>Display name</span>
                    <input className={fin} placeholder="Ada Lovelace" value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" />
                  </div>
                )}
                <div>
                  <span className={label}>Email address</span>
                  <input className={fin} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </div>
                <button type="submit" disabled={busyMail}
                  className="mt-1 w-full bg-accent hover:bg-accentd text-accentfg font-display font-bold text-[16px] rounded-[14px] py-4 shadow-[0_14px_30px_-12px_rgba(34, 197, 94,.6)] transition-all active:scale-[.99] cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                  {busyMail ? "Sending code..." : tab === "login" ? "Send Login Code" : "Send Sign-Up Code"}
                </button>
                <p className="text-center font-mono text-[10.5px] tracking-[.08em] text-dim -mt-1">
                  No passwords - we email you a 6-digit code instead.
                </p>
              </form>
            ) : (
              <form onSubmit={verifyCode} className="grid gap-5">
                <div>
                  <span className={label}>6-digit code</span>
                  <input className={`${fin} !text-center font-mono font-bold tracking-[.42em] text-[22px]`}
                    inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000"
                    value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} autoFocus />
                </div>
                <button type="submit" disabled={busyMail}
                  className="mt-1 w-full bg-accent hover:bg-accentd text-accentfg font-display font-bold text-[16px] rounded-[14px] py-4 shadow-[0_14px_30px_-12px_rgba(34, 197, 94,.6)] transition-all active:scale-[.99] cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                  {busyMail ? "Verifying..." : "Verify & Continue"}
                </button>
                <div className="flex items-center justify-between font-mono text-[11px] font-bold tracking-[.08em]">
                  <button type="button" onClick={() => { setStep("form"); setCode(""); mailCh.current = ""; }}
                    className="text-rust hover:text-accent cursor-pointer">Change email</button>
                  <button type="button" onClick={resend} disabled={resendIn > 0 || busyMail}
                    className="text-cocoa hover:text-rust transition-all cursor-pointer disabled:text-dim disabled:cursor-not-allowed">
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
                  </button>
                </div>
                <p className="text-center text-[12.5px] text-cocoa leading-[1.6] -mt-1">
                  Sent to <span className="font-semibold text-ink">{email.trim().toLowerCase()}</span>. The code expires in 10 minutes.
                </p>
              </form>
            )}

            <div className="flex items-center gap-4 text-dim text-[12px] font-mono tracking-[.1em] my-7 before:content-[''] before:flex-1 before:h-px before:bg-line after:content-[''] after:flex-1 after:h-px after:bg-line">OR</div>

            <div className="grid grid-cols-2 gap-3.5">
              <button onClick={signInGitHub} disabled={busyGithub}
                className="flex items-center justify-center gap-2.5 bg-paper border border-line rounded-[14px] py-3.5 font-semibold text-[14.5px] text-ink shadow-soft hover:border-accent hover:-translate-y-px transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                {GH_ICON} {busyGithub ? "Opening GitHub..." : "GitHub"}
              </button>
              <button onClick={signInGoogle} disabled={busyGoogle}
                className="flex items-center justify-center gap-2.5 bg-paper border border-line rounded-[14px] py-3.5 font-semibold text-[14.5px] text-ink shadow-soft hover:border-accent hover:-translate-y-px transition-all cursor-pointer disabled:opacity-60 disabled:cursor-wait">
                {G_ICON} {busyGoogle ? "Opening Google..." : "Google"}
              </button>
            </div>

            <p className="text-center text-[12.5px] text-cocoa leading-[1.7] mt-8">
              By logging in or signing up, you agree to our{" "}
              <button onClick={() => toast("Terms page is on the roadmap - nothing to accept yet.")} className="text-rust font-semibold hover:underline cursor-pointer">Terms &amp; Conditions</button>{" "}
              and{" "}
              <button onClick={() => toast("Privacy page is on the roadmap - nothing to accept yet.")} className="text-rust font-semibold hover:underline cursor-pointer">Privacy Policy</button>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
