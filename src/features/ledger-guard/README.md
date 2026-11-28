# Issue board recovery (`/issues/recovery`)

**Issue:** [#141 — Issue tracking should recover cleanly when a GitHub account is disconnected or changed](https://github.com/adityalenova/cyrus/issues/141)
**Level:** 3

## Problem

The tracked-issue board lives in one browser key (`cyrus.issues.v1`) with no
owner attached. Sign out, sign back in as somebody else, or arrive at a shared
browser, and that board silently becomes the new account's board: entries are
displayed, stages are editable, and nothing records that the author changed.
An expired session looked identical to a fresh install.

Two facts shaped the fix:

1. The server session (`/api/me`) is the only verified identity. A GitHub
   sign-in that reaches the server yields a real `login`; an email sign-in
   yields a verified email.
2. The GitHub popup flow keeps the name, email and avatar in `agenthub.user`,
   but **discards the GitHub login**. So the browser profile can supply an
   email key, never a handle, and it is not proof of anything.

No server-side ownership is invented here. The guard is a local stamp with an
explicit recovery path, and its copy says exactly which identity source it used.

## What was built

- **`src/lib/ledgerIdentity.ts`** — the whole rule, React-free and storage-free.
  A stamp is `{ login, linkedAt }`; `classify(previous, current)` returns one of
  four states; adoption, keep and clear helpers are pure and tested.
- **`src/features/ledger-guard/useLedgerOwnership.ts`** — reads
  `cyrus.ledger.owner.v1`, resolves the current identity, and returns:
  - `ledger` — rows only when they are safe to display (`changed` returns `{}`),
    plus `trackedCount` and `hiddenCount` so the page can explain the gap;
  - `guarded` — `add`/`toggle`/`setStage`/`remove`/`clear`, all refused when the
    state forbids writing; a first write to an empty board adopts the stamp;
  - `keepBoard`, `exportJson`, `clearBoard` — the three explicit recovery
    actions, the only writes that bypass the guard.
- **`/issues/recovery`** — the identity card (account, source, verified or not,
  stamp age, row count), a state card with `role="status"`/`role="alert"`, the
  three actions, a migration callout for pre-stamp boards, a board preview that
  renders no URLs while the account is changed, and an honest "what the guard
  can see" list.
- **Migration without deletion.** A board with entries and no stamp is
  `unclaimed` and read-only until *Keep this board on this account* writes a
  stamp. Nothing is rewritten. An **empty** board may be adopted automatically:
  there is no saved data to leak, so the stamp simply follows the active account.
- **Export** is `cyrus.ledger.export.v1`: `schema`, `exportedAt`, `owner`,
  `currentIdentity`, `count`, and entries sorted by `added` then URL, each with
  `url`, `stage`, `added`, `meta` (or `null`). Every stored value survives; no
  row is dropped. Works in all four states, including `changed`.

### States

| State | Meaning | Display | Writes |
| --- | --- | --- | --- |
| `same` | stamp and session agree | rows shown | allowed |
| `changed` | stamp names another account | rows hidden, count shown | refused while rows exist |
| `unlinked` | stamp exists, no session | rows shown | allowed (no second account to leak into) |
| `unclaimed` | no stamp yet | rows shown | empty board: allowed and auto-stamped; populated board: refused until Keep |

## File map

| Path | Role |
| --- | --- |
| `src/lib/ledgerIdentity.ts` | pure stamp, classification, adoption, export |
| `src/features/ledger-guard/model.ts` | identity-source resolution and all state copy |
| `src/features/ledger-guard/useLedgerOwnership.ts` | hook: gated reads, guarded writes, recovery actions |
| `src/features/ledger-guard/LedgerRecovery.tsx` | the recovery page |
| `src/features/ledger-guard/model.test.ts` | 34 node-only tests |
| `src/app/[locale]/issues/recovery/page.tsx` | route + metadata + canonical |

## Data sources and as-of date

Nothing here reads the repository catalog, so there is no crawl snapshot to
name. The feature reads four live browser/server surfaces, inspected on
**2026-11-22**:

- `/api/me` — server session. `login` is verified by the OAuth exchange;
  otherwise the verified account `email` is used as the key.
- `agenthub.user` — browser profile written by the sign-in sheet and the Google
  redirect. Used only when no server session exists; marked **unverified**.
- `cyrus.issues.v1` — the board, read through `useIssueLedger`.
- `cyrus.ledger.owner.v1` — the owner stamp this feature writes.

Keys are lower-cased and a pasted `@` is stripped. A display name is never used
as a key, because two accounts can share one.

## Limitations

- **No GitHub login in the browser profile.** The popup sign-in throws it away.
  Until the server session answers with a login, an email is the strongest key;
  a GitHub-only browser profile with no email has no key and the guard says so.
- **A shared address is indistinguishable.** Two people using one verified
  email look like one owner. The guard protects account transitions, not people.
- **Signed-out access stays local.** With no session there is no boundary to
  cross, so the board stays readable and editable. The next different sign-in is
  blocked before display; the guard cannot know who was at the keyboard before.
- **Per browser, not per account.** Clearing or keeping changes this browser's
  board only. The stamp is not a server permission and does not travel.
- **Enforcement lives in the hook.** Surfaces that still call `useIssueLedger`
  directly bypass the guard; `/issues` does so in this commit because that view
  is outside this feature's file set. Swap it for `useLedgerOwnership().guarded`
  to enforce the same rule there.
- **A changed identity with zero rows re-stamps silently.** There is nothing to
  protect, so it does not interrupt the visitor.

## Tests

```bash
node ../../node_modules/vitest/vitest.mjs run src/features/ledger-guard
```

Covers every classification transition (including disconnect → reconnect same →
disconnect → reconnect different), malformed stamps, adoption rules for empty
and populated boards, keep/clear stamping, the write/display gates, export
ordering and schema round-trip, and identity-source precedence.
