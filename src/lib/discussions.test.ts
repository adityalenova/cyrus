/* ══ discussions.test.ts — nothing a reader types may surprise the tree
   The parser is the XSS boundary and the tree is where a reply can hide,
   so both are pinned here with small fixtures instead of eyeballed in the
   browser. The component renders these tokens, never raw HTML. ═ */
import { describe, expect, it } from "vitest";
import {
  MAX_BODY, MAX_DEPTH, MAX_TITLE, applyVote, buildTree, clampTitle, cleanBody, countReplies,
  depthForReply, excerpt, flattenTree, parseBody, plainText, safeHref, scoreOf, validBody,
  validFlagReason, validProjectId, validProjectKind, validVote,
} from "./discussions";
import type { RawComment, SortKey } from "./discussions";

const c = (p: Partial<RawComment> & { id: string }): RawComment => ({
  parentId: null, author: "Akhil", authorLogin: "akhil", body: "hi",
  createdAt: 1000, upvotes: 0, downvotes: 0, myVote: 0, flagged: false, flagReason: null, ...p,
});

const asText = (s: string) => plainText(parseBody(s));
const kinds = (s: string) => parseBody(s).map((g) => g.kind);
const toks = (s: string) => parseBody(s)[0]?.tokens ?? [];

describe("what a body may contain", () => {
  it("normalises newlines and drops control and zero-width characters", () => {
    expect(cleanBody("a\r\nb")).toBe("a\nb");
    expect(cleanBody("a" + String.fromCharCode(0) + "b" + String.fromCharCode(0x200b) + "c" + String.fromCharCode(0xfeff))).toBe("abc");
    expect(cleanBody("long".repeat(MAX_BODY)).length).toBe(MAX_BODY);
    expect(cleanBody(null)).toBe("");
  });

  it("treats whitespace as an empty post", () => {
    expect(validBody("   \n ")).toBe(false);
    expect(validBody("ship it")).toBe(true);
    expect(validBody(42)).toBe(false);
  });

  it("flattens a title onto one line and caps it", () => {
    expect(clampTitle("  GSoC\n  ideas   here ")).toBe("GSoC ideas here");
    expect(clampTitle("x".repeat(500)).length).toBe(MAX_TITLE);
  });

  it("accepts only http(s) targets", () => {
    expect(safeHref("https://cyrus.ai/docs")).toBe("https://cyrus.ai/docs");
    expect(safeHref("http://localhost:3000")).toBe("http://localhost:3000/");
    expect(safeHref("https://example.com.")).toBe("https://example.com/");
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html;base64,PHNjcmlwdD4=")).toBeNull();
    expect(safeHref("mailto:a@b.co")).toBeNull();
    expect(safeHref("https://")).toBeNull();
  });

  it("validates the route's loose inputs", () => {
    expect(validProjectKind("repo")).toBe(true);
    expect(validProjectKind("hackathon")).toBe(false);
    expect(validProjectId("owner/name")).toBe(true);
    expect(validProjectId("   ")).toBe(false);
    expect(validVote(-1) && validVote(0) && validVote(1)).toBe(true);
    expect(validVote("1" as unknown)).toBe(false);
    expect(validFlagReason("spam") && !validFlagReason("please")).toBe(true);
  });
});

describe("markdown-lite parsing", () => {
  it("renders the handful of marks a contributor expects", () => {
    expect(toks("**strong** and _em_ and `x`")).toEqual([
      { t: "bold", v: "strong" },
      { t: "text", v: " and " },
      { t: "italic", v: "em" },
      { t: "text", v: " and " },
      { t: "code", v: "x" },
    ]);
  });

  it("does not italicise the underscores inside an identifier", () => {
    expect(toks("use my_var_name here")).toEqual([{ t: "text", v: "use my_var_name here" }]);
  });

  it("links a label, a bare url, and refuses a dangerous one", () => {
    expect(toks("[docs](https://cyrus.ai)")).toEqual([{ t: "link", v: "docs", href: "https://cyrus.ai/" }]);
    expect(toks("see https://cyrus.ai/x now")[2]).toEqual({ t: "text", v: " now" });
    expect(toks("[click](javascript:alert(1))")).toEqual([{ t: "text", v: "[click](javascript:alert(1))" }]);
  });

  it("keeps a fenced block verbatim, including markup", () => {
    const src = "before\n\n```js\nconst a = 1;\n<b>bold?</b>\n```\n\nafter";
    const segs = parseBody(src);
    expect(kinds(src)).toEqual(["p", "code", "p"]);
    const code = segs[1];
    expect(code.text).toBe("const a = 1;\n<b>bold?</b>");
    expect(code.lang).toBe("js");
    expect(code.tokens).toBeUndefined();
  });

  it("still renders a fence nobody closed", () => {
    const segs = parseBody("```\n<script>alert(1)</script>");
    expect(segs).toEqual([{ kind: "code", text: "<script>alert(1)</script>", lang: "" }]);
  });

  it("splits paragraphs on a blank line and breaks on a single one", () => {
    expect(kinds("one\nstill one\n\ntwo")).toEqual(["p", "p"]);
    expect(toks("one\ntwo")[1]).toEqual({ t: "break", v: "\n" });
  });

  it("says nothing about an empty body", () => {
    expect(parseBody("   \n\n  ")).toEqual([]);
    expect(asText("")).toBe("");
  });

  it("quotes and counts with the same text a reader sees", () => {
    expect(asText("**hello** world")).toBe("hello world");
    expect(excerpt("word ".repeat(80), 40)).toHaveLength(40); // 39 characters plus the ellipsis
    expect(excerpt("short one")).toBe("short one");
  });
});

