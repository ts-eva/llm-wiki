import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { stampCreated, renameUntagged, readableTitle, prepareSources } from "./prepare-sources.js";
import { commitFiles } from "./git-commit.js";

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

test("prepareSources lists every file it changed; commitFiles commits those and nothing else", () => {
  const w = wiki({ git: true });
  const src = path.join(w, "sources");
  const git = (...a) => execFileSync("git", ["-C", w, "-c", "user.name=t", "-c", "user.email=t@t", ...a]).toString();
  fs.writeFileSync(path.join(src, "Weekly.md"), "---\ncreated: 01/01/2026\n---\nx");
  fs.writeFileSync(path.join(src, "linker.md"), "---\ncreated: 01/01/2026\n---\nsee [[Weekly]]");
  fs.writeFileSync(path.join(src, "busy.md"), "---\ncreated: 01/01/2026\n---\nv1");
  git("add", "."); git("commit", "-qm", "w");
  fs.writeFileSync(path.join(src, "fresh.md"), "no date yet");
  fs.writeFileSync(path.join(src, "busy.md"), "---\ncreated: 01/01/2026\n---\nhalf-done edit by another session");
  fs.writeFileSync(path.join(w, "staged by user.md"), "s");
  git("add", "staged by user.md");

  const { files } = prepareSources(w, "MM/DD/YYYY");
  // fm, plain, skip: the fixture's notes without created:
  const expected = ["sources/Weekly.md", "sources/fm.md", "sources/fresh.md", "sources/linker.md", "sources/plain.md", "sources/skip.md", "sources/weekly.md"];
  assert.deepEqual(files, expected);
  assert.deepEqual(commitFiles(w, files, "wiki: prepare sources").committed, expected);
  assert.equal(git("show", "--name-status", "--format=", "HEAD").trim(),
    "M\tsources/fm.md\nA\tsources/fresh.md\nM\tsources/linker.md\nM\tsources/plain.md\nM\tsources/skip.md\nR100\tsources/Weekly.md\tsources/weekly.md");
  assert.deepEqual(git("status", "--porcelain", "-z").split("\0").filter(Boolean).sort(), [" M sources/busy.md", "A  staged by user.md"]);
  assert.deepEqual(commitFiles(w, files, "again").committed, []);
});

test("commitFiles: a folder entry takes every change under it, deletions included", () => {
  const w = wiki({ git: true });
  const git = (...a) => execFileSync("git", ["-C", w, "-c", "user.name=t", "-c", "user.email=t@t", ...a]).toString();
  fs.mkdirSync(path.join(w, "wiki", "pages"), { recursive: true });
  fs.writeFileSync(path.join(w, "wiki", "pages", "old.md"), "o");
  fs.writeFileSync(path.join(w, "log.md"), "l");
  git("add", "."); git("commit", "-qm", "w");
  fs.unlinkSync(path.join(w, "wiki", "pages", "old.md"));
  fs.writeFileSync(path.join(w, "wiki", "pages", "new page.md"), "n");
  fs.writeFileSync(path.join(w, "log.md"), "l2");
  fs.writeFileSync(path.join(w, "sources", "untouched.md"), "u");
  const res = commitFiles(w, ["wiki/", "log.md"], (f) => `wiki: batch (${f.length})`);
  assert.deepEqual(res.committed, ["log.md", "wiki/pages/new page.md", "wiki/pages/old.md"]);
  assert.equal(git("log", "-1", "--format=%s").trim(), "wiki: batch (3)");
  assert.equal(git("status", "--porcelain").trim(), "?? sources/untouched.md");
});
