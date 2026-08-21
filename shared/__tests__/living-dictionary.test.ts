import { describe, it, expect } from "vitest";
import {
  DICTIONARY_ENTRIES,
  DICTIONARY_PAGE_MAP,
} from "../living-dictionary";

describe("living dictionary", () => {
  it("carries the full extract", () => {
    expect(DICTIONARY_ENTRIES.length).toBe(160);
  });

  it("has no duplicate entry numbers, so deep links stay unambiguous", () => {
    const numbers = DICTIONARY_ENTRIES.map((e) => e.number);
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("gives every entry a term and both definitions", () => {
    for (const e of DICTIONARY_ENTRIES) {
      expect(e.number, `entry ${e.term}`).toBeTruthy();
      expect(e.term.trim().length, `entry ${e.number}`).toBeGreaterThan(0);
      expect(e.official.trim().length, `entry ${e.number}`).toBeGreaterThan(0);
      expect(e.true_def.trim().length, `entry ${e.number}`).toBeGreaterThan(0);
    }
  });

  it("maps every entry to a page in the source work", () => {
    const missing = DICTIONARY_ENTRIES.filter((e) => !DICTIONARY_PAGE_MAP[e.number]);
    expect(missing.map((e) => e.number)).toEqual([]);
  });

  it("keeps page numbers plausible and ascending overall", () => {
    const pages = Object.values(DICTIONARY_PAGE_MAP);
    for (const p of pages) expect(p).toBeGreaterThan(0);
    expect(Math.max(...pages)).toBeLessThan(1000);
  });

  it("includes the terms the app's own language depends on", () => {
    const terms = DICTIONARY_ENTRIES.map((e) => e.term.toLowerCase());
    for (const needed of ["soul", "law", "freedom"]) {
      expect(terms, `missing "${needed}"`).toContain(needed);
    }
  });
});
