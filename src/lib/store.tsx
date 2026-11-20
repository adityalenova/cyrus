/* ══ store.tsx — auth, saved items, toasts, modals, server sync ══ */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "./router";
import { useStored } from "./util";
import type { User } from "./util";
import { api, providerReady, type ServerUser } from "./api";
import { readGoogleRedirectCredential, takeGoogleReturn } from "./google";
import { createBookmarkSync } from "./bookmarkSync";
import { createImportCheckpoints, pendingImports, planImports, type ImportLedger } from "./bookmarkImports";

interface Store {
  user: User | null;
  signIn: (u: User) => void;
  signOut: () => void;
  saved: string[];
  toggleSaved: (id: string, title?: string) => boolean;
  savedOrgs: string[];
  toggleSavedOrg: (login: string) => boolean;
  savedPrograms: string[];
  toggleSavedProgram: (id: string, title?: string) => boolean;
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
  flushBookmarks: () => Promise<void>;
}

const Ctx = createContext<Store>(null!);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [userStored, setUser, userReady] = useStored<User | null>("agenthub.user", null);
  const [savedStored, setSaved, savedReady] = useStored<string[]>("agenthub.saved", []);
  const [savedOrgsStored, setSavedOrgs, orgsReady] = useStored<string[]>("agenthub.savedorgs", []);
  const [programsStored, setPrograms, programsReady] = useStored<string[]>("agenthub.savedprograms", []);
  const [importsStored, setImports] = useStored<ImportLedger>("agenthub.bookmarkimports", {});
  const [savedOwner, setSavedOwner] = useStored<string | null>("agenthub.savedowner", null);
  const [downloadsStored, setDownloads, dlReady] = useStored<Record<string, number>>("agenthub.downloads", {});
  const [toastMsg, setToastMsg] = useState<{ msg: string; k: number } | null>(null);
  const toast = useCallback((msg: string) => setToastMsg({ msg, k: Date.now() }), []);
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
  const savedPrograms = programsReady ? programsStored : [];
  const downloads = dlReady ? downloadsStored : {};

  /* ── server sync layer (safe no-op when the backend is offline) ── */
  const [serverUser, setServerUser] = useState<ServerUser | null>(null);
  const savedRef = useRef(savedStored); savedRef.current = savedStored;
  const orgsRef = useRef(savedOrgsStored); orgsRef.current = savedOrgsStored;
  const programsRef = useRef(programsStored); programsRef.current = programsStored;
  const ownerRef = useRef(savedOwner); ownerRef.current = savedOwner;
  const importsRef = useRef(importsStored); importsRef.current = importsStored;
  const identityPending = useRef(true), identityEdits = useRef<{ write: () => void; discard: () => void }[]>([]);
  const importCheckpoints = useRef<ReturnType<typeof createImportCheckpoints> | null>(null);
  if (!importCheckpoints.current) importCheckpoints.current = createImportCheckpoints(() => window.localStorage);
  const checkpointWarning = useRef(false);
  const serverId = useRef<string | null>(null), sessionVersion = useRef(0), bookmarkVersion = useRef(0);
  const sync = useRef<ReturnType<typeof createBookmarkSync> | null>(null);
  const titleFor = (id: string) => id.split("/")[1] ?? id;
  function checkpointImports(owner: string, items: ReturnType<typeof pendingImports>) {
    items = items.filter(item => !importCheckpoints.current!.has(owner, item));
    const next = { ...importsRef.current }; if (items.length) next[owner] = items; else delete next[owner];
    importsRef.current = next; setImports(next);
  }
  function completeImport(owner: string, type: string, id: string) {
    const pending = pendingImports(importsRef.current, owner);
    const item = pending.find(item => item.itemType === type && item.itemId === id);
    if (!item) return;
    if (!importCheckpoints.current!.finish(owner, item) && !checkpointWarning.current) {
      checkpointWarning.current = true;
      toast("Could not save import retry checkpoints in this browser. They are kept only in this tab until browser storage is available.");
    }
    checkpointImports(owner, pending.filter(item => item.itemType !== type || item.itemId !== id));
  }
  function enqueueEdit(type: string, id: string, added: boolean, rollback: (saved: boolean) => void, title?: string) {
    const write = () => { void sync.current!.enqueue(type, id, added, rollback, title); };
    const owner = ownerRef.current;
    const discard = () => { if (!added && owner) completeImport(owner, type, id); };
    if (serverId.current) write();
    else if (identityPending.current) identityEdits.current.push({ write, discard });
    else discard();
  }

  const refreshSession = useCallback(async (): Promise<void> => {
    const version = ++sessionVersion.current;
    await sync.current?.flush();
    if (version !== sessionVersion.current) return;
    if (!serverId.current) identityPending.current = true;
    const me = await api.me();
    if (version !== sessionVersion.current) return;
    identityPending.current = false;
    const edits = identityEdits.current; identityEdits.current = [];
    if (!me?.user) { serverId.current = null; for (const edit of edits) edit.discard(); setServerUser(null); return; }
    const owner = me.user.id;
    serverId.current = owner;
    setServerUser(me.user);
    for (const edit of edits) edit.write();
    await sync.current?.flush();
    if (version !== sessionVersion.current) return;
    const savedVersion = bookmarkVersion.current;
    const list = await api.savedList();
    if (!list || version !== sessionVersion.current) return;
    if (savedVersion !== bookmarkVersion.current) { await refreshSession(); return; }
    const mine = savedRef.current, ours = orgsRef.current;
    const migrate = ownerRef.current === null;
    const planned = planImports([
      ...mine.map(itemId => ({ itemType: "repo" as const, itemId, title: titleFor(itemId) })),
      ...ours.map(itemId => ({ itemType: "org" as const, itemId, title: itemId })),
      ...programsRef.current.map(itemId => ({ itemType: "program" as const, itemId, title: itemId })),
    ], list.items, pendingImports(importsRef.current, owner), migrate, item => importCheckpoints.current!.has(owner, item));
    checkpointImports(owner, planned.pending);
    ownerRef.current = owner; setSavedOwner(owner);
    const nextRepos = [...new Set(planned.items.filter(item => item.itemType === "repo").map(item => item.itemId))];
    const nextOrgs = [...new Set(planned.items.filter(item => item.itemType === "org").map(item => item.itemId))];
    const nextPrograms = [...new Set(planned.items.filter(item => item.itemType === "program").map(item => item.itemId))];
    if (!migrate && (mine.some(id => !nextRepos.includes(id)) || ours.some(id => !nextOrgs.includes(id)) || programsRef.current.some(id => !nextPrograms.includes(id)))) toast("Your account's saved bookmarks replaced this browser's local selections. Save any local-only items again while signed in to keep them on this account.");
    savedRef.current = nextRepos; orgsRef.current = nextOrgs; programsRef.current = nextPrograms;
    setSaved(nextRepos); setSavedOrgs(nextOrgs); setPrograms(nextPrograms);
    // push anything this browser has that the server hasn't seen
    await Promise.all(planned.pending.filter(item => !importCheckpoints.current!.has(owner, item)).map(item => sync.current!.enqueue(item.itemType, item.itemId, true, () => {}, item.title)));
  }, [setSaved, setSavedOrgs, setPrograms, setSavedOwner, setImports, toast]);

  useEffect(() => { void refreshSession(); }, [refreshSession]);
  useEffect(() => () => { serverId.current = null; sessionVersion.current++; }, []);

  /* dark is the default token set; the light variant is opt-out by adding
     .light to <html>, so no class is needed for the default mode */
  const theme = themeReady ? themeStored : "dark";
  useEffect(() => {
    document.documentElement.classList.toggle("light", themeStored === "light");
    document.documentElement.style.colorScheme = themeStored;
  }, [themeStored]);
  const toggleTheme = useCallback(() => setTheme(themeStored === "dark" ? "light" : "dark"), [themeStored, setTheme]);

  if (!sync.current) sync.current = createBookmarkSync(async (type, id, added, title) => {
    const owner = serverId.current;
    const ok = await (added ? api.savedAdd(type, id, title) : api.savedRemove(type, id));
    if (ok && owner) completeImport(owner, type, id);
    return ok;
  }, () => serverId.current, () => toast("Could not sync that bookmark. Rejected changes were not confirmed; refresh bookmarks to retry."));

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
    sessionVersion.current++; serverId.current = null;
    identityPending.current = false;
    const edits = identityEdits.current; identityEdits.current = [];
    for (const edit of edits) edit.discard();
    setUser(null);
    if (serverUser) { void api.logout(); setServerUser(null); }
    toast("Signed out");
  }, [setUser, toast, serverUser]);

  const toggleSaved = useCallback((id: string, title?: string) => {
    bookmarkVersion.current++;
    const added = !savedRef.current.includes(id);
    savedRef.current = added ? [...savedRef.current, id] : savedRef.current.filter(x => x !== id); setSaved(savedRef.current);
    enqueueEdit("repo", id, added, confirmed => { savedRef.current = confirmed ? [...new Set([...savedRef.current, id])] : savedRef.current.filter(x => x !== id); setSaved(savedRef.current); }, title ?? id.split("/")[1]);
    return added;
  }, [setSaved]);

  const toggleSavedOrg = useCallback((login: string) => {
    bookmarkVersion.current++;
    const added = !orgsRef.current.includes(login);
    orgsRef.current = added ? [...orgsRef.current, login] : orgsRef.current.filter(x => x !== login); setSavedOrgs(orgsRef.current);
    enqueueEdit("org", login, added, confirmed => { orgsRef.current = confirmed ? [...new Set([...orgsRef.current, login])] : orgsRef.current.filter(x => x !== login); setSavedOrgs(orgsRef.current); }, login);
    return added;
  }, [setSavedOrgs]);

  const toggleSavedProgram = useCallback((id: string, title?: string) => {
    bookmarkVersion.current++;
    const added = !programsRef.current.includes(id);
    programsRef.current = added ? [...programsRef.current, id] : programsRef.current.filter(x => x !== id); setPrograms(programsRef.current);
    enqueueEdit("program", id, added, confirmed => { programsRef.current = confirmed ? [...new Set([...programsRef.current, id])] : programsRef.current.filter(x => x !== id); setPrograms(programsRef.current); }, title ?? id);
    return added;
  }, [setPrograms]);

  const unfollowAll = useCallback(() => {
    for (const id of [...savedRef.current]) toggleSaved(id);
    for (const login of [...orgsRef.current]) toggleSavedOrg(login);
    for (const id of [...programsRef.current]) toggleSavedProgram(id);
  }, [toggleSaved, toggleSavedOrg, toggleSavedProgram]);

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
      user, signIn, signOut, saved, toggleSaved, savedOrgs, toggleSavedOrg, savedPrograms, toggleSavedProgram, unfollowAll,
      downloads, countDownload,
      toast: (m: string) => toast(m), authOpen, setAuthOpen, paletteOpen, setPaletteOpen,
      theme, toggleTheme, serverUser, refreshSession, flushBookmarks: () => sync.current!.flush(), boardReady: userReady,
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
