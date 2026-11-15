/* ══ ogContent.test.ts — the share card may only say what the data says ══
 * The card is generated, which makes it easy to let it drift into quoting a
 * number the catalog no longer holds, or calling a prize-only program a
 * stipend. These tests pin every string on the card to a source field.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PROGRAMS, ORGS } from "@/data/orgs";
import { REPOS } from "@/data/repos";
import { fmtFull, STATS } from "@/lib/siteStats";
import { catalogSnapshot, homeCard, programCard } from "@/lib/ogContent";
import type { Program } from "@/lib/types";

describe("catalog snapshot", () => {
  it("is the newest updated date in the project catalog", () => {
    const newest = REPOS.map((r) => r.updated).sort().at(-1) ?? "";
    expect(catalogSnapshot()).toBe(
      `${new Date(`${newest}T00:00:00Z`).getUTCDate()} ${new Date(`${newest}T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" })} ${new Date(`${newest}T00:00:00Z`).getUTCFullYear()}`
    );
  });

  it("carries the same date the README badge carries", () => {
    const readme = readFileSync(join(__dirname, "..", "..", "README.md"), "utf8");
    const badge = readme.match(/snapshot-(\d+)_(\w+)_(\d{4})/);
    expect(badge, "README has no snapshot badge to compare against").toBeTruthy();
    const [, day, month, year] = badge!;
    expect(catalogSnapshot()).toBe(`${day} ${month} ${year}`);
  });
});

describe("home card", () => {
  const card = homeCard();

  it("quotes the live counts, not literals", () => {
    const said = card.rows.map((r) => r.v).join(" | ");
    expect(said).toContain(`${fmtFull(STATS.issues)} across`);
    expect(said).toContain(`${PROGRAMS.length} tracked`);
    expect(said).toContain(`${fmtFull(STATS.archive)} program projects`);
    expect(said).toContain(`${STATS.archivePrograms} archives`);
    expect(said).toContain(`${ORGS.length} profiles`);
    expect(card.rows).toHaveLength(4);
  });

  it("does not advertise a section the site no longer has", () => {
    const said = [card.eyebrow, ...card.title, card.foot, card.alt, ...card.rows.flatMap((r) => [r.k, r.v])].join(" ");
    expect(said).not.toMatch(/hackathon|artifact|free api|learning resource/i);
  });

  it("does not call every program stipended", () => {
    const programs = card.rows.find((r) => r.k === "Programs")?.v ?? "";
    expect(programs).not.toMatch(/stipend/i);
  });

  it("stamps the footer with the snapshot rather than the build date", () => {
    expect(card.foot).toContain(catalogSnapshot());
    expect(card.foot).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it("keeps every row and line free of the characters the copy rules ban", () => {
    const all = [card.eyebrow, ...card.title, card.foot, card.alt, ...card.rows.flatMap((r) => [r.k, r.v])].join(" ");
    expect(all).not.toMatch(/[→—]|\p{Extended_Pictographic}/u);
  });
});

describe("program cards", () => {
  const fields = (p: (typeof PROGRAMS)[number]) => [p.pay, p.payNote, p.window, p.orgs, p.tag, p.name, p.owner];

  for (const p of PROGRAMS) {
    const card = programCard(p);

    it(`${p.id}: every value is a field that record already has`, () => {
      for (const row of card.rows) {
        expect(fields(p)).toContain(row.v);
      }
    });

    it(`${p.id}: the pay row is labelled with the record's own word for it`, () => {
      const pay = card.rows.find((r) => r.v === p.pay);
      if (p.pay) {
        expect(pay, "a program with a pay field must show it").toBeTruthy();
        expect(pay?.k).toBe(p.payNote || "Pay");
      } else {
        expect(pay).toBeFalsy();
      }
    });

    it(`${p.id}: title, tag and alt come from the record`, () => {
      expect(card.title).toEqual([p.name]);
      expect(card.tag).toBe(p.tag);
      expect(card.alt).toContain(p.name);
      expect(card.foot).toContain(`/programs/${p.id}`);
    });
  }

  it("covers every program in the catalog", () => {
    /* the loop above is driven by PROGRAMS, so this only fails when the
       data file changes size - which is exactly when the card builder
       needs re-reading against the new records */
    expect(PROGRAMS).toHaveLength(13);
  });
});

describe("program cards on partial records", () => {
  /* A fixture with the stipend, window and reach unpublished: the share card
     must not claim a value the record does not publish, and must not turn the
     gap into a "$0" or a blank row. */
  const base = PROGRAMS[0];
  const noFigures: Program = { ...base, pay: "", window: "", orgs: "", payNote: "" };

  it("emits no ledger row for a field the record does not publish", () => {
    const card = programCard(noFigures);
    expect(card.rows).toEqual([]);
    const said = JSON.stringify(card);
    expect(said).not.toContain("$0");
    expect(said).not.toContain('"v":""');
  });

  it("keeps the published pay paired with its own note, not another record's", () => {
    const withPay: Program = { ...noFigures, pay: "$1,500 – $3,000", payNote: "PER TERM" };
    const card = programCard(withPay);
    const pay = card.rows.find((r) => r.v === withPay.pay);
    expect(pay?.k).toBe("PER TERM");
    expect(card.rows).toHaveLength(1);
  });

  it("labels a published pay with no note as plain Pay rather than inventing one", () => {
    const payOnly: Program = { ...noFigures, pay: "Badge + tree" };
    const card = programCard(payOnly);
    expect(card.rows.find((r) => r.v === "Badge + tree")?.k).toBe("Pay");
  });
});
