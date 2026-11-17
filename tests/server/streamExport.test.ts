import { describe, it, expect } from "vitest";
import { formatCsvRow } from "../../src/lib/server/streamExport";

describe("Streaming Data Export", () => {
  it("formats CSV rows with proper quote escaping", () => {
    const row = formatCsvRow(["Cyrus", 'Project, with "quotes"', 42]);
    expect(row).toBe('Cyrus,"Project, with ""quotes""",42');
  });

  it("handles null and undefined CSV fields", () => {
    const row = formatCsvRow(["Item", null, undefined, "Done"]);
    expect(row).toBe("Item,,,Done");
  });
});
