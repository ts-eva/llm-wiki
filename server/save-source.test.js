import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { saveSource } from "./save-source.js";
import { titleWords, similarity, similarSources } from "./similar.js";

function wiki() {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-save-"));
  fs.mkdirSync(path.join(w, "sources"));
  fs.writeFileSync(path.join(w, "config.yaml"), 'wiki:\n  date_format: "YYYY-MM-DD"\n');
  fs.writeFileSync(path.join(w, "sources", "van load board.md"), "---\ncreated: 2026-01-01\n---\nvan");
  fs.writeFileSync(path.join(w, "sources", "hw-2538 smart match widget android gate.md"), "---\ncreated: 2026-01-01\n---\nwidget");
  fs.writeFileSync(path.join(w, "sources", "index.md"), "# Sources Index\n");
  return w;
}

test("title words drop stopwords, dates and plurals; ticket keys stay whole", () => {
  assert.deepEqual([...titleWords("session-demo-notes-2026-07-30.md")], ["demo", "note"]);
  assert.deepEqual([...titleWords("HW-2538 rewrite of the widgets")], ["hw-2538", "rewrite", "widget"]);
});

test("similarity needs two shared words or a shared ticket key", () => {
  assert.equal(similarity(titleWords("llm wiki"), titleWords("llm-wiki plugin")), 0.8);
  assert.equal(similarity(titleWords("van load board"), titleWords("load manager")), 0);
  assert.ok(similarity(titleWords("hw-2538 notes"), titleWords("mr 447 review hw-2538 rewrite")) >= 0.6);
});

test("a new title close to an existing note is refused with the matches", () => {
  const w = wiki();
  const res = saveSource(w, { title: "Van Load Board Testing", content: "test plan" });
  assert.equal(res.saved, false);
  assert.deepEqual(res.similar.map((s) => s.title), ["van load board"]);
  assert.equal(fs.existsSync(path.join(w, "sources", "van load board testing.md")), false);
  assert.deepEqual(similarSources("hw-2538 upgrade test", path.join(w, "sources")).map((s) => s.title), ["hw-2538 smart match widget android gate"]);
});

test("new: true saves anyway; the same title updates without a check; unrelated titles save", () => {
  const w = wiki();
  assert.equal(saveSource(w, { title: "Van Load Board Testing", content: "plan", new: true }).file, "sources/van load board testing.md");
  const upd = saveSource(w, { title: "van load board", content: "van v2" });
  assert.equal(upd.updated, true);
  assert.match(fs.readFileSync(path.join(w, "sources", "van load board.md"), "utf8"), /created: 2026-01-01\nupdated: \d{4}-\d{2}-\d{2}\n[\s\S]*van v2$/);
  assert.equal(saveSource(w, { title: "gradle lockfile pins", content: "x" }).saved, true);
});
