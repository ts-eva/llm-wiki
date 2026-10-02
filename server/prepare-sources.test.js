import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { stampCreated, renameUntagged, readableTitle } from "./prepare-sources.js";

function wiki({ git }) {
  const w = fs.mkdtempSync(path.join(os.tmpdir(), "llm-wiki-stamp-"));
  const src = path.join(w, "sources");
  fs.mkdirSync(src);
  fs.writeFileSync(path.join(src, "plain.md"), "just text");
  fs.writeFileSync(path.join(src, "fm.md"), "---\ntitle: x\n---\nbody");
  fs.writeFileSync(path.join(src, "dated.md"), "---\ncreated: 01/01/2021\n---\nbody");
  fs.writeFileSync(path.join(src, "skip.md"), "---\nignore: true\n---\nx");
  fs.writeFileSync(path.join(src, "index.md"), "# Sources Index\n");
  fs.writeFileSync(path.join(src, "image.png"), "png");
  if (git) {
    const g = (...a) => execFileSync("git", ["-C", w, ...a], { stdio: "pipe" });
    g("init", "-q");
    g("add", ".");
    g("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "init", "--date=2020-01-02T12:00:00");
  }
  return w;
}
const read = (w, f) => fs.readFileSync(path.join(w, "sources", f), "utf8");

test("stamps notes missing created (including ignored), leaves dated, index and non-md alone", () => {
  const w = wiki({ git: true });
  const { stamped } = stampCreated(w, "MM/DD/YYYY");
  assert.deepEqual(stamped.map((s) => s.file).sort(), ["fm.md", "plain.md", "skip.md"]);
  assert.equal(read(w, "plain.md"), "---\ncreated: 01/02/2020\n---\n\njust text");
  assert.equal(read(w, "fm.md"), "---\ncreated: 01/02/2020\ntitle: x\n---\nbody");
  assert.equal(read(w, "skip.md"), "---\ncreated: 01/02/2020\nignore: true\n---\nx");
  assert.equal(read(w, "dated.md"), "---\ncreated: 01/01/2021\n---\nbody");
  assert.equal(read(w, "index.md"), "# Sources Index\n");
  assert.equal(read(w, "image.png"), "png");
});

test("earlier git first-add date beats a later birth time; second run is a no-op", () => {
  const w = wiki({ git: true });
  assert.equal(stampCreated(w, "YYYY-MM-DD").stamped.find((s) => s.file === "plain.md").created, "2020-01-02");
  assert.deepEqual(stampCreated(w, "YYYY-MM-DD").stamped, []);
});

test("no git: falls back to the file's birth time", () => {
  const w = wiki({ git: false });
  const today = new Date();
  const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  assert.equal(stampCreated(w, "YYYY-MM-DD").stamped.find((s) => s.file === "plain.md").created, expected);
});

test("readable titles from legacy slugs keep ticket keys, drop session- and date affixes", () => {
  assert.equal(readableTitle("session-hw-2409-widgetbook-surge-deploy-plan-2026-08-31.md"), "hw-2409 widgetbook surge deploy plan");
  assert.equal(readableTitle("prompt-compression-research-2026-09-29.md"), "prompt compression research");
  assert.equal(readableTitle("session-pto-summary-2026-09-03-to-2026-09-15-2026-09-16.md"), "pto summary 2026-09-03 to 2026-09-15");
  assert.equal(readableTitle("changelog-sept-2025-data-3022.md"), "changelog sept 2025 data-3022");
  assert.equal(readableTitle("TSM demo - Load Manager.md"), "TSM demo - Load Manager");
});

test("renames untagged notes that break naming rules, relinks, leaves tagged and ignored alone", () => {
  const w = wiki({ git: false });
  const src = path.join(w, "sources");
  fs.writeFileSync(path.join(src, "TSM demo - Load Manager.md"), "x");
  fs.writeFileSync(path.join(src, "Todo.md"), "---\nignore: true\n---\n");
  fs.writeFileSync(path.join(src, "Tagged Note.md"), "x");
  fs.writeFileSync(path.join(src, "index.md"), "# Sources Index\n<!--\n## sources/<filename>\n-->\n## sources/Tagged Note.md\nwiki-pages: []\n");
  fs.writeFileSync(path.join(src, "linker.md"), "see [[TSM demo - Load Manager|demo]] and [[sources/TSM demo - Load Manager.md]]");
  const { renamed, relinked } = renameUntagged(w);
  assert.deepEqual(renamed, [{ from: "TSM demo - Load Manager.md", to: "tsm demo load manager.md" }]);
  assert.equal(relinked, 2);
  assert.equal(read(w, "linker.md"), "see [[tsm demo load manager|demo]] and [[sources/tsm demo load manager.md]]");
  assert.ok(fs.existsSync(path.join(src, "Todo.md")) && fs.existsSync(path.join(src, "Tagged Note.md")));
  assert.deepEqual(renameUntagged(w).renamed, []);
});

test("case-only rename of a tracked note is recorded in git", () => {
  const w = wiki({ git: true });
  fs.writeFileSync(path.join(w, "sources", "Weekly.md"), "x");
  execFileSync("git", ["-C", w, "add", "."]);
  execFileSync("git", ["-C", w, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "w"]);
  renameUntagged(w);
  assert.match(execFileSync("git", ["-C", w, "status", "--short"]).toString(), /R {2}sources\/Weekly\.md -> sources\/weekly\.md/);
});
