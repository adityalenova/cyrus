"use client"
/* == Unsubscribe.tsx - the page behind "Unsubscribe from all email" =========
   Opened from the footer of every notification email. The link's token is read
   from the address, the person confirms with one click, and only then is
   anything changed: a mail scanner that merely opens the link must not
   unsubscribe anyone. No sign-in is needed; the signed token is the proof. == */
import { useEffect, useState } from "react";
import { Link } from "@/lib/router";
import { btn } from "../components/ui";

type Phase = "reading" | "ask" | "working" | "done" | "invalid" | "failed";

export default function Unsubscribe() {
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<Phase>("reading");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t") ?? "";
    setToken(t);
    setPhase(t ? "ask" : "invalid");
  }, []);

  const confirm = async () => {
    setPhase("working");
    try {
      const r = await fetch(`/api/notifications/unsubscribe?t=${encodeURIComponent(token)}`, { method: "POST" });
      setPhase(r.ok ? "done" : r.status === 400 || r.status === 404 ? "invalid" : "failed");
    } catch {
      setPhase("failed");
    }
  };

  const copy: Record<Phase, [string, string]> = {
    reading: ["One moment", ""],
    ask: ["Unsubscribe from all cyrus.ai email?", "You will stop getting every notification email, including digests. The bell on the site keeps working, and you can turn email back on in Settings whenever you like."],
    working: ["Unsubscribing...", ""],
    done: ["You are unsubscribed", "No more email from cyrus.ai. Your in-app notifications are unchanged."],
    invalid: ["This link is not valid", "It may be incomplete or from another account. You can still turn email off from Settings after signing in."],
    failed: ["That did not go through", "Something went wrong on our side. Try again in a moment."],
  };
  const [title, text] = copy[phase];

  return (
    <div className="max-w-[560px] mx-auto px-6 py-24 text-center">
      <h1 className="font-display font-extrabold text-[clamp(26px,4vw,36px)] tracking-[-.02em] mb-3">{title}</h1>
      {text && <p className="text-cocoa text-[15px] leading-[1.65] mb-7" role="status">{text}</p>}
      <div className="flex gap-3 justify-center flex-wrap">
        {(phase === "ask" || phase === "failed") && (
          <button type="button" className={btn("primary", "lg")} onClick={confirm}>
            {phase === "failed" ? "Try again" : "Yes, unsubscribe me"}
          </button>
        )}
        {phase === "ask" && <Link to="/" className={btn("outline", "lg")}>No, keep my email</Link>}
        {(phase === "done" || phase === "invalid") && <Link to="/dashboard/settings" className={btn("outline", "lg")}>Open Settings</Link>}
      </div>
    </div>
  );
}
