import { describe, expect, it } from "vitest";
import { PROGRAM_DETAILS } from "../../data/programDetails";
import {
  CELL_UNPUBLISHED,
  COMPARABLE_IDS,
  DEFAULT_SELECTION,
  MAX_SELECTION,
  cellOfField,
  comparableIds,
  compareRows,
  parseSelection,
  rowOf,
  selectionFromSearch,
  selectionToParam,
  selectionToSearch,
  toggleProgram,
  windowCell,
} from "./model";

/* The comparison must never turn "the record is silent" into a rule, so the
   first table walks every program record this build ships and checks that
   each cell is either the verbatim published text or the explicit label. */
describe("field mapping for every program record", () => {
  it("offers exactly the ids that have a detail record", () => {
    expect(COMPARABLE_IDS).toEqual(Object.keys(PROGRAM_DETAILS));
    expect(COMPARABLE_IDS.length).toBeGreaterThan(0);
  });

  it("copies published eligibility verbatim, and labels the rest", () => {
    const rows = compareRows(COMPARABLE_IDS);
    expect(rows.map((r) => r.id)).toEqual(COMPARABLE_IDS);
    for (const row of rows) {
      const detail = PROGRAM_DETAILS[row.id];
      if (detail.eligibility && detail.eligibility.trim()) {
        expect(row.eligibility.text).toBe(detail.eligibility.trim());
        expect(row.eligibility.published).toBe(true);
      } else {
        expect(row.eligibility.text).toBe(CELL_UNPUBLISHED);
        expect(row.eligibility.published).toBe(false);
      }
      /* duration and tier are required fields on the record, so they publish */
      expect(row.duration.text).toBe(detail.duration);
      expect(row.tier.text).toBe(detail.tier);
    }
  });

  it("maps an application window only where the record states one", () => {
    const rows = new Map(compareRows(COMPARABLE_IDS).map((r) => [r.id, r]));

    const gsoc = rows.get("gsoc")!;
    expect(gsoc.window.label).toBe("Proposal window");
    expect(gsoc.window.period).toBe("late Mar - early Apr");
    expect(gsoc.window.published).toBe(true);
    expect(gsoc.window.text).toBe("Proposal window (late Mar - early Apr)");
    expect(gsoc.window.source).toContain("Proposal window");

    /* LFX names the step but publishes no dates: a partial record must read
       as a partial record, never as a complete window */
    const lfx = rows.get("lfx")!;
    expect(lfx.window.label).toBe("Apply to one scope");
    expect(lfx.window.period).toBe("");
    expect(lfx.window.published).toBe(false);
    expect(lfx.window.text).toContain(CELL_UNPUBLISHED.toLowerCase());

    /* MLH publishes batches but no application dates */
    const mlh = rows.get("mlh")!;
    expect(mlh.window.text).toBe(CELL_UNPUBLISHED);
    expect(mlh.window.published).toBe(false);

    /* a program with no application step at all stays unpublished */
    const oct = rows.get("oct")!;
    expect(oct.window.text).toBe(CELL_UNPUBLISHED);
  });

  it("keeps selection order and drops ids this build does not know", () => {
    const rows = compareRows(["kde", "gsoc", "not-a-program"]);
    expect(rows.map((r) => r.id)).toEqual(["kde", "gsoc"]);
    expect(compareRows([])).toEqual([]);
  });

  it("orders the picker by the catalog when one is supplied", () => {
    const ordered = comparableIds(["sob", "gsoc"]);
    expect(ordered.slice(0, 2)).toEqual(["sob", "gsoc"]);
    expect(new Set(ordered)).toEqual(new Set(COMPARABLE_IDS));
  });
});

describe("missing and partial values", () => {
  it("labels an absent field instead of rendering a blank", () => {
    for (const raw of [undefined, "", "   ", "\n\t"]) {
      const cell = cellOfField(raw);
      expect(cell.text).toBe(CELL_UNPUBLISHED);
      expect(cell.published).toBe(false);
    }
  });

  it("labels an absent or stage-only application window", () => {
    expect(windowCell(undefined).text).toBe(CELL_UNPUBLISHED);
    const stageOnly = windowCell({ label: "Registration", source: "Program path" });
    expect(stageOnly.label).toBe("Registration");
    expect(stageOnly.period).toBe("");
    expect(stageOnly.published).toBe(false);
    expect(stageOnly.text).toContain(CELL_UNPUBLISHED.toLowerCase());
    const blank = windowCell({ label: "  ", period: "May", source: "x" });
    expect(blank.text).toBe(CELL_UNPUBLISHED);
    expect(blank.published).toBe(false);
  });

  it("never invents a field for a record that is missing entirely", () => {
    const row = rowOf("ghost", undefined);
    for (const field of ["eligibility", "window", "duration", "tier", "difficulty"] as const) {
      expect(row[field].text).toBe(CELL_UNPUBLISHED);
      expect(row[field].published).toBe(false);
    }
    expect(row.name).toBe("ghost");
  });

  it("uses the catalog name when one is supplied", () => {
    expect(rowOf("gsoc", PROGRAM_DETAILS.gsoc, "Google Summer of Code").name).toBe("Google Summer of Code");
  });
});

describe("selection URL round-trip", () => {
  it("opens the defaults when ?p= is absent", () => {
    expect(selectionFromSearch("")).toEqual(DEFAULT_SELECTION);
    expect(selectionFromSearch("?utm=x")).toEqual(DEFAULT_SELECTION);
  });

  it("keeps an explicitly empty selection empty", () => {
    expect(selectionFromSearch("?p=")).toEqual([]);
    expect(selectionToSearch([])).toBe("?p=");
    expect(selectionFromSearch(selectionToSearch([]))).toEqual([]);
  });

  it("round-trips the worked example", () => {
    const ids = ["gsoc", "lfx", "outreachy"];
    const search = selectionToSearch(ids);
    expect(search).toBe("?p=gsoc,lfx,outreachy");
    expect(selectionFromSearch(search)).toEqual(ids);
    expect(selectionToParam(ids)).toBe("gsoc,lfx,outreachy");
  });

  it("normalises casing, whitespace and duplicates", () => {
    expect(parseSelection(" GSoC , lfx ,, gsoc ")).toEqual(["gsoc", "lfx"]);
  });

  it("drops ids that have no record and caps the list", () => {
    expect(parseSelection("gsoc,ghost,lfx")).toEqual(["gsoc", "lfx"]);
    const capped = parseSelection(COMPARABLE_IDS.join(","));
    expect(capped).toHaveLength(MAX_SELECTION);
    expect(selectionToParam(COMPARABLE_IDS).split(",")).toHaveLength(MAX_SELECTION);
  });

  it("reads a full search string, not only the ?p= value", () => {
    expect(selectionFromSearch("?p=kde&utm=chat")).toEqual(["kde"]);
  });
});

describe("toggling a program", () => {
  it("adds and removes without exceeding the cap", () => {
    expect(toggleProgram(["gsoc"], "lfx")).toEqual(["gsoc", "lfx"]);
    expect(toggleProgram(["gsoc", "lfx"], "lfx")).toEqual(["gsoc"]);
    const full = COMPARABLE_IDS.slice(0, MAX_SELECTION);
    expect(toggleProgram(full, COMPARABLE_IDS[MAX_SELECTION])).toEqual(full);
  });

  it("ignores ids the comparison does not know", () => {
    expect(toggleProgram(["gsoc"], "ghost")).toEqual(["gsoc"]);
  });
});
