// Serialize writes per bookmark; an older failure must not undo a newer choice.
export function createBookmarkSync(send: (type: string, id: string, added: boolean, title?: string) => Promise<boolean>, owner: () => string | null, failed: () => void) {
  const tails = new Map<string, Promise<void>>(), versions = new Map<string, number>();
  const confirmed = new Map<string, boolean>();
  const enqueue = (type: string, id: string, added: boolean, rollback: (saved: boolean) => void, title?: string) => {
    const account = owner(); if (!account) return;
    const key = JSON.stringify([account, type, id]), version = (versions.get(key) ?? 0) + 1;
    versions.set(key, version);
    if (!confirmed.has(key)) confirmed.set(key, !added);
    const next = (tails.get(key) ?? Promise.resolve()).then(async () => {
      if (owner() !== account) return;
      const ok = await send(type, id, added, title).catch(() => false);
      if (ok) confirmed.set(key, added);
      else if (owner() === account && versions.get(key) === version) { rollback(confirmed.get(key)!); failed(); }
    }).finally(() => { if (tails.get(key) === next) { tails.delete(key); versions.delete(key); confirmed.delete(key); } });
    tails.set(key, next);
  };
  return { enqueue, flush: async () => { while (tails.size) await Promise.all([...tails.values()]); } };
}
