/* ══ store.tsx — auth, saved items, toasts, modals, server sync ══ */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "./router";
import { useStored } from "./util";
import type { User } from "./util";
import { api, providerReady, type ServerUser } from "./api";
import { readGoogleRedirectCredential, takeGoogleReturn } from "./google";

interface Store {
  user: User | null;
  signIn: (u: User) => void;
  signOut: () => void;
  saved: string[];
  toggleSaved: (id: string) => boolean;
  savedOrgs: string[];
  toggleSavedOrg: (login: string) => boolean;
  /** drop every followed repository and organization, locally and on the server */
  unfollowAll: () => void;
  downloads: Record<string, number>;
  countDownload: (id: string) => void;
  toast: (msg: string) => void;
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (v: boolean) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  /** server session user when a cross-device backend session is active */
  serverUser: ServerUser | null;
  /** false for the one frame before this browser's stored board has been read;
      a gate uses it to wait instead of flashing the sign-in page at someone
      who is already signed in */
  boardReady: boolean;
  /** re-probe /api/me and merge saved items; call after a server sign-in */
  refreshSession: () => Promise<void>;
}

const Ctx = createContext<Store>(null!);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [userStored, setUser, userReady] = useStored<User | null>("agenthub.user", null);
  const [savedStored, setSaved, savedReady] = useStored<string[]>("agenthub.saved", []);
  const [savedOrgsStored, setSavedOrgs, orgsReady] = useStored<string[]>("agenthub.savedorgs", []);
  const [downloadsStored, setDownloads, dlReady] = useStored<Record<string, number>>("agenthub.downloads", {});
  const [toastMsg, setToastMsg] = useState<{ msg: string; k: number } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [themeStored, setTheme, themeReady] = useStored<"light" | "dark">("agenthub.theme", "dark");

  /* ── what the rest of the app may see on the first paint ──────────
     The prerenderer has no localStorage, so the server pass always renders
     the signed-out visitor. If the client's first render already showed the
     stored session, the avatar and the sign-in button would disagree with
     the HTML React is hydrating, and React 19 tears the tree down. So the
     values handed out below stay at their initial state until the read has
     happened, one frame later. The *stored* values above stay live: every
     write path (sign in, follow, unfollow) must operate on what the browser
     actually holds, never on the frozen placeholder.                    */
  const user = userReady ? userStored : null;
  const saved = savedReady ? savedStored : [];
  const savedOrgs = orgsReady ? savedOrgsStored : [];
  const downloads = dlReady ? downloadsStored : {};

  /* ── server sync layer (safe no-op when the backend is offline) ── */
  const [serverUser, setServerUser] = useState<ServerUser | null>(null);
  const savedRef = useRef(savedStored); savedRef.current = savedStored;
  const orgsRef = useRef(savedOrgsStored); orgsRef.current = savedOrgsStored;
  const titleFor = (id: string) => id.split("/")[1] ?? id;

  const refreshSession = useCallback(async () => {
    const me = await api.me();
    if (!me?.user) { setServerUser(null); return; }
    setServerUser(me.user);
    const list = await api.savedList();
    if (!list) return;
    const sRepos = [...new Set(list.items.filter((i) => i.itemType === "repo").map((i) => i.itemId))];
    const sOrgs = [...new Set(list.items.filter((i) => i.itemType === "org").map((i) => i.itemId))];
    const mine = savedRef.current, ours = orgsRef.current;
    const nextRepos = [...new Set([...sRepos, ...mine])];
    const nextOrgs = [...new Set([...sOrgs, ...ours])];
    if (nextRepos.length !== mine.length || nextOrgs.length !== ours.length) {
      setSaved(nextRepos);
      setSavedOrgs(nextOrgs);
    }
    // push anything this browser has that the server hasn't seen
    for (const id of nextRepos.filter((r) => !sRepos.includes(r))) void api.savedAdd("repo", id, titleFor(id));
    for (const id of nextOrgs.filter((o) => !sOrgs.includes(o))) void api.savedAdd("org", id, titleFor(id));
  }, [setSaved, setSavedOrgs]);

  useEffect(() => { void refreshSession(); }, [refreshSession]);

  /* dark is the default token set; the light variant is opt-out by adding
     .light to <html>, so no class is needed for the default mode */
  const theme = themeReady ? themeStored : "dark";
  useEffect(() => {
    document.documentElement.classList.toggle("light", themeStored === "light");
    document.documentElement.style.colorScheme = themeStored;
  }, [themeStored]);
  const toggleTheme = useCallback(() => setTheme(themeStored === "dark" ? "light" : "dark"), [themeStored, setTheme]);

  const toast = useCallback((msg: string) => setToastMsg({ msg, k: Date.now() }), []);

  /* ── Google's redirect lands here, not in the sign-in sheet ─────────
     Google always returns to the site root with the id_token in the URL
     fragment, on a brand-new document. Finishing the sign-in in the
     component every page is mounted inside means the board is already
     unlocked before a gate can ask, and the visitor lands back on the page
     they left rather than on a sign-in door. */
  const nav = useNavigate();
  const navRef = useRef(nav); navRef.current = nav;
  /* Dev's StrictMode mounts, unmounts and remounts every component, and the
     token can only be read once - so this runs behind a "already landed"
     guard and its timer is deliberately not cancelled. A cleanup here would
     eat the navigation from the first pass and the second pass would have
     nothing left to read. */
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current) return;
    const g = readGoogleRedirectCredential();
    if (!g) return;
    landed.current = true;
    setUser({ name: g.name, provider: "Google", email: g.email, picture: g.picture });
    setAuthOpen(false);
    toast(`Welcome, ${g.name.split(" ")[0]} - signed in with Google.`);
    /* the raw token is the better credential: the server verifies issuer and
       audience itself and answers with its own session cookie */
    if (g.idToken) {
      void (async () => {
        if (await providerReady("google")) { await api.authGoogle(g.idToken!); await refreshSession(); }
      })();
    }
    setTimeout(() => navRef.current(takeGoogleReturn()), 420);
  }, [setUser, setAuthOpen, toast, refreshSession]);

  const signIn = useCallback((u: User) => setUser(u), [setUser]);
  const signOut = useCallback(() => {
    setUser(null);
    if (serverUser) { void api.logout(); setServerUser(null); }
    toast("Signed out");
  }, [setUser, toast, serverUser]);

  const toggleSaved = useCallback((id: string) => {
    const added = !savedStored.includes(id);
    setSaved(added ? [...savedStored, id] : savedStored.filter((x) => x !== id));
    if (serverUser) void (added ? api.savedAdd("repo", id, id.split("/")[1]) : api.savedRemove("repo", id));
    return added;
  }, [savedStored, setSaved, serverUser]);

  const toggleSavedOrg = useCallback((login: string) => {
    const added = !savedOrgsStored.includes(login);
    setSavedOrgs(added ? [...savedOrgsStored, login] : savedOrgsStored.filter((x) => x !== login));
    if (serverUser) void (added ? api.savedAdd("org", login, login) : api.savedRemove("org", login));
    return added;
  }, [savedOrgsStored, setSavedOrgs, serverUser]);

  const unfollowAll = useCallback(() => {
    if (serverUser) {
      for (const id of savedRef.current) void api.savedRemove("repo", id);
      for (const login of orgsRef.current) void api.savedRemove("org", login);
    }
    setSaved([]);
    setSavedOrgs([]);
  }, [setSaved, setSavedOrgs, serverUser]);

  const countDownload = useCallback((id: string) => {
    setDownloads({ ...downloadsStored, [id]: (downloadsStored[id] || 0) + 1 });
  }, [downloadsStored, setDownloads]);

  /* auto-dismiss toast */
  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2600);
    return () => clearTimeout(t);
  }, [toastMsg]);

  /* global ⌘K / "/" palette hotkeys */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement;
      const typing = /INPUT|TEXTAREA|SELECT/.test(ae?.tagName ?? "");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
      else if (e.key === "/" && !typing) { e.preventDefault(); setPaletteOpen(true); }
      else if (e.key === "Escape") { setPaletteOpen(false); setAuthOpen(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Ctx.Provider value={{
      user, signIn, signOut, saved, toggleSaved, savedOrgs, toggleSavedOrg, unfollowAll,
      downloads, countDownload,
      toast: (m: string) => toast(m), authOpen, setAuthOpen, paletteOpen, setPaletteOpen,
      theme, toggleTheme, serverUser, refreshSession, boardReady: userReady,
    }}>
      {children}
      {toastMsg && (
        <div key={toastMsg.k} className="reveal fixed bottom-6 left-1/2 z-[120] -translate-x-1/2 flex items-center gap-2.5 rounded-full bg-coffee border border-roast text-foam px-5.5 py-3 text-[14px] font-semibold shadow-lift">
          <span className="text-accent">✓</span> {toastMsg.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
