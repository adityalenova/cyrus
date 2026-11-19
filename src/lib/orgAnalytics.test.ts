/* ══ orgAnalytics.test.ts — the board's numbers, on a fixture ═════════
   The dashboard only ever shows what these functions return, so the
   windowing, the growth tally and the period comparison are checked
   against a hand-written archive where the expected counts are obvious.
   ═ */
import { describe, expect, it } from "vitest";
import {
  compare, delta, firstYear, knownYears, orgDetail, orgSlices, priorYears,
  rangeYears, sectorMix, statsFor, techMix, topOrgs, yearSeries, type RankBy,
} from "./orgAnalytics";
import type { OrgStatRow } from "./orgStats";

function row(partial: Partial<OrgStatRow> & { key: string; years: number[] }): OrgStatRow {
  return {
    name: partial.key, login: partial.key, site: "", desc: "", sector: "Other", techs: [],
    projects: 0, nprograms: 0, stars: 0, repos: 0, issues: 0, logo: "", from: [],
    programs: [], ...partial,
  } as OrgStatRow;
}

/* a tiny archive: a long runner, two recent joiners and one that quit */
const ARCHIVE: OrgStatRow[] = [
  row({ key: "old", name: "Old Timer", years: [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026], projects: 100, sector: "Science", stars: 900, issues: 9, techs: ["python", "c++"] }),
  row({ key: "new", name: "Newcomer", years: [2025, 2026], projects: 40, sector: "Web", stars: 50, issues: 3, techs: ["python", "react"] }),
  row({ key: "joiner", name: "Joiner", years: [2026], projects: 10, sector: "Web", stars: 20, issues: 1, techs: ["go"] }),
  row({ key: "quit", name: "Quit In 2020", years: [2016, 2017, 2018, 2019, 2020], projects: 60, sector: "Tools", stars: 300, issues: 7, techs: ["c++"] }),
];

describe("years", () => {
  it("lists the seasons the archive actually mentions", () => {
    expect(knownYears(ARCHIVE)).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(knownYears([])).toEqual([]);
  });

  it("counts back from the newest season, not from today", () => {
    expect(rangeYears(ARCHIVE, "3y")).toEqual([2024, 2025, 2026]);
    expect(rangeYears(ARCHIVE, "all")).toHaveLength(11);
  });

  it("does not invent years before the archive starts", () => {
    expect(rangeYears([row({ key: "only", years: [2026] })], "10y")).toEqual([2026]);
    expect(rangeYears([], "5y")).toEqual([]);
  });

  it("pairs a window with the equally long block before it", () => {
    const w = rangeYears(ARCHIVE, "3y");
    expect(priorYears(w)).toEqual([2021, 2022, 2023]);
    expect(priorYears([])).toEqual([]);
  });

  it("reads the first season a row appears in", () => {
    expect(firstYear(ARCHIVE[3])).toBe(2016);
    expect(firstYear(row({ key: "never", years: [] }))).toBe(0);
  });
});

describe("series", () => {
  it("tallies participation and newcomers per year", () => {
    const s = yearSeries(ARCHIVE, [2025, 2026]);
    expect(s).toEqual([
      { year: 2025, orgs: 2, newcomers: 1, projects: 140 },
      { year: 2026, orgs: 3, newcomers: 1, projects: 150 },
    ]);
  });

  it("keeps a dead year as a zero instead of dropping it", () => {
    const sparse = [row({ key: "a", years: [2020, 2022] })];
    expect(yearSeries(sparse, [2020, 2021, 2022]).map((p) => p.orgs)).toEqual([1, 0, 1]);
  });
});

describe("window totals", () => {
  it("sums the organizations seen anywhere in the window", () => {
    expect(statsFor(ARCHIVE, [2024, 2025, 2026])).toMatchObject({ orgs: 3, newcomers: 2, projects: 150 });
    expect(statsFor(ARCHIVE, [2016, 2017]).orgs).toBe(2);
    expect(statsFor(ARCHIVE, []).orgs).toBe(0);
  });

  it("only counts an organization as new inside the window it joined", () => {
    expect(statsFor(ARCHIVE, [2016, 2017, 2018]).newcomers).toBe(2);
    expect(statsFor(ARCHIVE, [2024, 2025, 2026]).newcomers).toBe(2); // Newcomer + Joiner
  });
});

