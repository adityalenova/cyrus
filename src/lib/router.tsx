/* ══ router.tsx — react-router compat surface over next/navigation
   Pages were ported from the Vite SPA; this shim lets them keep their
   imports (Link to=, useNavigate, useParams, useLocation, useSearchParams)
   while the app runs on the Next.js App Router. Link, usePathname and useRouter
   come from i18n/navigation, so every link keeps the visitor's language and
   a pathname is always the path without the /es-style prefix. ═══════════════════════ */
"use client";

import { useParams as useNextParams } from "next/navigation";
import { Link as IntlLink, usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

type LinkProps = {
  to: string;
  children?: ReactNode;
  className?: string;
  end?: boolean;
  onClick?: () => void;
  title?: string;
  "aria-label"?: string;
  style?: React.CSSProperties;
};

export function Link({ to, children, end: _end, ...rest }: LinkProps) {
  return (
    <IntlLink href={to} {...rest}>
      {children}
    </IntlLink>
  );
}

/* Nav.tsx passes plain className strings and computes active state itself,
   so NavLink only needs to render a link and forward the click handler. */
export const NavLink = Link;

export function useNavigate() {
  const router = useRouter();
  return (to: string | number) => {
    if (typeof to === "number") {
      if (to < 0) router.back();
      else router.forward();
      return;
    }
    router.push(to);
  };
}

export function useParams<_T extends Record<string, string> = Record<string, string>>() {
  return useNextParams() as unknown as _T;
}

/* Search + hash come from window.location, not next/navigation:
   useSearchParams() in the shared layout breaks static prerendering
   (Next requires a Suspense boundary), and these pages only read the
   query at mount or update it via full client navigations anyway.

   One gap had to be closed: the App Router commits client navigations
   through history.pushState/replaceState, and neither fires popstate. A
   page that rewrites only its query string - the issue finder's filters
   do this on every chip - would leave this hook reading the previous
   query forever, so each new filter would be built from a stale search
   and drop the ones before it. Next's own useSearchParams tracks those
   commits internally; here the two history methods are wrapped once and
   re-read on a private event. */
const LOC_EVENT = "cyrus:location";

declare global {
  interface Window {
    __cyrusLocationPatched?: boolean;
  }
}

function patchHistory() {
  if (typeof window === "undefined" || window.__cyrusLocationPatched) return;
  window.__cyrusLocationPatched = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method] as (state: unknown, title: string, url?: string | null) => void;
    history[method] = ((state: unknown, title: string, url?: string | null) => {
      original.call(history, state, title, url);
      /* the next tick, not now: Next commits the URL from inside an
         insertion effect, and a state update scheduled there is the one
         thing React refuses to do quietly */
      setTimeout(() => window.dispatchEvent(new Event(LOC_EVENT)), 0);
      return undefined;
    }) as History[typeof method];
  }
}

function useWindowLocation() {
  const pathname = usePathname() ?? "";
  const [loc, setLoc] = useState({ search: "", hash: "" });
  useEffect(() => {
    patchHistory();
    /* identical query means identical state, so a navigation that only
       moves the hash or repeats a URL costs no extra render */
    const read = () =>
      setLoc((cur) => {
        const next = { search: window.location.search, hash: window.location.hash };
        return cur.search === next.search && cur.hash === next.hash ? cur : next;
      });
    read();
    window.addEventListener("popstate", read);
    window.addEventListener("hashchange", read);
    window.addEventListener(LOC_EVENT, read);
    return () => {
      window.removeEventListener("popstate", read);
      window.removeEventListener("hashchange", read);
      window.removeEventListener(LOC_EVENT, read);
    };
  }, [pathname]);
  return { pathname, ...loc };
}

export function useLocation() {
  return useWindowLocation();
}

export function useSearchParams(): [URLSearchParams, (next: URLSearchParams | Record<string, string>) => void] {
  const { search } = useWindowLocation();
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const set = (next: URLSearchParams | Record<string, string>) => {
    const qs = (next instanceof URLSearchParams ? next : new URLSearchParams(next)).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
  return [params, set];
}