describe("the thread tree", () => {
  const rows: RawComment[] = [
    c({ id: "r1", body: "first", createdAt: 30, upvotes: 1 }),
    c({ id: "r2", body: "popular", createdAt: 10, upvotes: 9, downvotes: 2 }),
    c({ id: "a", parentId: "r2", createdAt: 20 }),
    c({ id: "b", parentId: "a", createdAt: 25 }),
    c({ id: "orphan", parentId: "gone", createdAt: 5 }),
  ];

  it("roots replies whose parent is not in the batch", () => {
    const tree = buildTree(rows, "new");
    expect(tree.map((n) => n.id)).toEqual(["r1", "r2", "orphan"]);
  });

  it("sorts the roots and keeps answers oldest first", () => {
    expect(buildTree(rows, "top").map((n) => n.id)).toEqual(["r2", "r1", "orphan"]);
    expect(scoreOf(rows[1])).toBe(7);
    const r2 = buildTree(rows, "top")[0];
    expect(r2.children.map((n) => n.id)).toEqual(["a"]);
    expect(r2.replies).toBe(2);
    expect(r2.children[0].children[0].id).toBe("b");
    expect(flattenTree([r2]).map((n) => n.id)).toEqual(["r2", "a", "b"]);
  });

  it("nests no deeper than the cap and flattens what is past it", () => {
    const deep: RawComment[] = [c({ id: "0", createdAt: 0 })];
    for (let i = 1; i <= 6; i++) deep.push(c({ id: String(i), parentId: String(i - 1), createdAt: i }));
    const tree = buildTree(deep, "old");
    const flat = flattenTree(tree);
    expect(Math.max(...flat.map((n) => n.depth))).toBe(MAX_DEPTH);
    // every node is still rendered exactly once
    expect(flat.length).toBe(deep.length);
    expect(tree[0].replies).toBe(6);
  });

  it("answers an empty board", () => {
    expect(buildTree([], "new")).toEqual([]);
    expect(countReplies(rows)).toBe(2);
    expect(depthForReply(null)).toBe(0);
    const node = buildTree(rows, "top")[0].children[0];
    expect(depthForReply(node)).toBe(2);
  });

  it("orders by the key the selector offers", () => {
    const ids = (s: SortKey) => buildTree(rows, s).map((n) => n.id);
    expect(ids("old")[0]).toBe("orphan");
    expect(ids("old")[1]).toBe("r2");
    expect(ids("new")[0]).toBe("r1");
  });
});

describe("voting", () => {
  const base = { upvotes: 3, downvotes: 1, myVote: 0 as const };

  it("adds a fresh vote", () => {
    expect(applyVote(base, 1)).toEqual({ upvotes: 4, downvotes: 1, myVote: 1 });
  });

  it("flips a vote the other way", () => {
    expect(applyVote({ ...base, myVote: 1 }, -1)).toEqual({ upvotes: 2, downvotes: 2, myVote: -1 });
  });

  it("clears when the same arrow is clicked again", () => {
    expect(applyVote({ ...base, myVote: -1 }, 0)).toEqual({ upvotes: 3, downvotes: 0, myVote: 0 });
  });

  it("cannot go below zero on stale counts", () => {
    expect(applyVote({ upvotes: 0, downvotes: 0, myVote: 1 }, 0).upvotes).toBe(0);
  });
});