describe("period comparison", () => {
  it("reports the change and its percentage", () => {
    expect(delta(6, 4)).toEqual({ now: 6, before: 4, change: 2, pct: 0.5 });
    expect(delta(3, 0).pct).toBeNull();
  });

  it("compares every headline metric against the block before", () => {
    const d = compare(ARCHIVE, [2024, 2025, 2026], [2021, 2022, 2023]);
    expect(d.orgs.now).toBe(3);
    expect(d.orgs.before).toBe(1); // only the long runner was there 2021-23
    expect(d.newcomers.now).toBe(2);
    expect(d.newcomers.before).toBe(0);
    expect(d.projects.change).toBe(50);
  });
});

describe("organization rows", () => {
  const win = [2024, 2025, 2026];
  const slices = orgSlices(ARCHIVE, win);

  it("trims each row's seasons to the window", () => {
    expect(slices.find((s) => s.key === "quit")).toBeUndefined();
    expect(slices.find((s) => s.key === "old")!.active).toEqual([2024, 2025, 2026]);
    expect(slices.find((s) => s.key === "new")!.active).toEqual([2025, 2026]);
  });

  it("flags joiners and splits the projects into shares", () => {
    expect(slices.filter((s) => s.isNew).map((s) => s.key).sort()).toEqual(["joiner", "new"]);
    expect(slices.reduce((s, o) => s + o.share, 0)).toBeCloseTo(1);
    expect(slices.find((s) => s.key === "old")!.share).toBeCloseTo(100 / 150);
  });

  it("ranks by the chosen column and breaks ties by name", () => {
    const by: RankBy = "projects";
    expect(topOrgs(slices, 2, by).map((s) => s.key)).toEqual(["old", "new"]);
    expect(topOrgs(slices, 9, "stars")[0].key).toBe("old");
    expect(topOrgs([], 5).length).toBe(0);
  });

  it("returns nothing for an empty window", () => {
    expect(orgSlices(ARCHIVE, [])).toEqual([]);
  });
});

describe("mixes", () => {
  const slices = orgSlices(ARCHIVE, [2024, 2025, 2026]);

  it("groups sectors by projects and folds the tail", () => {
    const mix = sectorMix(slices, 1);
    expect(mix[0]).toEqual({ label: "Science", value: 100, share: 100 / 150 });
    expect(mix[mix.length - 1].label).toBe("Other");
    expect(mix.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
  });

  it("counts stack tags across the window's organizations only", () => {
    const tags = techMix(slices, ARCHIVE, 8);
    expect(tags.find((t) => t.label === "python")!.value).toBe(2); // Old Timer + Newcomer
    expect(tags.find((t) => t.label === "c++")!.value).toBe(1); // Quit In 2020 is outside the window
    expect(tags.reduce((s, t) => s + t.value, 0)).toBe(5); // python x2 + c++, react, go
  });
});

describe("one organization's view", () => {
  const win = [2024, 2025, 2026];

  it("keeps the full history and names the years it sat out", () => {
    const d = orgDetail(ARCHIVE, "old", win)!;
    expect(d.active).toEqual([2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]);
    expect(d.gaps).toEqual([]);
    expect(d.rank).toBe(1);
    expect(d.of).toBe(3);
  });

  it("finds a gap between an organization's first and last season", () => {
    const rows = [row({ key: "gappy", years: [2018, 2019, 2023] })];
    expect(orgDetail(rows, "gappy", [2023])!.gaps).toEqual([2020, 2021, 2022]);
  });

  it("is null when the organization is absent from the window", () => {
    expect(orgDetail(ARCHIVE, "quit", win)).toBeNull();
    expect(orgDetail(ARCHIVE, "nope", win)).toBeNull();
  });

  it("carries the program split from the archive row", () => {
    const rows = [row({ key: "multi", years: [2026], programs: [{ id: "gsoc", projects: 7, years: [2026] }, { id: "lfx", projects: 3, years: [] }] })];
    expect(orgDetail(rows, "multi", [2026])!.programs).toEqual([
      { id: "gsoc", projects: 7, years: [2026] },
      { id: "lfx", projects: 3, years: [] },
    ]);
  });
});
