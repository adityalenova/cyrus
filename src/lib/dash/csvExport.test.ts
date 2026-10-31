import { describe, expect, it } from "vitest";
import { escapeCsvCell, trackedIssuesToCsv, type TrackedIssueCsvRow } from "./csvExport";

describe("escapeCsvCell", () => {
  it("converts null and undefined to empty strings", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("leaves standard text and numbers untouched", () => {
    expect(escapeCsvCell("vercel/next.js")).toBe("vercel/next.js");
    expect(escapeCsvCell(123)).toBe("123");
  });

  it("wraps strings containing commas in quotes", () => {
    expect(escapeCsvCell("Hello, world")).toBe('"Hello, world"');
  });

  it("escapes quotes by doubling them", () => {
    expect(escapeCsvCell('Fix "flaky" test')).toBe('"Fix ""flaky"" test"');
  });

  it("wraps strings with newlines in quotes", () => {
    expect(escapeCsvCell("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
  });
});

describe("trackedIssuesToCsv", () => {
  it("outputs header row when given an empty list", () => {
    const csv = trackedIssuesToCsv([]);
    expect(csv).toBe("Repo,Number,Title,URL,Stage,Language,Stars,Labels,Beginner,Added,Updated");
  });

  it("serializes tracked issue rows with correct escaping", () => {
    const sample: TrackedIssueCsvRow[] = [
      {
        repo: "facebook/react",
        number: 101,
        title: 'Fix issue with "suspense", fast refresh',
        url: "https://github.com/facebook/react/issues/101",
        stage: "Working on it",
        lang: "TypeScript",
        stars: 220000,
        labels: ["bug", "compiler"],
        beginner: false,
        added: "2026-10-25",
        updated: "2026-10-28",
      },
      {
        repo: "vercel/next.js",
        number: 404,
        title: "Clean route cache",
        url: "https://github.com/vercel/next.js/issues/404",
        stage: "Saved",
        lang: null,
        stars: 0,
        labels: [],
        beginner: true,
        added: "2026-10-29",
        updated: null,
      },
    ];

    const csv = trackedIssuesToCsv(sample);
    const lines = csv.split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("Repo,Number,Title,URL,Stage,Language,Stars,Labels,Beginner,Added,Updated");
    expect(lines[1]).toBe(
      'facebook/react,101,"Fix issue with ""suspense"", fast refresh",https://github.com/facebook/react/issues/101,Working on it,TypeScript,220000,bug; compiler,no,2026-10-25,2026-10-28'
    );
    expect(lines[2]).toBe(
      "vercel/next.js,404,Clean route cache,https://github.com/vercel/next.js/issues/404,Saved,,0,,yes,2026-10-29,"
    );
  });
});
