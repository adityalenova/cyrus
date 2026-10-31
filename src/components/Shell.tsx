/* ══ Shell.tsx — client chrome: store, scroll, splash, nav, footer ═════ */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion, type Variants } from "framer-motion";
import { StoreProvider } from "@/lib/store";
import { useLocation } from "@/lib/router";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import Palette from "@/components/Palette";
import AuthModal from "@/components/AuthModal";
import { Logo } from "@/components/ui";

function ScrollManager() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0);
    else setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" }), 60);
  }, [pathname, hash]);
  return null;
}

/* one-time intro curtain: marketing pages only, decided after mount so
   server HTML never carries it.

   The sequence is the brand, not a spinner. The mark is a seven-petal rosette
   that never stops turning - `.mark-spin` in globals.css is its only motion, on
   the splash and everywhere else - so the intro does not stage a second idea
   around it. The curtain opens on the mark already mid-turn, fading up over half
   a second with a single soft bloom swelling once behind it. Then the wordmark
   rises letter by letter, a hairline rule grows under it, and the line of what
   the site is fades in last. Everything resolves at about two seconds, and then
   the curtain lifts - timed to read as an arrival and not a wait. Skipped
   outright for reduced-motion visitors and for every route inside the
   application shell. */
const CURSOR = 2050;                        /* curtain comes down at */
const WORD = "cyrus";
/* the same two curves the rest of the site moves on: settle, then leave */
const EASE_SILK = [0.22, 1, 0.36, 1] as const;
const EASE_LIFT = [0.76, 0, 0.24, 1] as const;

function Splash({ app }: { app: boolean }) {
  const [show, setShow] = useState(false);
  const [lift, setLift] = useState(false);
  const reduce = useReducedMotion();

  /* Deciding to play is a one-time question, answered from sessionStorage:
     StrictMode runs mount effects twice, and the second pass must not restart
     the curtain. Running the clock is a separate effect keyed on `show`, so
     the first pass's cleanup can never leave the page covered with no timers
     left to lift it. */
  useEffect(() => {
    if (app || reduce || sessionStorage.getItem("cyrus-splashed") === "1") return;
    sessionStorage.setItem("cyrus-splashed", "1");
    setShow(true);
  }, [app, reduce]);

  useEffect(() => {
    if (!show) return;
    document.body.style.overflow = "hidden";
    const t1 = setTimeout(() => setLift(true), CURSOR);
    const t2 = setTimeout(() => setShow(false), CURSOR + 620);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      document.body.style.overflow = "";
    };
  }, [show]);

  const rise: Variants = {
    hidden: { y: 16, opacity: 0 },
    on: { y: 0, opacity: 1, transition: { duration: 0.42, ease: EASE_SILK } },
  };
  const wordParent: Variants = { hidden: {}, on: { transition: { staggerChildren: 0.05, delayChildren: 0.62 } } };

  return (
    <AnimatePresence>
      {show && (
        <motion.div className="splash" aria-hidden="true"
          initial={{ y: 0 }} animate={{ y: lift ? "-100%" : 0 }}
          transition={{ duration: .62, ease: EASE_LIFT }}>
          <div className="flex flex-col items-center gap-[18px]">
            {/* the mark is laid down: one bloom behind it, then it fades in
                already turning - the turn is the mark's only motion, and the
                wordmark rising under it is what makes this an entrance */}
            <div className="relative grid place-items-center">
              <span className="bloom" />
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: .5, ease: EASE_SILK }}>
                <Logo size={104} />
              </motion.div>
            </div>
            <motion.div className="flex font-display font-extrabold tracking-[-.03em] text-[38px] leading-none"
              variants={wordParent} initial="hidden" animate="on">
              {WORD.split("").map((ch, i) => (
                <motion.span key={i} variants={rise}>{ch}</motion.span>
              ))}
              <motion.span variants={rise} className="text-accent">.ai</motion.span>
            </motion.div>
            <div className="splash-rule w-[168px]" />
            <motion.p className="font-mono text-[10px] uppercase tracking-[.2em] text-dim"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.15, duration: .5 }}>
              open source · programs · skills
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  /* the board is an application: it owns its top bar and sidebar, so the
     marketing header and footer stay off those routes */
  const app = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return (
    <StoreProvider>
      {/* One place decides how the site moves for someone who has asked their
          system for less of it: framer skips the transform-based entrance
          animations everywhere below, while opacity fades - the ones that
          carry meaning rather than motion - still play. */}
      <MotionConfig reducedMotion="user">
        <ScrollManager />
        <Splash app={app} />
        <div className="min-h-screen flex flex-col">
          <a className="skip-link" href="#main">Skip to content</a>
          {!app && <Nav />}
          <main id="main" tabIndex={-1} className="flex-1">{children}</main>
          {!app && <Footer />}
        </div>
        <Palette />
        <AuthModal />
      </MotionConfig>
    </StoreProvider>
  );
}
