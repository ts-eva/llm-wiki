import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { sourceStatus, markSources } from "./sources-state.js";

function wiki() {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-state-"));
  const src = path.join(w, "sources");
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, "a note.md"), "alpha");
  fs.writeFileSync(path.join(src, "b.md"), "beta");
  fs.writeFileSync(path.join(src, "c.md"), "gamma");
  fs.writeFileSync(path.join(src, "skip.md"), "---\nignore: true\n---\nx");
  fs.writeFileSync(path.join(src, "index.md"), [
    "# Sources Index", "",
    "## sources/a note.md", "summary: A", "wiki-pages: [wiki/pages/a.md]", "",
    "## sources/b.md", "summary: B", "wiki-pages: []", "",
    "## sources/gone.md", "summary: G", "wiki-pages: [wiki/pages/g.md]", "",
  ].join("\n"));
  return w;
}
const edit = (w, f, body) => fs.writeFileSync(path.join(w, "sources", f), body);
const index = (w) => fs.readFileSync(path.join(w, "sources", "index.md"), "utf8");

test("fresh index: unstamped entries count as changed; untagged, removed, ignored detected", () => {
  const s = sourceStatus(wiki());
  assert.deepEqual(s.untagged, ["c.md"]);
  assert.deepEqual(s.changed.sort(), ["a note.md", "b.md"]);
  assert.deepEqual(s.unstamped.sort(), ["a note.md", "b.md"]);
  assert.deepEqual(s.removed, ["gone.md"]);
  assert.deepEqual(s.ignored, ["skip.md"]);
});

test("baseline stamps current state; organized only where pages exist", () => {
  const w = wiki();
  assert.deepEqual(markSources(w, ["a note.md", "b.md"], "baseline").errors, []);
  const s = sourceStatus(w);
  assert.deepEqual(s.changed, []);
  assert.deepEqual(s.unorganized, ["b.md"]);
  assert.match(index(w), /## sources\/a note\.md\nsummary: A\nhash: \w{12}\norganized-hash: \w{12}\nwiki-pages:/);
});

test("editing a source makes it changed, then unorganized until organized", () => {
  const w = wiki();
  markSources(w, ["a note.md", "b.md"], "baseline");
  edit(w, "a note.md", "alpha, corrected");
  assert.deepEqual(sourceStatus(w).changed, ["a note.md"]);
  assert.match(markSources(w, ["a note.md"], "organized").errors[0], /changed since tagging/);
  markSources(w, ["a note.md"], "tagged");
  assert.deepEqual(sourceStatus(w).changed, []);
  assert.deepEqual(sourceStatus(w).unorganized.sort(), ["a note.md", "b.md"]);
  assert.deepEqual(markSources(w, ["a note.md"], "organized").errors, []);
  assert.deepEqual(sourceStatus(w).unorganized, ["b.md"]);
  assert.equal((index(w).match(/^hash:/gm) || []).length, 2, "stamps replaced, not duplicated");
});

test("organized requires wiki-pages; remove only drops entries whose file is gone", () => {
  const w = wiki();
  markSources(w, ["b.md"], "tagged");
  assert.match(markSources(w, ["b.md"], "organized").errors[0], /wiki-pages is empty/);
  assert.match(markSources(w, ["b.md"], "remove").errors[0], /file still exists/);
  assert.deepEqual(markSources(w, ["gone.md"], "remove").errors, []);
  assert.ok(!index(w).includes("gone.md"));
  assert.deepEqual(sourceStatus(w).removed, []);
  assert.ok(index(w).includes("## sources/b.md"));
});

test("rejects unknown stage", () => {
  assert.ok(markSources(wiki(), ["b.md"], "bogus").error);
});
