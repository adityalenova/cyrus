import { describe, expect, it, vi } from "vitest";
import { bookmarkHref, bookmarkKey, filterBookmarks } from "./bookmarks";
import { createBookmarkSync } from "./bookmarkSync";

it("filters and sorts saved items without mutating the input or confusing item types", () => {
  const items = [{ itemType: "repo", itemId: "a/repo", title: "Zeta", createdAt: "2026-01-01" }, { itemType: "program", itemId: "gsoc", title: "Alpha", createdAt: "2026-02-01" }];
  expect(filterBookmarks(items, "alpha", "all", "name")).toEqual([items[1]]);
  expect(filterBookmarks(items, "", "repo", "newest")).toEqual([items[0]]);
  expect(filterBookmarks(items, "", "all", "name").map(item => item.title)).toEqual(["Alpha", "Zeta"]);
  expect(items[0].title).toBe("Zeta");
  expect(bookmarkKey({ itemType: "repo", itemId: "same" })).not.toBe(bookmarkKey({ itemType: "org", itemId: "same" }));
});
it("constructs known catalog links and never trusts saved metadata as a destination", () => {
  expect(bookmarkHref({ itemType: "org", itemId: "example" })).toBe("/organizations/example");
  expect(bookmarkHref({ itemType: "repo", itemId: "one/two" })).toBe("/repo/one%2Ftwo");
  expect(bookmarkHref({ itemType: "program", itemId: "gsoc" })).toBe("/programs/gsoc");
  expect(bookmarkHref({ itemType: "repo", itemId: "https://summerofcode.withgoogle.com/projects/example" })).toBe("https://summerofcode.withgoogle.com/projects/example");
  for (const itemId of ["javascript:alert(1)", "http://unsafe.example/", "https://user:secret@example.test/project", "//example.test"]) expect(bookmarkHref({ itemType: "repo", itemId })).toBeNull();
  for (const itemId of ["javascript:alert(1)", "https://evil.example/", "//evil.example"]) expect(bookmarkHref({ itemType: "org", itemId })).toBeNull();
});

describe("ordered optimistic bookmark sync", () => {
  it("restores the last confirmed state when two consecutive choices both fail", async () => {
    const rollback = vi.fn(), failed = vi.fn(), send = vi.fn(async () => false);
    const sync = createBookmarkSync(send, () => "owner", failed);
    sync.enqueue("repo", "one/two", true, rollback); sync.enqueue("repo", "one/two", false, rollback);
    await sync.flush(); expect(send).toHaveBeenCalledTimes(2);
    expect(rollback).toHaveBeenCalledExactlyOnceWith(false); expect(failed).toHaveBeenCalledTimes(1);
  });
  it("lets refresh wait for pending writes before reading the server snapshot", async () => {
    const finish: ((ok: boolean) => void)[] = []; let flushed = false;
    const sync = createBookmarkSync(() => new Promise(resolve => { finish.push(resolve); }), () => "owner", vi.fn());
    sync.enqueue("repo", "one/two", true, vi.fn());
    const done = sync.flush().then(() => { flushed = true; });
    await vi.waitFor(() => expect(finish).toHaveLength(1)); expect(flushed).toBe(false);
    sync.enqueue("repo", "one/two", false, vi.fn()); finish[0](true);
    await vi.waitFor(() => expect(finish).toHaveLength(2)); expect(flushed).toBe(false);
    finish[1](true); await done; expect(flushed).toBe(true);
  });
  it("serializes rapid changes and prevents an older error from undoing the latest choice", async () => {
    let finish!: (ok: boolean) => void;
    const send = vi.fn().mockImplementationOnce(() => new Promise<boolean>(resolve => { finish = resolve; })).mockResolvedValue(true);
    const rollback = vi.fn(), failed = vi.fn(), sync = createBookmarkSync(send, () => "owner", failed);
    sync.enqueue("repo", "a/b", true, rollback); sync.enqueue("repo", "a/b", false, rollback);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    finish(false); await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls.map(call => call[2])).toEqual([true, false]); expect(rollback).not.toHaveBeenCalled(); expect(failed).not.toHaveBeenCalled();
  });
  it("rolls back the latest rejected mutation but never modifies a different account", async () => {
    const rollback = vi.fn(), failed = vi.fn(); let owner: string | null = "one";
    const sync = createBookmarkSync(async () => false, () => owner, failed);
    sync.enqueue("program", "gsoc", true, rollback); await vi.waitFor(() => expect(rollback).toHaveBeenCalledTimes(1));
    owner = null; sync.enqueue("program", "gsoc", true, rollback); await Promise.resolve(); expect(rollback).toHaveBeenCalledTimes(1);
    let finish!: (ok: boolean) => void; owner = "one";
    const queued = createBookmarkSync(() => new Promise(resolve => { finish = resolve; }), () => owner, failed);
    queued.enqueue("org", "example", true, rollback); await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
    owner = "two"; finish(false); await Promise.resolve(); await Promise.resolve(); expect(rollback).toHaveBeenCalledTimes(1);
  });
});
