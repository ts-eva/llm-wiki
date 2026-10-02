import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, parseDate, frontmatterDates } from "./dates.js";

test("format and parse round-trip in each supported format, ISO always accepted", () => {
  const d = new Date(2026, 9, 2);
  for (const fmt of ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD", "DD.MM.YYYY"]) {
    assert.equal(parseDate(formatDate(d, fmt), fmt).getTime(), d.getTime(), fmt);
  }
  assert.equal(parseDate("2026-10-02", "MM/DD/YYYY").getTime(), d.getTime());
  assert.equal(parseDate("'10/02/2026'", "MM/DD/YYYY").getTime(), d.getTime());
  assert.equal(parseDate("garbage", "MM/DD/YYYY"), null);
});

test("reads created/updated from frontmatter only", () => {
  const { created, updated } = frontmatterDates("---\ncreated: 09/30/2026\nupdated: 10/01/2026\n---\ncreated: 01/01/2000", "MM/DD/YYYY");
  assert.equal(created.getDate(), 30);
  assert.equal(updated.getDate(), 1);
  assert.deepEqual(frontmatterDates("no frontmatter", "MM/DD/YYYY"), { created: null, updated: null });
});
